import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'stock_draftopname', 'view') && !hasPermission(_req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat draft opname' }, { status: 403 })
    }
    const id = Number(params.id)
    const pool = (getDb() as any).$client
    addAuditColumns(pool)

    const header = await rawGet<any>('SELECT * FROM stock_opname WHERE id=$1', [id])
    if (!header) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const items = await rawAll<any>(`
      SELECT i.*, mb.code as barang_code, mb.name as barang_name
      FROM stock_opname_items i
      LEFT JOIN master_barang mb ON mb.id = i.barang_id
      WHERE i.opname_id = $1
      ORDER BY mb.code, mb.name
    `, [id])

    const sessions = await rawAll<any>('SELECT * FROM stock_opname_sessions WHERE opname_id=$1 ORDER BY id DESC', [id])

    const counts = await rawAll<any>(`
      SELECT c.session_id, COUNT(*)::int as lines, SUM(c.qty_base) as qty_base
      FROM stock_opname_counts c
      WHERE c.opname_id=$1
      GROUP BY c.session_id
      ORDER BY c.session_id
    `, [id])

    return NextResponse.json({ header, items, sessions, counts })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat detail opname' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'stock_draftopname', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah draft opname' }, { status: 403 })
    }
    const id = Number(params.id)
    const pool = (getDb() as any).$client

    const body = await req.json().catch(()=>({}))
    const userId = getUserId(req)
    const { tdate, warehouse_id, notes, items } = body || {}
    if (!tdate) return NextResponse.json({ error: 'Tanggal wajib' }, { status: 400 })
    if (!warehouse_id) return NextResponse.json({ error: 'Gudang wajib' }, { status: 400 })
    if (!Array.isArray(items) || items.length===0) return NextResponse.json({ error: 'Detail item kosong' }, { status: 400 })

    const hdr = await rawGet<any>('SELECT id FROM stock_opname WHERE id=$1', [id])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const soPeriod = await getPeriodByDate(String(tdate).slice(0,10))
    if (!soPeriod) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${String(tdate).slice(0,10)}.` }, { status: 400 })
    }
    if (Number(soPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${soPeriod.name}' sudah ditutup.` }, { status: 400 })
    }
    const periodId = soPeriod.id

    try{
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
              AND so.id <> $2
              AND so.warehouse_id = $3
              AND soi.barang_id = $4
            LIMIT 1`, [periodId, id, Number(warehouse_id), barangId])
        } else if (hasStatus) {
          row = await rawGet<any>(`SELECT so.id AS other_id, so.number
            FROM stock_opname so
            JOIN stock_opname_items soi ON soi.opname_id = so.id
            WHERE so.period_id IS NOT NULL AND so.period_id = $1
              AND LOWER(COALESCE(so.status,'')) <> 'void'
              AND so.id <> $2
              AND so.warehouse_id = $3
              AND soi.barang_id = $4
            LIMIT 1`, [periodId, id, Number(warehouse_id), barangId])
        }
        if (row && row.other_id){
          return NextResponse.json({ error: `Barang sudah ada di opname ${row.number} pada periode yang sama. Void dokumen tersebut atau hapus itemnya terlebih dahulu.` }, { status: 400 })
        }
      }
    }catch{}

    await pool.query('BEGIN')
    try {
      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_opname'")
      const has = (n:string)=> cols.some((c: any)=> String(c.name).toLowerCase()===n)
      const hasUserEdit = has('user_edit')
      const hasUpdatedAt = has('updated_at')
      if (hasUserEdit && hasUpdatedAt) {
        await rawRun('UPDATE stock_opname SET tdate=$1, warehouse_id=$2, notes=$3, updated_at=NOW(), user_edit=$4 WHERE id=$5', [String(tdate).slice(0,10), Number(warehouse_id), notes || null, userId || null, id])
      } else if (hasUserEdit) {
        await rawRun('UPDATE stock_opname SET tdate=$1, warehouse_id=$2, notes=$3, user_edit=$4 WHERE id=$5', [String(tdate).slice(0,10), Number(warehouse_id), notes || null, userId || null, id])
      } else if (hasUpdatedAt) {
        await rawRun('UPDATE stock_opname SET tdate=$1, warehouse_id=$2, notes=$3, updated_at=NOW() WHERE id=$4', [String(tdate).slice(0,10), Number(warehouse_id), notes || null, id])
      } else {
        await rawRun('UPDATE stock_opname SET tdate=$1, warehouse_id=$2, notes=$3 WHERE id=$4', [String(tdate).slice(0,10), Number(warehouse_id), notes || null, id])
      }

      const existing = await rawAll<any>('SELECT id, barang_id, count_qty, variance_qty FROM stock_opname_items WHERE opname_id=$1', [id])
      const map = new Map<number, any>()
      existing.forEach(r => map.set(Number(r.barang_id), r))

      const incomingIds = new Set<number>()
      const itemCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_opname_items'")
      const itemHasUpdatedAt = itemCols.some((c: any)=> String(c.name).toLowerCase()==='updated_at')
      const updSql = itemHasUpdatedAt
        ? 'UPDATE stock_opname_items SET system_qty=$1, updated_at=NOW() WHERE id=$2'
        : 'UPDATE stock_opname_items SET system_qty=$1 WHERE id=$2'

      for (const it of items) {
        const barangId = Number(it.barang_id)
        const sysQty = Number(it.system_qty || 0)
        if (!barangId) throw new Error('Item tidak valid')
        incomingIds.add(barangId)
        const ex = map.get(barangId)
        if (ex) {
          await rawRun(updSql, [sysQty, ex.id])
        } else {
          await rawRun('INSERT INTO stock_opname_items(opname_id, barang_id, system_qty, count_qty, variance_qty, unit_id_default, notes) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, barangId, sysQty, null, null, null, null])
        }
      }

      for (const ex of existing) {
        if (!incomingIds.has(Number(ex.barang_id))) {
          await rawRun('DELETE FROM stock_opname_items WHERE opname_id=$1 AND barang_id=$2', [id, ex.barang_id])
        }
      }
      await pool.query('COMMIT')
      return NextResponse.json({ ok: true })
    } catch (e:any) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal memperbarui draft opname' }, { status: 500 })
  }
}
