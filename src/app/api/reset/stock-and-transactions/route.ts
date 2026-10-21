import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

const STOCK_TABLES = [
  'transactions', 'transaction_items', 'transaction_payments', 'transaction_void_info',
  'stock_movements', 'stock_balance', 'stock_balance_2', 'stock_balance_by_warehouse',
  'stock_balance_monthly', 'barang_monthly_hpp', 'akun_saldo_bulanan',
  'purchases', 'purchase_items', 'purchase_orders', 'purchase_order_items',
  'stock_transfers', 'stock_transfer_items', 'stock_usage', 'stock_usage_items',
  'stock_opname', 'stock_opname_items', 'stock_opname_sessions', 'stock_opname_counts',
  'sales_order', 'sales_order_items', 'resto_temp_orders', 'resto_temp_order_items',
  'goods_receipt_items', 'goods_receipts', 'invoice_items', 'invoices',
  'ar_payments', 'ar_payment_items', 'ar_payment_methods', 'ar_payment_extras',
  'ar_opening_balances', 'ar_receipts', 'ar_receipt_items', 'ar_ledger',
  'ap_payments', 'ap_payment_items', 'ap_payment_methods', 'ap_payment_extras',
  'ap_opening_balances', 'ap_ledger', 'ap_advances', 'ap_advance_lines',
  'ar_advances', 'ar_advance_lines',
  'cash_mutations', 'cash_mutation_details',
  'memorial_journals', 'memorial_journal_details',
  'gl_journal', 'gl_journal_lines', 'journal_entries',
  'cashbank_accounts', 'cashbank_transactions', 'cashbank_transaction_lines',
  'purchase_requests', 'purchase_request_items',
  'manufaktur', 'manufaktur_detail', 'manufaktur_biaya',
  'report_snapshot_cache',
]

async function getCount(pool: any, table: string): Promise<number> {
  try {
    const r = await pool.query(`SELECT COUNT(*) as c FROM ${table}`)
    return Number(r.rows[0]?.c || 0)
  } catch { return 0 }
}

async function tableExists(pool: any, name: string): Promise<boolean> {
  try {
    const r = await pool.query(
      "SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
      [name]
    )
    return Number(r.rows[0]?.c || 0) > 0
  } catch { return false }
}

async function runDelete(pool: any, table: string) {
  try { await pool.query(`DELETE FROM ${table}`) } catch {}
}

async function getCounts(pool: any, tables: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const t of tables) {
    if (await tableExists(pool, t)) {
      counts[t] = await getCount(pool, t)
    } else {
      counts[t] = 0
    }
  }
  return counts
}

async function deleteAll(pool: any, tables: string[]) {
  for (const t of tables) await runDelete(pool, t)
}

async function resetSequences(pool: any, tables: string[]) {
  for (const t of tables) {
    try { await pool.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`) } catch {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')
    const pool = (getDb() as any).$client

    const counts = await getCounts(pool, STOCK_TABLES)

    if (confirm === 'yes') {
      await deleteAll(pool, STOCK_TABLES)
      await resetSequences(pool, STOCK_TABLES)

      const afterCounts: Record<string, number> = {}
      for (const t of ['transactions', 'transaction_items', 'stock_movements', 'stock_balance']) {
        afterCounts[t] = await getCount(pool, t)
      }

      return NextResponse.json({
        success: true,
        message: '✅ Semua data transaksi dan stok berhasil dihapus!',
        before: counts,
        after: afterCounts,
        deleted: counts,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Current data counts. Add ?confirm=yes to delete all data.',
      counts,
      warning: 'This will delete ALL transactions, transaction items, stock movements, stock balance, and related data!'
    })
  } catch (error: any) {
    console.error('Error resetting stock and transactions:', error)
    return NextResponse.json({ error: 'Failed to reset data', details: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')
    const pool = (getDb() as any).$client

    const counts = await getCounts(pool, STOCK_TABLES)

    if (confirm === 'yes') {
      await deleteAll(pool, STOCK_TABLES)
      await resetSequences(pool, STOCK_TABLES)

      const afterCounts: Record<string, number> = {}
      for (const t of ['transactions', 'transaction_items', 'stock_movements', 'stock_balance']) {
        afterCounts[t] = await getCount(pool, t)
      }

      return NextResponse.json({
        success: true,
        message: '✅ All transactions and stock data deleted successfully!',
        before: counts,
        after: afterCounts,
        deleted: counts,
      })
    }

    return NextResponse.json({
      message: 'Current data counts. Add ?confirm=yes to delete all data.',
      counts,
      warning: 'This will delete ALL transactions, transaction items, stock movements, and stock balance!'
    })
  } catch (error: any) {
    console.error('Error in reset endpoint:', error)
    return NextResponse.json({ error: 'Failed to process request', details: error.message }, { status: 500 })
  }
}
