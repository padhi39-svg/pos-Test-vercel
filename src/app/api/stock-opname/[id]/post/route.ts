import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { getStockAllowNegative, checkStockAvailability } from '@/lib/stockValidation'
import { saveJournalEntriesForSource } from '@/lib/journalHelpers'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname (
      id SERIAL PRIMARY KEY,
      number TEXT,
      tdate TEXT,
      warehouse_id INTEGER,
      status TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_edit INTEGER
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_items (
      id SERIAL PRIMARY KEY,
      opname_id INTEGER,
      barang_id INTEGER,
      system_qty REAL,
      count_qty REAL,
      variance_qty REAL
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      ingredient_id INTEGER,
      warehouse_id INTEGER,
      movement_type TEXT,
      quantity REAL,
      unit TEXT,
      reference_type TEXT,
      reference_id INTEGER,
      period_id INTEGER,
      movement_date TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS stock_balance (
      ingredient_id INTEGER,
      warehouse_id INTEGER,
      quantity REAL,
      PRIMARY KEY (ingredient_id, warehouse_id)
    );
  `)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    await ensureTables()
    await addAuditColumns()
    const userId = getUserId(req)

    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
      )
      const has = (n:string)=> cols.some(c=> String(c.column_name).toLowerCase()===n)
      if (!has('period_id')) await rawRun('ALTER TABLE stock_opname ADD COLUMN period_id INTEGER')
    } catch {}

    const hdr = await rawGet<any>('SELECT id, number, tdate, warehouse_id, status, period_id FROM stock_opname WHERE id=?', [id])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    if (String(hdr.status) === 'posted') return NextResponse.json({ error: 'Dokumen sudah diposting' }, { status: 400 })

    const items = await rawAll<any[]>('SELECT id, barang_id, system_qty, count_qty, variance_qty FROM stock_opname_items WHERE opname_id=?', [id])

    const dateOnly = String(hdr.tdate || '').slice(0,10)
    const resolvePeriodByDate = async (dt:string)=>{
      try {
        const p = await rawGet<any>(`SELECT id FROM master_periode WHERE DATE(?) BETWEEN DATE(COALESCE(start_date,'0001-01-01')) AND DATE(COALESCE(end_date,'9999-12-31')) AND COALESCE(isdelete, 0) = 0 ORDER BY id DESC LIMIT 1`, [dt])
        if (p?.id) return Number(p.id)
      } catch {}
      try { const p = await rawGet<any>('SELECT id FROM master_periode WHERE is_active=1 ORDER BY id DESC LIMIT 1'); return Number(p?.id)||null } catch { return null }
    }
    const periodId = await resolvePeriodByDate(dateOnly)

    if (!periodId) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${dateOnly}.` }, { status: 400 })
    }
    const postPeriod = await rawGet<any>('SELECT id, name, is_closed, status_buku FROM master_periode WHERE id = ?', [periodId])
    if (postPeriod) {
      const closed = postPeriod?.status_buku ? (String(postPeriod.status_buku).toUpperCase() === 'CLOSED' ? 1 : 0) : Number(postPeriod.is_closed)
      if (closed === 1) {
        return NextResponse.json({ error: `Periode '${postPeriod.name}' sudah ditutup.` }, { status: 400 })
      }
    }

    const db = getDb()
    const pool = (db as any).$client
    await pool.query('BEGIN')
    try {
      const allowNegativeStock = await getStockAllowNegative(pool)
      let inTotal = 0, outTotal = 0, affected = 0
      for (const it of items) {
        const variance = Number(it.variance_qty || 0)
        if (!variance) continue
        const movement_type = variance > 0 ? 'in' : 'out'
        const qtyAbs = Math.abs(variance)
        if (movement_type === 'out' && !allowNegativeStock) {
          const chk = await checkStockAvailability(pool, it.barang_id, hdr.warehouse_id, qtyAbs)
          if (!chk.available) throw new Error(`Stok tidak mencukupi untuk barang ID ${it.barang_id}: tersedia ${chk.currentStock}, dibutuhkan ${qtyAbs}`)
        }
        const unit = 'unit'
        const notes = `Opname ${hdr.number || id}`
        await rawRun(
          'INSERT INTO stock_movements(ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, movement_date, notes) VALUES(?,?,?,?,?,?,?,?,?,?)',
          [it.barang_id, hdr.warehouse_id, movement_type, qtyAbs, unit, 'stock_opname', id, periodId, hdr.tdate || new Date().toISOString().slice(0,10), notes]
        )

        const bal = await rawGet<any>('SELECT quantity FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?', [it.barang_id, hdr.warehouse_id])
        const current = Number(bal?.quantity || 0)
        const nextQty = movement_type === 'in' ? current + qtyAbs : current - qtyAbs
        if (bal) {
          await rawRun('UPDATE stock_balance SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE ingredient_id=? AND warehouse_id=?', [nextQty, it.barang_id, hdr.warehouse_id])
        } else {
          await rawRun('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity) VALUES(?,?,?)', [it.barang_id, hdr.warehouse_id, nextQty])
        }
        if (movement_type === 'in') inTotal += qtyAbs; else outTotal += qtyAbs
        affected++
      }

      // Generate journal entries for stock opname
      try {
        const hppRow = await rawGet<any>(`
          SELECT a.code, a.name FROM account_mappings m
          JOIN accounts a ON a.id = m.account_id
          WHERE m.map_group = 'pelanggan' AND m.map_key = 'hpp'
        `)
        const defInvRow = await rawGet<any>(`
          SELECT a.code, a.name FROM account_mappings m
          JOIN accounts a ON a.id = m.account_id
          WHERE m.map_group = 'barang' AND m.map_key = 'persediaan_barang'
        `)
        if (hppRow?.code) {
          const je: { account_code: string; account_name?: string; debit: number; credit: number; description?: string }[] = []
          for (const it of items) {
            const variance = Number(it.variance_qty || 0)
            if (!variance) continue
            const barang = await rawGet<any>('SELECT hpp, account_id, code, name FROM master_barang WHERE id = ?', [it.barang_id])
            const hppPrice = Number(barang?.hpp || 0)
            if (hppPrice <= 0) continue
            const value = Math.round(Math.abs(variance) * hppPrice * 100) / 100
            if (value <= 0) continue
            let invCode = defInvRow?.code || ''
            let invName = defInvRow?.name || ''
            if (barang?.account_id) {
              const invAcc = await rawGet<any>('SELECT code, name FROM accounts WHERE id = ?', [barang.account_id])
              if (invAcc?.code) { invCode = invAcc.code; invName = invAcc.name }
            }
            if (!invCode) continue
            const desc = `opname ${barang.code || it.barang_id} selisih ${variance > 0 ? '+' : ''}${variance}`
            if (variance > 0) {
              je.push({ account_code: invCode, account_name: invName, debit: value, credit: 0, description: desc })
              je.push({ account_code: hppRow.code, account_name: hppRow.name, debit: 0, credit: value, description: desc })
            } else {
              je.push({ account_code: hppRow.code, account_name: hppRow.name, debit: value, credit: 0, description: desc })
              je.push({ account_code: invCode, account_name: invName, debit: 0, credit: value, description: desc })
            }
          }
          if (je.length > 0) {
            await saveJournalEntriesForSource('Stok Opname', id, hdr.number || String(id), hdr.tdate || '', je)
          }
        }
      } catch (e) {
        console.warn('[Stock Opname] failed to save journal entries:', e)
      }

      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
      )
      const has = (n:string)=> cols.some(c=> String(c.column_name).toLowerCase()===n)
      const hasUserEdit = has('user_edit')
      const hasPeriod = has('period_id')
      if (hasUserEdit && hasPeriod) {
        await rawRun("UPDATE stock_opname SET status='posted', period_id=?, updated_at=CURRENT_TIMESTAMP, user_edit=? WHERE id=?", [periodId, userId || null, id])
      } else if (hasUserEdit) {
        await rawRun("UPDATE stock_opname SET status='posted', updated_at=CURRENT_TIMESTAMP, user_edit=? WHERE id=?", [userId || null, id])
      } else if (hasPeriod) {
        await rawRun("UPDATE stock_opname SET status='posted', period_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [periodId, id])
      } else {
        await rawRun("UPDATE stock_opname SET status='posted', updated_at=CURRENT_TIMESTAMP WHERE id=?", [id])
      }

      await pool.query('COMMIT')
      return NextResponse.json({ ok: true, affected, inTotal, outTotal })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal posting dokumen' }, { status: 500 })
  }
}
