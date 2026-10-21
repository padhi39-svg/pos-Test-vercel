import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params
    if (!uid) {
      return NextResponse.json({ error: 'Invalid uid' }, { status: 400 })
    }

    const orders = await rawAll(
      `SELECT o.uid, o.order_number, o.total_price, o.payment_status, o.status, o.notes, o.created_at, o.updated_at,
              o.meja_id, m.name AS meja_name
       FROM self_orders o
       LEFT JOIN master_meja m ON m.id = o.meja_id
       WHERE o.uid = $1`,
      [uid],
    )
    if (!orders.length) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const order = orders[0]

    const items = await rawAll(
      `SELECT id, barang_id, barang_name, price, qty, subtotal
       FROM self_order_items WHERE order_uid = $1 ORDER BY id ASC`,
      [uid],
    )

    return NextResponse.json({ ...order, items })
  } catch (e: any) {
    console.error('Error fetching self-order:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params
    if (!uid) {
      return NextResponse.json({ error: 'Invalid uid' }, { status: 400 })
    }

    const body = await req.json()
    const updates: string[] = []
    const values: any[] = []

    if (body.payment_status) {
      updates.push(`payment_status = $${values.length + 1}`)
      values.push(body.payment_status)
    }
    if (body.status) {
      updates.push(`status = $${values.length + 1}`)
      values.push(body.status)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    values.push(uid)
    await rawRun(
      `UPDATE self_orders SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE uid = $${values.length}`,
      values,
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Error updating self-order:', e)
    return NextResponse.json({ error: e?.message || 'Failed to update order' }, { status: 500 })
  }
}
