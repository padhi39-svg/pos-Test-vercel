import { NextRequest, NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'
import { getMidtransServerKey } from '@/lib/midtrans'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Midtrans webhook notification handler.
 * Midtrans sends POST requests to this endpoint when payment status changes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      order_id,
      transaction_status,
      status_code,
      gross_amount,
      signature_key,
    } = body

    // Verify signature
    const serverKey = await getMidtransServerKey()
    if (serverKey) {
      const expectedSignature = crypto
        .createHash('sha512')
        .update(order_id + status_code + gross_amount + serverKey)
        .digest('hex')

      if (signature_key !== expectedSignature) {
        console.error('Invalid Midtrans signature for order:', order_id)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
      }
    }

    // order_id is the self_orders.uid directly
    let paymentStatus = 'unpaid'
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      paymentStatus = 'paid'
    } else if (transaction_status === 'expire' || transaction_status === 'deny') {
      paymentStatus = 'cancelled'
    }

    await rawRun(
      `UPDATE self_orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE uid = $2`,
      [paymentStatus, order_id]
    )

    console.log(`Midtrans notification: order ${order_id} -> ${paymentStatus}`)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Midtrans notification error:', e)
    return NextResponse.json({ error: e?.message || 'Notification processing failed' }, { status: 500 })
  }
}
