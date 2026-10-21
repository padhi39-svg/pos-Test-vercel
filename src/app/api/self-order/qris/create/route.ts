import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawAll } from '@/db/raw'
import { createQrisCharge } from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const orderUid = String(body?.orderUid || '').trim()

    if (!orderUid) {
      return NextResponse.json({ error: 'orderUid wajib diisi' }, { status: 400 })
    }

    // Fetch order from database
    const order = await rawGet(
      `SELECT uid, order_number, total_price, payment_status FROM self_orders WHERE uid = $1`,
      [orderUid]
    ) as any

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Pesanan sudah lunas' }, { status: 400 })
    }

    // Fetch order items
    const items = await rawAll(
      `SELECT barang_id, barang_name, price, qty FROM self_order_items WHERE order_uid = $1 ORDER BY id ASC`,
      [orderUid]
    )

    // Build Midtrans item details
    const midtransItems = items.map((item: any) => ({
      id: String(item.barang_id),
      name: item.barang_name,
      price: Math.round(item.price),
      quantity: item.qty,
    }))

    // Use order uid as Midtrans order ID
    const midtransOrderId = order.uid

    const result = await createQrisCharge({
      orderId: midtransOrderId,
      grossAmount: Math.round(order.total_price),
      items: midtransItems,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      qrCodeUrl: result.qrCodeUrl,
      transactionId: result.transactionId,
      midtransOrderId,
    })
  } catch (e: any) {
    console.error('Error creating QRIS charge:', e)
    return NextResponse.json({ error: e?.message || 'Gagal membuat QRIS' }, { status: 500 })
  }
}
