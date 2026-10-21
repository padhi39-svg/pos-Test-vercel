import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun, withTransaction } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'stock_usage', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat pemakaian stok' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''

    const pool = (getDb() as any).$client
    addAuditColumns(pool)
    const userId = getUserId(req)

    const tables = await rawAll<{name:string}>("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public'")
    const tableNames = tables.map(t => t.name)
    const whTable = (['gudang','warehouses','warehouse','master_gudang','gudangs'].find(n => tableNames.includes(n)) )
    let rows: any[] = []
    if (whTable) {
      const cols = await rawAll<any>(`SELECT column_name as name FROM information_schema.columns WHERE table_name = $1`, [whTable])
      const has = (n:string)=> cols.some((c: any) => String(c.name).toLowerCase()===n)
      const nameCol = has('name') ? 'name' : (has('nama') ? 'nama' : 'name')
      const params: any[] = []
      if (start) params.push(start)
      if (end) params.push(end)
      let paramIdx = 0
      const sql = `
        SELECT su.id, su.number, su.tdate as tdate, su.warehouse_id, su.notes, su.status, su.void, su.user_create, su.user_edit, su.created_at, su.updated_at, su.period_id, w.${nameCol} as warehouse
        FROM stock_usage su
        LEFT JOIN ${whTable} w ON w.id = su.warehouse_id
        WHERE 1=1
          ${start ? `AND su.tdate >= $${++paramIdx}` : ''}
          ${end ? `AND su.tdate <= $${++paramIdx}` : ''}
        ORDER BY su.id DESC
        LIMIT 500`
      rows = await rawAll<any>(sql, params.length > 0 ? params : undefined)
    } else {
      const params2: any[] = []
      if (start) params2.push(start)
      if (end) params2.push(end)
      let pIdx = 0
      rows = await rawAll<any>(`
        SELECT su.id, su.number, su.tdate as tdate, su.warehouse_id, su.notes, su.status, su.void, su.user_create, su.user_edit, su.created_at, su.updated_at, su.period_id
        FROM stock_usage su
        WHERE 1=1
          ${start ? `AND su.tdate >= $${++pIdx}` : ''}
          ${end ? `AND su.tdate <= $${++pIdx}` : ''}
        ORDER BY su.id DESC
        LIMIT 500
      `, params2.length > 0 ? params2 : undefined)
    }
    const filtered = q
      ? rows.filter(r => `${r.number} ${r.warehouse} ${r.notes}`.toLowerCase().includes(q))
      : rows
    return NextResponse.json({ rows: filtered })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to load stock usage' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'stock_usage', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat pemakaian stok' }, { status: 403 })
    }
    const body = await req.json()
    const { tdate, warehouse_id, notes, items } = body || {}
    if (!tdate) return NextResponse.json({ error: 'Tanggal wajib' }, { status: 400 })
    if (!warehouse_id) return NextResponse.json({ error: 'Gudang wajib' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Detail belum diisi' }, { status: 400 })

    const pool = (getDb() as any).$client
    addAuditColumns(pool)
    const userId = getUserId(req)

    const today = String(tdate).slice(0,10)
    const prefix = 'SU/' + today.slice(0,4) + '/'
    const last = await rawGet<any>('SELECT number FROM stock_usage WHERE number LIKE $1 ORDER BY id DESC LIMIT 1', [prefix + '%'])
    const nextNo = (()=>{
      if (!last?.number) return prefix + '000001'
      const seq = parseInt(String(last.number).slice(-6)) + 1
      return prefix + String(seq).padStart(6,'0')
    })()

    const suPeriod = await getPeriodByDate(today)
    if (!suPeriod) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${today}.` }, { status: 400 })
    }
    if (Number(suPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${suPeriod.name}' sudah ditutup.` }, { status: 400 })
    }
    const periodId = suPeriod.id

    const { id: usageId, number: nextNumber } = await withTransaction(async (q) => {
      const cols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_usage'")
      const rows = cols || []
      const colNames = rows.map((c: any) => String(c.name || c.column_name).toLowerCase())
      const has = (n: string) => colNames.includes(n)
      const hasUserCreate = has('user_create')
      const hasPeriod = has('period_id')

      let r: any
      if (hasUserCreate && hasPeriod) {
        r = await q('INSERT INTO stock_usage(number, tdate, warehouse_id, notes, user_create, period_id, status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [nextNo, today, Number(warehouse_id), notes || null, userId || null, periodId, 'draft'])
      } else if (hasUserCreate) {
        r = await q('INSERT INTO stock_usage(number, tdate, warehouse_id, notes, user_create, status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [nextNo, today, Number(warehouse_id), notes || null, userId || null, 'draft'])
      } else if (hasPeriod) {
        r = await q('INSERT INTO stock_usage(number, tdate, warehouse_id, notes, period_id, status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [nextNo, today, Number(warehouse_id), notes || null, periodId, 'draft'])
      } else {
        r = await q('INSERT INTO stock_usage(number, tdate, warehouse_id, notes, status) VALUES($1,$2,$3,$4,$5) RETURNING id', [nextNo, today, Number(warehouse_id), notes || null, 'draft'])
      }
      const usageId = r[0].id

      const buCols = await q("SELECT column_name as name FROM information_schema.columns WHERE table_name='barang_units'")
      const buRows = buCols || []
      const buNames = buRows.map((c: any) => String(c.name || c.column_name).toLowerCase())
      const buHas = (n: string) => buNames.includes(n)
      const ratioCol = buHas('unit_ratio') ? 'unit_ratio' : (buHas('ratio') ? 'ratio' : 'unit_ratio')

      const getUnit = async (barangId: number, unitId: number) => {
        const res = await q(`SELECT id, ${ratioCol} as unit_ratio FROM barang_units WHERE barang_id=$1 AND id=$2`, [barangId, unitId])
        return res?.[0] || null
      }
      const getDefaultUnit = async (barangId: number) => {
        const res = await q(`
          SELECT id, ${ratioCol} as unit_ratio FROM barang_units
          WHERE barang_id=$1
          ORDER BY CASE WHEN COALESCE(${ratioCol},1)=1 THEN 0 ELSE 1 END, id LIMIT 1
        `, [barangId])
        return res?.[0] || null
      }

      for (const it of items) {
        const barangId = Number(it.barang_id)
        let qty = Number(it.qty || 0)
        if (!barangId || qty <= 0) throw new Error('Detail tidak valid')
        let unitId = it.unit_id ? Number(it.unit_id) : null
        let unitRatio = 1
        if (unitId) {
          const u = await getUnit(barangId, unitId)
          if (u) unitRatio = Number(u.unit_ratio || 1) || 1
          else unitId = null
        }
        if (!unitId) {
          const u = await getDefaultUnit(barangId)
          if (!u) throw new Error(`Satuan master tidak ditemukan untuk barang ID ${barangId}`)
          unitId = Number(u.id)
          unitRatio = Number(u.unit_ratio || 1) || 1
        }
        const baseQty = qty * unitRatio
        await q('INSERT INTO stock_usage_items(usage_id, barang_id, qty, unit_id, unit_ratio, qty_total) VALUES($1,$2,$3,$4,$5,$6)', [usageId, barangId, qty, unitId, unitRatio, baseQty])
      }

      try {
        const suEntries = await generateEntriesForSingleSource('Pemakaian Stok', nextNo, today)
        if (suEntries.length > 0) {
          await saveJournalEntriesForSource('Pemakaian Stok', usageId, nextNo, today, suEntries)
        }
      } catch (e) {
        console.warn('[Stock Usage] failed to save journal entries:', e)
      }

      return { id: usageId, number: nextNo }
    })

    return NextResponse.json({ id: usageId, number: nextNumber })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to save usage' }, { status: 500 })
  }
}
