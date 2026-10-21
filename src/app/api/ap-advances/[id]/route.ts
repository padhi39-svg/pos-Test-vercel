import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource, deleteJournalEntriesForSource } from '@/lib/journalHelpers'

const pool = (getDb() as any).$client

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ap_advances (
      id SERIAL PRIMARY KEY,
      kode_nota TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      supplier_id INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      total_amount REAL NOT NULL DEFAULT 0,
      period_id INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_ap_adv_number UNIQUE (kode_nota)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ap_advance_lines (
      id SERIAL PRIMARY KEY,
      ap_advance_id INTEGER NOT NULL,
      line_no INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      notes TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ap_advance_id) REFERENCES ap_advances(id) ON DELETE CASCADE
    )
  `)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTables()
    const id = Number(params.id)
    const hdr = await rawGet<any>(`
      SELECT ap.*, s.code as supplier_code, s.name as supplier_name
      FROM ap_advances ap
      LEFT JOIN master_supplier s ON s.id = ap.supplier_id
      WHERE ap.id = $1
    `, [id])
    if (!hdr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const det = await rawAll<any>('SELECT id, line_no, account_id, account_code, notes, amount FROM ap_advance_lines WHERE ap_advance_id = $1 ORDER BY line_no', [id])
    return NextResponse.json({ ...hdr, detail: det })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message||'Failed to fetch AP advance' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTables()
    const id = Number(params.id)
    const body = await req.json().catch(()=>({}))
    const action = String(body?.action||'').toLowerCase()

    const hdr = await rawGet<any>('SELECT status FROM ap_advances WHERE id = $1', [id])
    if (!hdr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'void') {
      if (String(hdr.status) === 'void') return NextResponse.json({ id, status: 'void' })
      const userId = getUserId(req)
      await rawRun("UPDATE ap_advances SET status='void', user_edit=$1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [userId || null, id])
      try { deleteJournalEntriesForSource('Uang Muka Supplier', id) } catch {}
      return NextResponse.json({ id, status: 'void' })
    }

    if (String(hdr.status) === 'void') return NextResponse.json({ error: 'Tidak dapat mengubah transaksi VOID' }, { status: 400 })

    const canBackdate = await getAllowBackdate(pool) || hasPermission(req as any, 'keu_uang_muka_supplier', 'backdate')
    const tanggal = canBackdate && body?.tanggal ? String(body.tanggal).slice(0,10) : undefined
    const supplier_id = (body?.supplier_id ?? body?.partnerId) !== undefined
      ? Number((body?.supplier_id ?? body?.partnerId) || 0) : undefined
    const notes = body?.notes !== undefined ? String(body?.notes||'') : undefined
    const detail = Array.isArray(body?.detail) ? body.detail : null
    const userId = getUserId(req)

    await pool.query('BEGIN')
    try {
      if (tanggal !== undefined || supplier_id !== undefined || notes !== undefined) {
        await rawRun(`UPDATE ap_advances SET tanggal = COALESCE($1, tanggal), supplier_id = COALESCE($2, supplier_id), notes = COALESCE($3, notes), user_edit = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
          [tanggal, supplier_id, notes, userId || null, id])
      }
      if (detail) {
        const total_amount = detail.reduce((a:number,b:any)=> a + (Number(b.amount)||Number(b.nominal)||0), 0)
        await rawRun(`UPDATE ap_advances SET total_amount = $1, user_edit = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`, [total_amount, userId || null, id])
        await rawRun(`DELETE FROM ap_advance_lines WHERE ap_advance_id = $1`, [id])

        for (let idx = 0; idx < detail.length; idx++) {
          const d = detail[idx]
          const amt = Number(d.amount || d.nominal || 0)
          await rawRun(`
            INSERT INTO ap_advance_lines (ap_advance_id, advance_id, line_no, account_id, account_code, amount, notes, created_at, updated_at)
            VALUES ($1, $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [id, idx + 1, Number(d.account_id||0), String(d.account_code||''), amt, String(d.notes||'')])
        }
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    // Re-generate journal entries for edited AP advance
    try {
      const advRow = await rawGet<any>('SELECT id, kode_nota, tanggal FROM ap_advances WHERE id = $1', [id])
      if (advRow) {
        deleteJournalEntriesForSource('Uang Muka Supplier', id)
        const entries = await generateEntriesForSingleSource('Uang Muka Supplier', advRow.kode_nota || '', advRow.tanggal || '')
        if (entries.length > 0) {
          await saveJournalEntriesForSource('Uang Muka Supplier', id, advRow.kode_nota || '', advRow.tanggal || '', entries)
        }
      }
    } catch (e) { console.warn('[AP Advance Edit] journal:', e) }

    return NextResponse.json({ id, status: 'active' })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message||'Failed to update AP advance' }, { status: 500 })
  }
}
