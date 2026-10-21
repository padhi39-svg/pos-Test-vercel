import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getSalesIngredientReport } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'sales_vs_usage', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat laporan Penjualan vs Pemakaian' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const transactionNumber = searchParams.get('transaction_number') || undefined

    const rows = await getSalesIngredientReport(from, to, transactionNumber)

    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching sales-ingredient report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
