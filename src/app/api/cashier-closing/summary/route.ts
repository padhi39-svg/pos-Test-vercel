import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'cashier_closing', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    const tanggal = url.searchParams.get('tanggal')

    if (!userId || !tanggal) {
      return NextResponse.json({ error: 'userId and tanggal are required' }, { status: 400 })
    }

    const uid = Number(userId)
    if (!uid) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }

    const txnIds = await rawAll(`
      SELECT id FROM transactions
      WHERE COALESCE(void,0) = 0
        AND user_create = ?
        AND (tgl_nota = ? OR created_at::date = ?)
    `, [uid, tanggal, tanggal]) as { id: number }[]

    const ids = txnIds.map(r => r.id)
    const idsStr = ids.join(',')

    if (ids.length === 0) {
      const sudah = await rawGet(`SELECT COUNT(*) as cnt FROM cashier_closing WHERE user_id = ? AND tanggal = ?`, [uid, tanggal]) as any
      return NextResponse.json({
        total_penjualan: 0,
        total_tunai: 0,
        total_transfer: 0,
        total_kembalian: 0,
        jumlah_transaksi: 0,
        sudah_closing: (sudah?.cnt || 0) > 0
      })
    }

    const summaryTx = await rawGet(`
      SELECT COALESCE(SUM(total),0) as total_penjualan,
             COUNT(*) as jumlah_transaksi
      FROM transactions
      WHERE id IN (${idsStr})
    `) as any

    const summaryPay = await rawGet(`
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(method) IN ('cash','tunai') THEN amount ELSE 0 END),0) as total_tunai,
        COALESCE(SUM(CASE WHEN LOWER(method) NOT IN ('cash','tunai') THEN amount ELSE 0 END),0) as total_transfer,
        COALESCE(SUM(change_amount),0) as total_kembalian
      FROM transaction_payments
      WHERE transaction_id IN (${idsStr})
    `) as any

    const sudah = await rawGet(`SELECT COUNT(*) as cnt FROM cashier_closing WHERE user_id = ? AND tanggal = ?`, [uid, tanggal]) as any

    return NextResponse.json({
      total_penjualan: Number(summaryTx.total_penjualan),
      total_tunai: Number(summaryPay.total_tunai),
      total_transfer: Number(summaryPay.total_transfer),
      total_kembalian: Number(summaryPay.total_kembalian),
      jumlah_transaksi: Number(summaryTx.jumlah_transaksi),
      sudah_closing: (sudah?.cnt || 0) > 0
    })
  } catch (e: any) {
    console.error('GET /api/cashier-closing/summary error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
