import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'

const PRESERVE_USER_CODE = 'USR/000001'

export const dynamic = 'force-dynamic'

async function getCount(pool: any, table: string): Promise<number> {
  try {
    const r = await pool.query(`SELECT COUNT(*) as c FROM ${table}`)
    return Number(r.rows[0]?.c || 0)
  } catch { return 0 }
}

async function runDelete(pool: any, table: string) {
  try { await pool.query(`DELETE FROM ${table}`) } catch (e: any) { console.log(`Skip ${table}:`, e.message) }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')
    const pool = (getDb() as any).$client

    const tables = [
      'master_barang', 'master_customer', 'master_supplier', 'master_gudang',
      'master_kategori', 'master_spesifikasi', 'master_merk', 'master_periode',
      'master_banks', 'master_meja', 'floors', 'master_sales',
      'master_jenis_customer', 'master_season_discount', 'master_season_discount_items',
      'master_paket', 'master_paket_detail',
      'transactions', 'stock_movements', 'stock_balance',
      'purchase_orders', 'purchase_order_items',
      'purchases', 'purchase_items',
      'stock_transfers', 'stock_usage', 'stock_opname',
      'reservations', 'reservation_tables',
      'resto_temp_orders', 'resto_temp_order_items',
      'sales_order', 'sales_order_items',
      'ar_payments', 'ap_payments', 'ap_advances',
      'gl_journal', 'cashbank_transactions', 'cash_mutations',
      'memorial_journals', 'manufaktur', 'manufaktur_detail', 'manufaktur_biaya',
      'accounts', 'account_mappings',
      'master_users', 'master_level_manager', 'level_permissions', 'sessions',
      'promo_banner', 'promo', 'promo_item', 'menu_item',
    ]

    const beforeCounts: Record<string, number> = {}
    for (const t of tables) {
      beforeCounts[t] = await getCount(pool, t)
    }

    if (confirm === 'yes') {
      let preserveUserId: number | null = null
      try {
        const r = await pool.query('SELECT id FROM master_users WHERE code = $1 LIMIT 1', [PRESERVE_USER_CODE])
        preserveUserId = r.rows[0]?.id ? Number(r.rows[0].id) : null
      } catch (e) { console.log('Preserve user lookup failed:', e) }

      let preserveLevelId: number | null = 1
      try {
        const r = await pool.query('SELECT id FROM master_level_manager WHERE id = 1 AND isdelete = 0')
        preserveLevelId = r.rows.length > 0 ? 1 : null
      } catch (e) { console.log('Preserve level lookup by id failed:', e) }

      if (!preserveLevelId) {
        try {
          const r = await pool.query("SELECT id FROM master_level_manager WHERE isdelete = 0 AND UPPER(code) IN ('ADMIN','ADMINISTRATOR') LIMIT 1")
          preserveLevelId = r.rows[0]?.id ? Number(r.rows[0].id) : null
        } catch (e) { console.log('Preserve level lookup by code failed:', e) }
      }

      if (!preserveLevelId) {
        try {
          const r = await pool.query("SELECT id FROM master_level_manager WHERE isdelete = 0 AND UPPER(name) LIKE '%ADMIN%' LIMIT 1")
          preserveLevelId = r.rows[0]?.id ? Number(r.rows[0].id) : null
        } catch (e) { console.log('Preserve level lookup by name failed:', e) }
      }

      if (!preserveUserId) {
        return NextResponse.json({
          error: `Tidak bisa reset: user yang harus disisakan tidak ditemukan (code=${PRESERVE_USER_CODE}).`,
        }, { status: 400 })
      }

      if (!preserveLevelId) {
        return NextResponse.json({
          error: 'Tidak bisa reset: level Administrator yang harus disisakan tidak ditemukan (id=1 atau code=ADMIN).',
        }, { status: 400 })
      }

      // Delete data (respect FK order)
      const deleteGroups = [
        // Finance
        ['ap_payment_extras', 'ap_payment_methods', 'ap_payment_items', 'ap_payments', 'ap_ledger', 'ap_opening_balances', 'ap_advance_lines', 'ap_advances'],
        ['ar_payment_methods', 'ar_payment_extras', 'ar_payment_items', 'ar_payments', 'ar_receipt_items', 'ar_receipts', 'ar_ledger'],
        ['gl_journal_lines', 'gl_journal', 'journal_entries'],
        ['cashbank_transaction_lines', 'cashbank_transactions', 'cashbank_accounts'],
        ['cash_mutation_details', 'cash_mutations'],
        ['memorial_journal_details', 'memorial_journals', 'report_snapshot_cache', 'account_mappings'],
        // Purchase requests
        ['purchase_request_items', 'purchase_requests'],
        // Transaction
        ['transaction_payments', 'transaction_items', 'transactions'],
        ['sales_order_items', 'sales_order', 'sales_items', 'sales', 'sales_orders', 'sales_returns', 'sales_return_items'],
        // Purchase orders
        ['purchase_order_items', 'purchase_orders'],
        // Purchases
        ['purchase_items', 'purchases', 'purchase_return_items', 'purchase_returns'],
        // Stock
        ['stock_transfer_items', 'stock_transfers', 'stock_usage_items', 'stock_usage'],
        ['stock_opname_counts', 'stock_opname_sessions', 'stock_opname_items', 'stock_opname', 'stock_adjustments', 'draftopname'],
        ['stock_balances', 'stock_balance_by_warehouse', 'stock_period_snapshots', 'stock_movements', 'stock_balance'],
        // Manufacturing
        ['manufaktur_biaya', 'manufaktur_detail', 'manufaktur'],
        // Reservations
        ['reservation_tables', 'reservations'],
        // POS temp
        ['resto_temp_order_items', 'resto_temp_orders'],
        // Promo landing
        ['promo_item', 'menu_item', 'promo_banner', 'promo'],
        // Season discount (references master_barang & master_jenis_customer)
        ['master_season_discount_items', 'master_season_discount', 'master_jenis_customer'],
        // Paket (references master_barang)
        ['master_paket_detail', 'master_paket'],
        // Barang
        ['barang_recipes', 'barang_prices', 'barang_units', 'master_barang'],
        // Master data
        ['master_customer', 'master_supplier', 'master_gudang', 'master_kategori', 'master_spesifikasi', 'master_merk', 'master_periode', 'master_banks', 'master_meja', 'floors', 'master_sales'],
        // Accounts
        ['accounts'], // parent_id nulled below
      ]

      for (const group of deleteGroups) {
        for (const t of group) await runDelete(pool, t)
      }

      // Nullify account parent references before deleting
      try { await pool.query('UPDATE accounts SET parent_id = NULL') } catch {}
      await runDelete(pool, 'accounts')

      // RBAC & users — preserve specific user & admin level
      try { await pool.query('DELETE FROM sessions') } catch (e) { console.log('Skip sessions:', e) }
      try { await pool.query('DELETE FROM user_barang_jenis WHERE user_id != $1', [preserveUserId]) } catch (e) { console.log('Skip user_barang_jenis partial:', e) }
      try { await pool.query('DELETE FROM master_users WHERE id != $1', [preserveUserId]) } catch (e) { console.log('Skip master_users partial:', e) }
      try { await pool.query('DELETE FROM level_permissions WHERE level_id != $1', [preserveLevelId]) } catch (e) { console.log('Skip level_permissions partial:', e) }
      try { await pool.query('DELETE FROM master_level_manager WHERE id != $1', [preserveLevelId]) } catch (e) { console.log('Skip master_level_manager partial:', e) }
      try { await pool.query('UPDATE master_users SET level_id = $1 WHERE id = $2', [preserveLevelId, preserveUserId]) } catch (e) { console.log('Skip master_users.level_id update:', e) }

      // Reset sequences
      const seqTables = tables.filter(t => t !== 'master_users')
      for (const t of seqTables) {
        try { await pool.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`) } catch {}
      }

      const afterCounts: Record<string, number> = {}
      for (const t of tables) {
        afterCounts[t] = await getCount(pool, t)
      }

      return NextResponse.json({
        success: true,
        message: `✅ RESET TOTAL BERHASIL. Semua data dihapus, kecuali user (code=${PRESERVE_USER_CODE}) tetap disimpan.`,
        before: beforeCounts,
        after: afterCounts,
        preserved_user: { code: PRESERVE_USER_CODE, id: preserveUserId }
      })
    }

    return NextResponse.json({
      message: 'Current data counts. Add ?confirm=yes to DELETE ALL DATA.',
      counts: beforeCounts,
      warning: '🚨 This will delete EVERYTHING including master data! System will be completely empty!'
    })
  } catch (error: any) {
    console.error('Error in reset all data:', error)
    return NextResponse.json({
      error: 'Failed to reset all data',
      details: error.message
    }, { status: 500 })
  }
}
