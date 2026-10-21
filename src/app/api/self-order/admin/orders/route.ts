import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const orders = await rawAll(
      `SELECT o.uid, o.order_number, o.total_price, o.payment_status, o.status, o.notes, o.created_at,
              o.meja_id, m.name AS meja_name
       FROM self_orders o
       LEFT JOIN master_meja m ON m.id = o.meja_id
       ORDER BY o.created_at DESC
       LIMIT 100`
    )

    const uids = orders.map((o: any) => o.uid)
    let itemsMap: Record<string, any[]> = {}
    if (uids.length > 0) {
      const items = await rawAll(
        `SELECT order_uid, barang_id, barang_name, price, qty, subtotal
         FROM self_order_items
         WHERE order_uid = ANY($1)
         ORDER BY id ASC`,
        [uids]
      )
      for (const item of items) {
        if (!itemsMap[item.order_uid]) itemsMap[item.order_uid] = []
        itemsMap[item.order_uid].push(item)
      }
    }

    const result = orders.map((o: any) => ({
      ...o,
      items: itemsMap[o.uid] || [],
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Error fetching self orders:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch orders' }, { status: 500 })
  }
}
