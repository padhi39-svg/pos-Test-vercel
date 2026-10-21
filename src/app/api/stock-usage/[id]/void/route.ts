import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { getPeriodByDate } from '@/lib/period'
import { deleteJournalEntriesForSource } from '@/lib/journalHelpers'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    await addAuditColumns()
    const header = await rawGet<any>('SELECT * FROM stock_usage WHERE id=?', [id])
    if (!header) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    if (Number(header.void || 0) === 1) return NextResponse.json({ ok: true, message: 'Sudah void' })

    const voidSuPeriod = await getPeriodByDate(String(header.tdate || '').slice(0,10))
    if (voidSuPeriod && Number(voidSuPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${voidSuPeriod.name}' sudah ditutup, tidak dapat void.` }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client
    await pool.query('BEGIN')
    try {
      const items = await rawAll<any[]>('SELECT barang_id, qty_total FROM stock_usage_items WHERE usage_id=?', [id])

      for (const it of items) {
        const curr = await rawGet<any>('SELECT quantity FROM stock_balance WHERE ingredient_id=? AND warehouse_id=?', [it.barang_id, header.warehouse_id])
        const qty = Number(curr?.quantity || 0) + Number(it.qty_total || 0)
        if (curr) {
          await rawRun('UPDATE stock_balance SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE ingredient_id=? AND warehouse_id=?', [qty, it.barang_id, header.warehouse_id])
        } else {
          await rawRun('INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity) VALUES(?,?,?)', [it.barang_id, header.warehouse_id, qty])
        }
      }

      await rawRun("DELETE FROM stock_movements WHERE reference_type='usage' AND reference_id=?", [id])

      try {
        const cols = await rawAll<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_usage' AND table_schema = 'public'"
        )
        const has = (n:string)=> cols.some(c=> String(c.column_name).toLowerCase()===n)
        if (!has('user_void')) await rawRun('ALTER TABLE stock_usage ADD COLUMN user_void INTEGER')
      } catch {}
      const userId = getUserId(req)
      const cols2 = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_usage' AND table_schema = 'public'"
      )
      const has2 = (n:string)=> cols2.some(c=> String(c.column_name).toLowerCase()===n)
      if (has2('user_void')){
        await rawRun('UPDATE stock_usage SET void=1, user_void=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [userId || null, id])
      } else {
        await rawRun('UPDATE stock_usage SET void=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id])
      }

      try {
        await deleteJournalEntriesForSource('Pemakaian Stok', id)
      } catch (e) {
        console.warn('[Stock Usage Void] failed to delete journal entries:', e)
      }
      await pool.query('COMMIT')
      return NextResponse.json({ ok: true })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to void usage' }, { status: 500 })
  }
}
