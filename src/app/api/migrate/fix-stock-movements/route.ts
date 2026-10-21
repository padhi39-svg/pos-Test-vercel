import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/migrate/fix-stock-movements?confirm=yes
 * 
 * Fix stock_movements table to accept all barang (not just ingredients)
 * This will:
 * 1. Backup existing data
 * 2. Drop the table
 * 3. Recreate with correct foreign keys
 * 4. Restore data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')
    
    const db = getDb()

    // Get current table info
    const tableInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'stock_movements'`)
    const count = (await rawGet<{count: number}>('SELECT COUNT(*) as count FROM stock_movements'))?.count ?? 0

    if (confirm !== 'yes') {
      return NextResponse.json({
        message: 'Add ?confirm=yes to execute migration',
        currentTable: {
          columns: tableInfo,
          rowCount: count
        },
        warning: 'This will recreate the stock_movements table with correct foreign keys'
      })
    }

    // Execute migration
    console.log('Starting stock_movements migration...')

    // 1. Backup existing data
    const backupData = await rawAll<any[]>('SELECT * FROM stock_movements')
    console.log(`Backed up ${backupData.length} rows`)

    // 2. Drop the old table
    await rawRun('DROP TABLE IF EXISTS stock_movements')
    console.log('Dropped old table')

    // 3. Create new table with correct structure
    await rawRun(`
      CREATE TABLE stock_movements (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL CHECK(movement_type IN ('in', 'out')),
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        period_id INTEGER,
        transaction_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES master_barang(id),
        FOREIGN KEY (warehouse_id) REFERENCES master_gudang(id),
        FOREIGN KEY (period_id) REFERENCES master_periode(id)
      )
    `)
    console.log('Created new table with correct foreign keys')

    // 4. Restore data (only if backup exists and IDs are valid)
    let restored = 0
    let skipped = 0
    
    for (const row of backupData) {
      try {
        // Verify foreign keys exist
        const barangExists = await rawGet('SELECT id FROM master_barang WHERE id = ?', [row.ingredient_id])
        const gudangExists = await rawGet('SELECT id FROM master_gudang WHERE id = ?', [row.warehouse_id])
        const periodeExists = row.period_id ? await rawGet('SELECT id FROM master_periode WHERE id = ?', [row.period_id]) : true
        
        if (barangExists && gudangExists && periodeExists) {
          await rawRun(`
            INSERT INTO stock_movements (
              id, ingredient_id, warehouse_id, movement_type, quantity, unit,
              reference_type, reference_id, period_id, transaction_date, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            row.id,
            row.ingredient_id,
            row.warehouse_id,
            row.movement_type,
            row.quantity,
            row.unit,
            row.reference_type,
            row.reference_id,
            row.period_id,
            row.transaction_date,
            row.notes,
            row.created_at
          ])
          restored++
        } else {
          skipped++
          console.log(`Skipped row ${row.id}: invalid foreign keys`)
        }
      } catch (err) {
        skipped++
        console.error(`Error restoring row ${row.id}:`, err)
      }
    }

    const afterCount = (await rawGet<{count: number}>('SELECT COUNT(*) as count FROM stock_movements'))?.count ?? 0

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully!',
      before: {
        rowCount: count,
        columns: tableInfo
      },
      after: {
        rowCount: afterCount,
        restored,
        skipped
      }
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error.message 
    }, { status: 500 })
  }
}
