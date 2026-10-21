import { NextRequest, NextResponse } from 'next/server'
import { withTransaction } from '@/db/raw'

export const dynamic = 'force-dynamic'

function generateUid(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let uid = ''
  for (let i = 0; i < 12; i++) {
    uid += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return uid
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mejaId: number | null = body.mejaId || null
    const items: { barangId: number; barangName: string; price: number; qty: number }[] = body.items || []

    if (!items.length) {
      return NextResponse.json({ error: 'No items' }, { status: 400 })
    }

    const result = await withTransaction(async (query) => {
      const uid = generateUid()
      const totalPrice = items.reduce((sum, item) => sum + item.price * item.qty, 0)
      const now = Math.floor(Date.now() / 1000)

      // Get today's order_number (reset every day)
      const todayStart = Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000)
      const todayResult = await query(
        `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_id FROM self_orders WHERE order_date >= $1`,
        [todayStart],
      )
      const orderNumber = todayResult[0].next_id

      await query(
        `INSERT INTO self_orders (uid, order_number, order_date, meja_id, total_price, payment_status, status)
         VALUES ($1, $2, $3, $4, $5, 'unpaid', 'pending')`,
        [uid, orderNumber, now, mejaId, totalPrice],
      )

      for (const item of items) {
        const subtotal = item.price * item.qty
        await query(
          `INSERT INTO self_order_items (order_uid, barang_id, barang_name, price, qty, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uid, item.barangId, item.barangName, item.price, item.qty, subtotal],
        )
      }

      return { uid, orderNumber, totalPrice }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Error creating self-order:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create order' }, { status: 500 })
  }
}
