import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * POST /api/stock/migrate
 * Comprehensive migration for stock system optimization
 */
export async function POST() {
  try {
    const db = getDb()
    const messages: string[] = []

    // 0. Ensure 'unit' column exists in stock tables (for older DBs)
    try {
      const smCols = await rawAll<{ name: string }>(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'stock_movements'`)
      const hasSmUnit = smCols.some(c => c.name === 'unit')
      const hasSmNotes = smCols.some(c => c.name === 'notes')
      if (!hasSmUnit) {
        await rawRun('ALTER TABLE stock_movements ADD COLUMN unit TEXT')
        messages.push('✓ Added column stock_movements.unit')
      } else {
        messages.push('✓ Column stock_movements.unit already exists')
      }
      if (!hasSmNotes) {
        await rawRun('ALTER TABLE stock_movements ADD COLUMN notes TEXT')
        messages.push('✓ Added column stock_movements.notes')
      } else {
        messages.push('✓ Column stock_movements.notes already exists')
      }
    } catch (e: any) {
      messages.push(`⚠ stock_movements.unit check/add failed: ${e.message}`)
    }

    try {
      const sbCols = await rawAll<{ name: string }>(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'stock_balance'`)
      const hasSbUnit = sbCols.some(c => c.name === 'unit')
      if (!hasSbUnit) {
        await rawRun('ALTER TABLE stock_balance ADD COLUMN unit TEXT')
        messages.push('✓ Added column stock_balance.unit')
      } else {
        messages.push('✓ Column stock_balance.unit already exists')
      }
    } catch (e: any) {
      messages.push(`⚠ stock_balance.unit check/add failed: ${e.message}`)
    }

    // 1. Add period_id to stock_movements
    try {
      await rawGet('SELECT period_id FROM stock_movements LIMIT 1')
      messages.push('✓ Column stock_movements.period_id already exists')
    } catch {
      await rawRun('ALTER TABLE stock_movements ADD COLUMN period_id INTEGER')
      messages.push('✓ Added column stock_movements.period_id')
      
      // Backfill period_id based on created_at
      const updated = await rawRun(`
        UPDATE stock_movements 
        SET period_id = (
          SELECT id FROM master_periode 
          WHERE DATE(stock_movements.created_at) BETWEEN DATE(start_date) AND DATE(end_date)
          AND isdelete = 0
          LIMIT 1
        )
        WHERE period_id IS NULL
      `)
      messages.push(`✓ Backfilled ${updated.rowCount} rows in stock_movements`)
    }

    // 2. Add warehouse_id to stock_movements
    try {
      await rawGet('SELECT warehouse_id FROM stock_movements LIMIT 1')
      messages.push('✓ Column stock_movements.warehouse_id already exists')
    } catch {
      await rawRun('ALTER TABLE stock_movements ADD COLUMN warehouse_id INTEGER')
      messages.push('✓ Added column stock_movements.warehouse_id')
    }

    // 3. Add transaction_date to stock_movements
    try {
      await rawGet('SELECT transaction_date FROM stock_movements LIMIT 1')
      messages.push('✓ Column stock_movements.transaction_date already exists')
    } catch {
      await rawRun('ALTER TABLE stock_movements ADD COLUMN transaction_date TEXT')
      messages.push('✓ Added column stock_movements.transaction_date')
      
      // Backfill with created_at
      await rawRun(`
        UPDATE stock_movements 
        SET transaction_date = DATE(created_at)
        WHERE transaction_date IS NULL
      `)
      messages.push('✓ Backfilled transaction_date from created_at')
    }

    // 4. Add period_id to transactions
    try {
      await rawGet('SELECT period_id FROM transactions LIMIT 1')
      messages.push('✓ Column transactions.period_id already exists')
    } catch {
      await rawRun('ALTER TABLE transactions ADD COLUMN period_id INTEGER')
      messages.push('✓ Added column transactions.period_id')
      
      // Backfill period_id based on created_at
      const updated = await rawRun(`
        UPDATE transactions 
        SET period_id = (
          SELECT id FROM master_periode 
          WHERE DATE(transactions.created_at) BETWEEN DATE(start_date) AND DATE(end_date)
          AND isdelete = 0
          LIMIT 1
        )
        WHERE period_id IS NULL
      `)
      messages.push(`✓ Backfilled ${updated.rowCount} rows in transactions`)
    }

    // 4b. Add invoice-specific fields to transactions
    try {
      await rawGet('SELECT due_date FROM transactions LIMIT 1')
      messages.push('✓ Column transactions.due_date already exists')
    } catch {
      await rawRun('ALTER TABLE transactions ADD COLUMN due_date TEXT')
      messages.push('✓ Added column transactions.due_date')
    }

    try {
      await rawGet('SELECT payment_terms FROM transactions LIMIT 1')
      messages.push('✓ Column transactions.payment_terms already exists')
    } catch {
      await rawRun('ALTER TABLE transactions ADD COLUMN payment_terms TEXT')
      messages.push('✓ Added column transactions.payment_terms')
    }

    try {
      await rawGet('SELECT notes FROM transactions LIMIT 1')
      messages.push('✓ Column transactions.notes already exists')
    } catch {
      await rawRun('ALTER TABLE transactions ADD COLUMN notes TEXT')
      messages.push('✓ Added column transactions.notes')
    }

    // 5. Create indexes for performance
    const indexes = [
      // stock_balance indexes
      { name: 'idx_stock_balance_ingredient', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_balance_ingredient ON stock_balance(ingredient_id)' },
      { name: 'idx_stock_balance_warehouse', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_balance_warehouse ON stock_balance(warehouse_id)' },
      { name: 'idx_stock_balance_combo', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_balance_combo ON stock_balance(ingredient_id, warehouse_id)' },
      
      // stock_movements indexes
      { name: 'idx_stock_movements_ingredient', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id)' },
      { name: 'idx_stock_movements_warehouse', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id)' },
      { name: 'idx_stock_movements_period', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_period ON stock_movements(period_id)' },
      { name: 'idx_stock_movements_date', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at)' },
      { name: 'idx_stock_movements_tx_date', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_tx_date ON stock_movements(transaction_date)' },
      { name: 'idx_stock_movements_type', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type)' },
      { name: 'idx_stock_movements_ref', sql: 'CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id)' },
      
      // transactions indexes
      { name: 'idx_transactions_period', sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_period ON transactions(period_id)' },
      { name: 'idx_transactions_date', sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at)' },
      { name: 'idx_transactions_customer', sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id)' },
      { name: 'idx_transactions_void', sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_void ON transactions(void)' },
      
      // master_periode indexes
      { name: 'idx_periode_dates', sql: 'CREATE INDEX IF NOT EXISTS idx_periode_dates ON master_periode(start_date, end_date)' },
      { name: 'idx_periode_active', sql: 'CREATE INDEX IF NOT EXISTS idx_periode_active ON master_periode(is_active, is_closed)' },
      
      // master_gudang indexes
      { name: 'idx_gudang_active', sql: 'CREATE INDEX IF NOT EXISTS idx_gudang_active ON master_gudang(is_active, isdelete)' },
      
      // master_barang indexes
      { name: 'idx_barang_jenis', sql: 'CREATE INDEX IF NOT EXISTS idx_barang_jenis ON master_barang(jenis, isdelete)' },
      { name: 'idx_barang_aktif', sql: 'CREATE INDEX IF NOT EXISTS idx_barang_aktif ON master_barang(aktif, isdelete)' },
    ]

    for (const idx of indexes) {
      try {
        await rawRun(idx.sql)
        messages.push(`✓ Created index: ${idx.name}`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          messages.push(`⚠ Index ${idx.name}: ${e.message}`)
        }
      }
    }

    // 6. Create view for stock summary
    try {
      await rawRun('DROP VIEW IF EXISTS v_stock_summary')
      await rawRun(`
        CREATE VIEW v_stock_summary AS
        SELECT 
          sb.id,
          sb.ingredient_id,
          b.code as ingredient_code,
          b.name as ingredient_name,
          sb.warehouse_id,
          g.code as warehouse_code,
          g.name as warehouse_name,
          sb.quantity,
          sb.unit,
          b.hpp,
          (sb.quantity * b.hpp) as stock_value,
          sb.updated_at
        FROM stock_balance sb
        JOIN master_barang b ON sb.ingredient_id = b.id
        JOIN master_gudang g ON sb.warehouse_id = g.id
        WHERE b.isdelete = 0 AND g.isdelete = 0
      `)
      messages.push('✓ Created view: v_stock_summary')
    } catch (e: any) {
      messages.push(`⚠ View v_stock_summary: ${e.message}`)
    }

    // 7. Create view for stock movements with details
    try {
      await rawRun('DROP VIEW IF EXISTS v_stock_movements_detail')
      await rawRun(`
        CREATE VIEW v_stock_movements_detail AS
        SELECT 
          sm.id,
          sm.ingredient_id,
          b.code as ingredient_code,
          b.name as ingredient_name,
          sm.warehouse_id,
          g.name as warehouse_name,
          sm.movement_type,
          sm.quantity,
          sm.unit,
          sm.reference_type,
          sm.reference_id,
          sm.period_id,
          p.name as period_name,
          sm.transaction_date,
          sm.notes,
          sm.created_at
        FROM stock_movements sm
        JOIN master_barang b ON sm.ingredient_id = b.id
        LEFT JOIN master_gudang g ON sm.warehouse_id = g.id
        LEFT JOIN master_periode p ON sm.period_id = p.id
        WHERE b.isdelete = 0
      `)
      messages.push('✓ Created view: v_stock_movements_detail')
    } catch (e: any) {
      messages.push(`⚠ View v_stock_movements_detail: ${e.message}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Stock system migration completed successfully',
      details: messages
    })
  } catch (error: any) {
    console.error('Error migrating stock system:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
