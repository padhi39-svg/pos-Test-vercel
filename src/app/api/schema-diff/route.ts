import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

type ExpectedTable = { name: string; columns: string[] }

const EXPECTED: ExpectedTable[] = [
  { name: 'purchases', columns: ['id','purchase_number','supplier_id','warehouse_id','purchase_date','invoice_number','subtotal','discount_percent','discount_amount','ppn_percent','ppn_amount','total','is_return','status','created_at'] },
  { name: 'purchase_items', columns: ['id','purchase_id','barang_id','quantity','unit_name','unit_ratio','unit_price','discount_percent','discount_amount','total_price'] },
  { name: 'stock_movements', columns: ['id','ingredient_id','warehouse_id','movement_type','quantity','unit','reference_type','reference_id','period_id','transaction_date','notes','created_at','unit_cost','total_cost','balance_qty','balance_cost','balance_avg_cost'] },
  { name: 'stock_balance', columns: ['id','ingredient_id','warehouse_id','quantity','created_at','updated_at','avg_cost','total_cost'] },
  { name: 'purchase_requests', columns: ['id','request_number','request_date','expected_date','period_id','requester_id','requester_name','notes','status','void','created_at','updated_at'] },
  { name: 'purchase_request_items', columns: ['id','request_id','barang_id','barang_code','barang_name','quantity','unit_name','unit_ratio','notes'] },
  // Finance
  { name: 'ap_ledger', columns: ['id','doc_type','doc_id','supplier_id','trans_date','description','debit','credit','balance','created_at'] },
  { name: 'ap_payments', columns: ['id','payment_number','payment_date','supplier_id','method','amount','notes','created_at'] },
  { name: 'ap_payment_items', columns: ['id','payment_id','reference_doc_type','reference_id','applied_amount'] },
  { name: 'ar_ledger', columns: ['id','doc_type','doc_id','customer_id','trans_date','description','debit','credit','balance','created_at'] },
  { name: 'ar_receipts', columns: ['id','receipt_number','receipt_date','customer_id','method','amount','notes','created_at'] },
  { name: 'ar_receipt_items', columns: ['id','receipt_id','reference_doc_type','reference_id','applied_amount'] },
  { name: 'gl_journal', columns: ['id','journal_number','journal_date','description','created_at'] },
  { name: 'gl_journal_lines', columns: ['id','journal_id','account_code','account_name','debit','credit','notes'] },
  { name: 'cashbank_accounts', columns: ['id','code','name','type','currency','is_active','created_at'] },
  { name: 'cashbank_transactions', columns: ['id','trans_number','trans_date','account_id','direction','amount','reference_type','reference_id','notes','created_at'] },
  { name: 'cashbank_transaction_lines', columns: ['id','trans_id','description','amount'] },
]

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()
    const existingTables = await rawAll("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public'") as {name:string}[]
    const existing = new Set(existingTables.map(t => t.name))
    const diffs: any[] = []

    for (const t of EXPECTED) {
      if (!existing.has(t.name)) {
        diffs.push({ table: t.name, status: 'missing_table', missing_columns: t.columns })
        continue
      }
      const colsRows = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name=?`, [t.name]) as any[]
      const cols = new Set(colsRows.map(c => c.name as string))
      const missingCols = t.columns.filter(c => !cols.has(c))
      if (missingCols.length > 0) diffs.push({ table: t.name, status: 'missing_columns', missing_columns: missingCols })
    }

    return NextResponse.json({ success: true, diffs })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
