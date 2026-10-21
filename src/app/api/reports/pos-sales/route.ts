import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'sales_recap', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const cols = await rawAll<any[]>("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'")
    const hasCol = (name: string) => cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
    const dateCol = hasCol('tgl_nota') ? 't.tgl_nota' : 't.created_at::text'
    const hasServiceCharge = hasCol('service_charge_amount')
    const hasChangeAmount = hasCol('change_amount')
    const hasVoid = hasCol('void')

    let query = `
      SELECT
        t.id,
        t.transaction_number as kode_nota,
        DATE(COALESCE(${dateCol}::text, t.created_at::text)) as tanggal,
        COALESCE(c.name, 'Umum') as customer,
        COALESCE(t.subtotal, 0) as subtotal,
        COALESCE(t.discount_percent, 0) as disc,
        COALESCE(t.discount_amount, 0) as disc_nominal,
        COALESCE(t.ppn_amount, 0) as ppn,
        ${hasServiceCharge ? 'COALESCE(t.service_charge_amount, 0)' : '0'} as service_charge,
        COALESCE(t.total, 0) as total_bayar,
        COALESCE(tp.total_payments, 0) as bayar,
        COALESCE(${hasChangeAmount ? 't.change_amount' : '0'}, tp.change_amount_agg, 0) as kembalian,
        COALESCE(tp.payment_methods, t.payment_method, 'cash') as jenis_pembayaran,
        COALESCE(tp.banks, '') as bank
      FROM transactions t
      LEFT JOIN master_customer c ON t.customer_id = c.id
      LEFT JOIN (
        SELECT
          tp2.transaction_id,
          SUM(tp2.amount) as total_payments,
          MAX(tp2.change_amount) as change_amount_agg,
          STRING_AGG(tp2.method, ', ') as payment_methods,
          STRING_AGG(b.bank_name, ', ') as banks
        FROM transaction_payments tp2
        LEFT JOIN master_banks b ON tp2.bank_id = b.id
        GROUP BY tp2.transaction_id
      ) tp ON t.id = tp.transaction_id
      WHERE ${hasVoid ? "COALESCE(t.void, 0) = 0" : "COALESCE(t.status, '') NOT IN ('void', 'cancelled')"}
    `

    const params: any[] = []
    if (from) {
      query += ` AND DATE(COALESCE(${dateCol}::text, t.created_at::text)) >= ?`
      params.push(from)
    }
    if (to) {
      query += ` AND DATE(COALESCE(${dateCol}::text, t.created_at::text)) <= ?`
      params.push(to)
    }

    query += ` ORDER BY DATE(COALESCE(${dateCol}::text, t.created_at::text)) DESC, t.transaction_number DESC`

    const rows = await rawAll<any[]>(query, params)

    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error('Error fetching POS sales report:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
