import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getUserId } from '@/lib/audit'
import { recalcHPP } from '@/app/api/recalc/route'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'periode', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menutup periode' }, { status: 403 })
    }
    const db = getDb()
    const pool = (db as any).$client
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const body = await req.json().catch(() => ({} as any))
    const rejectDrafts = Boolean(body?.rejectDrafts)

    const periode = await rawGet<any>('SELECT id, name, start_date, end_date, status_buku FROM master_periode WHERE id = $1 AND isdelete = 0', [id])
    if (!periode) return NextResponse.json({ error: 'Periode tidak ditemukan' }, { status: 404 })
    if (String(periode.status_buku || '').toUpperCase() === 'CLOSED') {
      return NextResponse.json({ error: 'Periode sudah ditutup' }, { status: 400 })
    }

    const userId = getUserId(req)

    // Finalisasi HPP & stok SEBELUM periode dikunci: rekalkulasi berurutan
    // dari periode terawal yang belum ditutup sampai periode ini.
    // recalcHPP menolak periode CLOSED, jadi harus dijalankan sebelum set CLOSED.
    const toClose = await rawAll<any>(
      `SELECT id FROM master_periode
       WHERE isdelete = 0 AND DATE(end_date) <= DATE($1)
         AND COALESCE(status_buku, 'OPEN') <> 'CLOSED'
       ORDER BY start_date ASC`,
      [periode.end_date]
    )
    for (const pc of toClose) {
      await recalcHPP(db, Number(pc.id))
    }

    await pool.query('BEGIN')
    try {
      await pool.query(
        `UPDATE master_periode
         SET status_buku = 'CLOSED', updated_at = CURRENT_TIMESTAMP, user_edit = $1
         WHERE isdelete = 0 AND DATE(end_date) <= DATE($2)`,
        [userId, periode.end_date]
      )

      if (rejectDrafts) {
        const tableExists = async (name: string) => {
          const r = await rawGet<any>("SELECT 1 FROM information_schema.tables WHERE table_name = $1", [name])
          return !!r
        }
        const rejectInTableByDate = async (table: string, dateCol: string, statusCol: string, draftVal: string, rejectedVal: string) => {
          if (!(await tableExists(table))) return
          await pool.query(
            `UPDATE ${table}
             SET ${statusCol} = $1, updated_at = CURRENT_TIMESTAMP
             WHERE ${statusCol} = $2 AND DATE(${dateCol}) <= DATE($3)`,
            [rejectedVal, draftVal, periode.end_date]
          )
        }
        await rejectInTableByDate('transactions', 'tgl_nota', 'status', 'draft', 'rejected')
        await rejectInTableByDate('purchase_orders', 'created_at', 'status', 'draft', 'rejected')
        await rejectInTableByDate('purchases', 'created_at', 'status', 'draft', 'rejected')
        await rejectInTableByDate('purchase_requests', 'created_at', 'status', 'draft', 'rejected')
        await rejectInTableByDate('stock_usages', 'created_at', 'status', 'draft', 'rejected')
        await rejectInTableByDate('stock_opnames', 'created_at', 'status', 'draft', 'rejected')
      }

      const balTable = await rawGet<any>("SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_balance'")
      if (balTable) {
        const rows = await rawAll<any>(
          'SELECT ingredient_id AS barang_id, SUM(quantity) AS qty FROM stock_balance GROUP BY ingredient_id'
        )
        for (const r of rows) {
          const qty = Number(r.qty) || 0
          const barangId = Number(r.barang_id) || 0
          if (barangId > 0) {
            await pool.query(
              `INSERT INTO stock_period_snapshots (periode_id, barang_id, qty_base_unit, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (periode_id, barang_id) DO UPDATE SET qty_base_unit = $3`,
              [id, barangId, qty]
            )
          }
        }
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/periode/[id]/close error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal menutup periode' }, { status: 500 })
  }
}
