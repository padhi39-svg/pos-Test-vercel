import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const receipt = await rawGet<any>(`SELECT * FROM goods_receipts WHERE id = ?`, [id])
    if (!receipt) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 })
    }
    const items = await rawAll<any>(`SELECT * FROM goods_receipt_items WHERE gr_id = ?`, [id])
    return NextResponse.json({ ...receipt, items })
  } catch (error: any) {
    console.error('Error fetching goods receipt:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
