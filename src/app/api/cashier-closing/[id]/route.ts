import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'cashier_closing', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = Number(params.id)

    const closing = await rawGet(`SELECT * FROM cashier_closing WHERE id = ?`, [id]) as any
    if (!closing) {
      return NextResponse.json({ error: 'Closing not found' }, { status: 404 })
    }

    const txnIds = await rawAll(`
      SELECT id FROM transactions
      WHERE COALESCE(void,0) = 0
        AND user_create = ?
        AND (tgl_nota = ? OR created_at::date = ?)
      ORDER BY id ASC
    `, [closing.user_id, closing.tanggal, closing.tanggal]) as { id: number }[]

    const ids = txnIds.map(r => r.id)

    let transactions: any[] = []
    if (ids.length > 0) {
      const idsStr = ids.join(',')
      transactions = await rawAll(`
        SELECT id, transaction_number, total, payment_method, created_at
        FROM transactions
        WHERE id IN (${idsStr})
        ORDER BY id ASC
      `) as any[]
    }

    return NextResponse.json({
      ...closing,
      transactions
    })
  } catch (e: any) {
    console.error('GET /api/cashier-closing/[id] error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
