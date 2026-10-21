import { NextRequest, NextResponse } from 'next/server'
import { getInventoryValuation } from '@/lib/repositories/stock-reports'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const endDate = searchParams.get('endDate') || new Date().toISOString().slice(0, 10)
    const warehouseIdParam = searchParams.get('warehouseId')
    const warehouseId = warehouseIdParam ? Number(warehouseIdParam) : null
    const result = await getInventoryValuation(endDate, warehouseId)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to build inventory valuation report', details: error?.message }, { status: 500 })
  }
}
