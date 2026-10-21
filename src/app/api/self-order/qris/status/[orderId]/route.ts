import { NextRequest, NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'
import { checkQrisStatus } from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json({ error: 'orderId wajib diisi' }, { status: 400 })
    }

    // Check status from Midtrans
    const result = await checkQrisStatus(orderId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // If paid, update self_orders status
    if (result.status === 'settlement' || result.status === 'capture') {
      await rawRun(
        `UPDATE self_orders SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE uid = $1`,
        [orderId]
      )
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      isPaid: result.status === 'settlement' || result.status === 'capture',
    })
  } catch (e: any) {
    console.error('Error checking QRIS status:', e)
    return NextResponse.json({ error: e?.message || 'Gagal cek status' }, { status: 500 })
  }
}
