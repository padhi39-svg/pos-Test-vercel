import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getCurrentUserServer } from '@/lib/auth'

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: 'POST this endpoint to delete sales transactions. Optional body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }',
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = getCurrentUserServer()
    if (!user) return NextResponse.json({ error: 'Forbidden: harus login' }, { status: 403 })

    const db = getDb()
    const pool = (db as any).$client

    // Optional filter by date range
    let body: any = {}
    try { body = await req.json() } catch {}
    const fromDate = typeof body?.from === 'string' ? body.from.trim() : null
    const toDate = typeof body?.to === 'string' ? body.to.trim() : null

    // Detect available related tables safely
    const tableExists = async (name: string): Promise<boolean> => {
      try {
        const row = await rawGet(`SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name=?`, [name])
        return !!row
      } catch {
        return false
      }
    }

    const hasItems = await tableExists('transaction_items')
    const hasPays = await tableExists('transaction_payments')
    const hasStockMov = await tableExists('stock_movements')

    // Build list of transaction ids to delete
    let ids: Array<{ id: number }> = []
    try {
      let sql = 'SELECT id FROM transactions WHERE 1=1'
      const conds: string[] = []
      const params: any[] = []
      if (fromDate) { conds.push('transaction_date >= ?::date'); params.push(fromDate) }
      if (toDate) { conds.push('transaction_date <= ?::date'); params.push(toDate) }
      if (conds.length) sql += ' AND ' + conds.join(' AND ')
      ids = await rawAll(sql, params) as Array<{ id: number }>
    } catch (e) {
      return NextResponse.json({ error: 'Gagal mengambil daftar transaksi untuk dihapus', details: (e as any)?.message }, { status: 500 })
    }

    let deletedCount = 0
    await pool.query('BEGIN')
    try {
      for (const row of ids) {
        const txId = Number(row.id)
        if (hasItems) {
          try { await rawRun('DELETE FROM transaction_items WHERE transaction_id = ?', [txId]) } catch {}
        }
        if (hasPays) {
          try { await rawRun('DELETE FROM transaction_payments WHERE transaction_id = ?', [txId]) } catch {}
        }
        if (hasStockMov) {
          try { await rawRun("DELETE FROM stock_movements WHERE reference_type = 'transaction' AND reference_id = ?", [txId]) } catch {}
        }
        const res = await rawRun('DELETE FROM transactions WHERE id = ?', [txId])
        if (res.rowCount > 0) deletedCount++
        try { await rawRun("DELETE FROM journal_entries WHERE source_type = 'Penjualan' AND source_id = ?", [txId]) } catch {}
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true, deleted: deletedCount })
  } catch (e: any) {
    console.error('POST /api/transactions/reset-sales error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal menghapus data penjualan' }, { status: 500 })
  }
}
