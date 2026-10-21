import { NextRequest, NextResponse } from 'next/server'
import { rawRun, rawGet } from '@/db/raw'

export async function GET(_req: NextRequest) {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS self_orders (
        uid TEXT PRIMARY KEY,
        order_number SERIAL,
        order_date BIGINT NOT NULL,
        meja_id INTEGER,
        total_price REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await rawRun(`
      CREATE TABLE IF NOT EXISTS self_order_items (
        id SERIAL PRIMARY KEY,
        order_uid TEXT NOT NULL REFERENCES self_orders(uid) ON DELETE CASCADE,
        barang_id INTEGER NOT NULL,
        barang_name TEXT NOT NULL,
        price REAL DEFAULT 0,
        qty INTEGER DEFAULT 1,
        subtotal REAL DEFAULT 0
      )
    `)

    // Insert default self order settings if not exists
    const existingCacheTtl = await rawGet(
      `SELECT setting_key FROM settings WHERE setting_key = 'self_order_cache_ttl_hours'`
    )
    if (!existingCacheTtl) {
      await rawRun(
        `INSERT INTO settings (setting_key, setting_value, setting_group) VALUES ('self_order_cache_ttl_hours', '3', 'selforder')`
      )
    }

    const existingSelfPay = await rawGet(
      `SELECT setting_key FROM settings WHERE setting_key = 'self_order_self_pay'`
    )
    if (!existingSelfPay) {
      await rawRun(
        `INSERT INTO settings (setting_key, setting_value, setting_group) VALUES ('self_order_self_pay', '0', 'selforder')`
      )
    }

    // Midtrans server key (encrypted)
    const existingMidtransKey = await rawGet(
      `SELECT setting_key FROM settings WHERE setting_key = 'self_order_midtrans_server_key'`
    )
    if (!existingMidtransKey) {
      await rawRun(
        `INSERT INTO settings (setting_key, setting_value, setting_group) VALUES ('self_order_midtrans_server_key', '', 'selforder')`
      )
    }

    return NextResponse.json({ ok: true, action: 'create-self-order-tables' })
  } catch (e: any) {
    console.error('create-self-order-tables migration error', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
