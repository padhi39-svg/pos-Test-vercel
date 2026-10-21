import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

// Read-only schema inspection for critical tables/columns
export async function GET(req: NextRequest) {
  try {
    const db = getDb()

    // Helper: list existing tables
    const tables = (await rawAll("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public'"))
      .map((r: any) => String(r.name))
    const hasTable = (t: string) => tables.includes(t)

    // Helper: list columns for a table
    const tableCols = async (t: string): Promise<string[]> => {
      try {
        const rows = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name=?`, [t])
        return rows.map((r: any) => String(r.name))
      } catch { return [] }
    }

    // Expected minimal schemas (core tables across the app)
    const expected: Record<string, string[]> = {
      // Purchases
      purchases: [
        'id','purchase_number','supplier_id','purchase_date','total','is_return','status'
      ],
      purchase_items: [
        'id','purchase_id','barang_id','quantity','unit_name','unit_ratio','unit_price','discount_percent','discount_amount','total_price'
      ],
      // Master & Catalog
      master_users: ['id','code','name','level_id','isdelete'],
      master_kategori: ['id','code','name','isdelete'],
      master_spesifikasi: ['id','code','name','isdelete'],
      master_merk: ['id','code','name','isdelete'],
      master_periode: ['id','code','name','start_date','end_date','is_active','isdelete'],
      master_customer: ['id','code','name','isdelete'],
      master_supplier: [
        'id','code','name'
      ],
      master_barang: ['id','code','name','kategori_id','spesifikasi_id','merk_id','hpp','jenis','aktif','tampil_menu','isdelete'],
      barang_units: ['id','barang_id','name','ratio'],
      barang_prices: ['id','barang_id','price','effective_date'],
      barang_recipes: ['id','barang_id','ingredient_id','quantity','unit'],
      master_banks: ['id','bank_name','account_number','isdelete'],
      master_level_manager: ['id','code','name','isdelete'],
      master_permissions: ['id','code','name'],
      menu_permissions: ['id','menu_code','permission_code'],
      level_permissions: ['id','level_id','menu_code','permission_code','allowed'],
      // POS & Reservations
      transactions: ['id','transaction_number','subtotal','total','status','created_at'],
      transaction_items: ['id','transaction_id','barang_id','barang_code','barang_name','quantity','unit_name','unit_ratio','unit_price','discount_percent','discount_amount','total_price'],
      transaction_payments: ['id','transaction_id','method','amount','change_amount'],
      floors: ['id','code','name'],
      master_meja: ['id','code','name','floor_id'],
      reservations: ['id','number','date','start_time','end_time','pax','status'],
      reservation_tables: ['id','reservation_id','table_id'],
      // AP Payments core tables
      ap_payments: [
        'id','payment_number','payment_date','supplier_id','period_id','status','subtotal','total','notes','created_at'
      ],
      ap_payment_items: [
        'id','payment_id','purchase_id','invoice_number','due_amount','pay_amount','remarks','source_type','source_id'
      ],
      ap_payment_methods: [
        'id','payment_id','account_id','amount','notes'
      ],
      ap_payment_extras: [
        'id','payment_id','account_id','notes','debit','credit'
      ],
      // AP Opening balances
      ap_opening_balances: [
        'id','kode_nota','tanggal','supplier_id','nominal'
      ],
      // Warehouses (variasi penamaan yang umum)
      master_gudang: ['id','code','name'],
      warehouses: ['id','code','name'],
      warehouse: ['id','code','name'],
      // Stock (reports we touched)
      stock_movements: [
        'id','ingredient_id','warehouse_id','movement_type','quantity','unit','reference_type','reference_id','period_id','transaction_date'
      ],
      stock_balance: [
        'id','ingredient_id','warehouse_id','quantity','avg_cost','total_cost'
      ],
    }

    const missingTables: string[] = []
    const missingColumns: Record<string, string[]> = {}

    for (const [t, cols] of Object.entries(expected)) {
      if (!hasTable(t)) {
        missingTables.push(t)
        continue
      }
      const existing = new Set(await tableCols(t))
      const miss = cols.filter(c => !existing.has(c))
      if (miss.length) missingColumns[t] = miss
    }

    return NextResponse.json({ success: true, tables, missingTables, missingColumns })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'Failed to inspect schema', details: e?.message }, { status: 500 })
  }
}
