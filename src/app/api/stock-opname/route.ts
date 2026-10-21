import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

async function nextNumber(dateStr: string) {
  const year = String(dateStr).slice(0,4)
  const prefix = `DSO/${year}/`
  const last = await rawGet<any>('SELECT number FROM stock_opname WHERE number LIKE $1 ORDER BY id DESC LIMIT 1', [prefix + '%'])
  if (!last?.number) return prefix + '000001'
  const seq = parseInt(String(last.number).slice(-6)) + 1
  return prefix + String(seq).padStart(6, '0')
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'stock_draftopname', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat draft opname' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()
    const status = searchParams.get('status') || ''
    const wh = searchParams.get('warehouse_id') || ''

    const pool = (getDb() as any).$client
    addAuditColumns(pool)

    let rows = await rawAll<any>('SELECT * FROM stock_opname ORDER BY id DESC LIMIT 500')

    if (q) {
      rows = rows.filter(r => `${r.number||''} ${r.notes||''}`.toLowerCase().includes(q))
    }
    if (status) {
      rows = rows.filter(r => String(r.status||'').toLowerCase()===String(status).toLowerCase())
    }
    if (wh) {
      rows = rows.filter(r => Number(r.warehouse_id)===Number(wh))
    }

    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat daftar opname' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'stock_draftopname', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat draft opname' }, { status: 403 })
    }
    const pool = (getDb() as any).$client
    addAuditColumns(pool)
    const userId = getUserId(req)
    const body = await req.json()
    const { tdate, warehouse_id, notes, items } = body || {}
    let assignees: number[] = []
    if (Array.isArray(body?.assignees)) {
      assignees = Array.from(new Set(body.assignees.map((x:any)=>Number(x)).filter((n:number)=>Number.isFinite(n) && n>0)))
    }

    if (!tdate) return NextResponse.json({ error: 'Tanggal wajib' }, { status: 400 })
    if (!warehouse_id) return NextResponse.json({ error: 'Gudang wajib' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Detail item kosong' }, { status: 400 })

    const dateOnly = String(tdate).slice(0,10)
    const number = await nextNumber(dateOnly)
    const getPeriodByDateLocal = async (dt:string)=>{
      try{
        const p = await rawGet<any>('SELECT id FROM master_periode WHERE $1::date BETWEEN start_date::date AND end_date::date AND COALESCE(isdelete, 0) = 0 ORDER BY id DESC LIMIT 1', [dt])
        if (p?.id) return Number(p.id)
      }catch{}
      try{
        const p = await rawGet<any>('SELECT id FROM master_periode WHERE is_active=1 ORDER BY id DESC LIMIT 1')
        if (p?.id) return Number(p.id)
      }catch{}
      return null
    }
    const periodId = await getPeriodByDateLocal(dateOnly)

    if (!periodId) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${dateOnly}.` }, { status: 400 })
    }
    const soPeriod = await rawGet<any>('SELECT id, name, is_closed, status_buku FROM master_periode WHERE id = $1', [periodId])
    if (soPeriod) {
      const closed = soPeriod?.status_buku ? (String(soPeriod.status_buku).toUpperCase() === 'CLOSED' ? 1 : 0) : Number(soPeriod.is_closed)
      if (closed === 1) {
        return NextResponse.json({ error: `Periode '${soPeriod.name}' sudah ditutup.` }, { status: 400 })
      }
    }

    try {
      const colsSO = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_opname'")
      const hasVoid = colsSO.some((c: any)=> String(c.name).toLowerCase()==='void')
      const hasStatus = colsSO.some((c: any)=> String(c.name).toLowerCase()==='status')
      for (const it of items){
        const barangId = Number(it.barang_id)
        if (!barangId) continue
        let row: any = null
        if (hasVoid) {
          row = await rawGet<any>(`SELECT so.id AS other_id, so.number
            FROM stock_opname so
            JOIN stock_opname_items soi ON soi.opname_id = so.id
            WHERE so.period_id IS NOT NULL AND so.period_id = $1
              AND COALESCE(so.void,0) = 0
              AND so.warehouse_id = $2
              AND soi.barang_id = $3
            LIMIT 1`, [periodId, Number(warehouse_id), barangId])
        } else if (hasStatus) {
          row = await rawGet<any>(`SELECT so.id AS other_id, so.number
            FROM stock_opname so
            JOIN stock_opname_items soi ON soi.opname_id = so.id
            WHERE so.period_id IS NOT NULL AND so.period_id = $1
              AND LOWER(COALESCE(so.status,'')) <> 'void'
              AND so.warehouse_id = $2
              AND soi.barang_id = $3
            LIMIT 1`, [periodId, Number(warehouse_id), barangId])
        }
        if (row && row.other_id){
          return NextResponse.json({ error: `Barang sudah ada di opname ${row.number} pada periode yang sama. Void dokumen tersebut atau hapus itemnya terlebih dahulu.` }, { status: 400 })
        }
      }
    } catch {}

    await pool.query('BEGIN')
    try {
      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_opname'")
      const has = (n:string)=> cols.some((c: any)=> String(c.name).toLowerCase()===n)
      const hasAssignees = has('assignees')
      const hasUserCreate = has('user_create')
      const hasPeriod = has('period_id')

      let r: any
      if (hasUserCreate && hasAssignees && hasPeriod){
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status, assignees, user_create, period_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft', JSON.stringify(assignees), userId || null, periodId])
      } else if (hasUserCreate && hasAssignees){
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status, assignees, user_create) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft', JSON.stringify(assignees), userId || null])
      } else if (hasUserCreate && hasPeriod){
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status, user_create, period_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft', userId || null, periodId])
      } else if (hasAssignees && hasPeriod){
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status, assignees, period_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft', JSON.stringify(assignees), periodId])
      } else if (hasAssignees){
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status, assignees) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft', JSON.stringify(assignees)])
      } else if (hasPeriod){
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status, period_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft', periodId])
      } else {
        r = await pool.query(`INSERT INTO stock_opname(number, tdate, warehouse_id, notes, status) VALUES($1,$2,$3,$4,$5) RETURNING id`, [number, dateOnly, Number(warehouse_id), notes || null, 'draft'])
      }
      const opnameId = r.rows[0].id

      for (const it of items) {
        const barangId = Number(it.barang_id)
        const sysQty = Number(it.system_qty || 0)
        if (!barangId) throw new Error('Item tidak valid')
        await rawRun('INSERT INTO stock_opname_items(opname_id, barang_id, system_qty, count_qty, variance_qty, unit_id_default, notes) VALUES($1,$2,$3,$4,$5,$6,$7)', [opnameId, barangId, sysQty, null, null, null, null])
      }
      await pool.query('COMMIT')
      return NextResponse.json({ id: opnameId, number })
    } catch (e: any) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal membuat draft opname' }, { status: 500 })
  }
}
