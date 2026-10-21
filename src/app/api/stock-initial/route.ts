import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { hasPermission } from '@/lib/permissions'

// GET all stock initial
export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'stock_initial', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat saldo awal stok' }, { status: 403 })
    }
    const pool = (getDb() as any).$client

    // Pastikan kolom 'unit' ada di stock_balance (beberapa modul lama belum punya kolom ini)
    try {
      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
      const names = new Set(cols.map(c => c.name))
      if (!names.has('unit')) {
        await rawRun(`ALTER TABLE stock_balance ADD COLUMN unit TEXT`)
      }
    } catch (e) {
      console.warn('[stock-initial] ensure unit column warning:', e)
    }

    const rows = await rawAll<any>(`
      SELECT 
        sb.id,
        sb.ingredient_id,
        sb.warehouse_id,
        sb.quantity,
        sb.unit,
        sb.created_at,
        b.code as ingredient_code,
        b.name as ingredient_name,
        g.code as warehouse_code,
        g.name as warehouse_name
      FROM stock_balance sb
      JOIN master_barang b ON sb.ingredient_id = b.id
      JOIN master_gudang g ON sb.warehouse_id = g.id
      ORDER BY sb.created_at DESC
    `)
    
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('Error fetching stock initial:', error)
    return NextResponse.json({ error: 'Failed to fetch stock initial', details: error.message }, { status: 500 })
  }
}

// POST create/update stock initial
export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'stock_initial', 'create') && !hasPermission(request as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat saldo awal stok' }, { status: 403 })
    }
    const body = await request.json()
    const { ingredient_id, warehouse_id, quantity, unit, input_quantity, input_unit, transaction_date } = body

    if (!ingredient_id || !warehouse_id || !quantity || !unit) {
      return NextResponse.json({ error: 'Ingredient, warehouse, quantity, and unit are required' }, { status: 400 })
    }

    const pool = (getDb() as any).$client

    // Enforce stock initial only in periode ID=1 and active, injected at the 1st day (start_date) of that period
    const p1 = await rawGet<any>(`SELECT id, name, start_date, end_date, is_active, is_closed FROM master_periode WHERE id = 1`)
    if (!p1) {
      return NextResponse.json({ 
        error: 'Periode ID=1 belum dibuat.', 
        code: 'PERIOD_1_NOT_FOUND' 
      }, { status: 400 })
    }
    if (Number(p1.is_active) !== 1) {
      return NextResponse.json({ 
        error: `Periode ID=1 ('${p1.name || ''}') belum aktif. Aktifkan dahulu.`, 
        code: 'PERIOD_1_NOT_ACTIVE' 
      }, { status: 400 })
    }
    if (Number(p1.is_closed) === 1) {
      return NextResponse.json({ 
        error: `Periode ID=1 ('${p1.name || ''}') sudah ditutup.`, 
        code: 'PERIOD_1_CLOSED' 
      }, { status: 400 })
    }
    const txDate = String((p1.start_date || '').slice(0, 10))
    const period = p1

    // Ensure cost columns exist for HPP moving average
    try {
      const sbCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_balance'")
      const sbNames = new Set(sbCols.map(c => c.name))
      if (!sbNames.has('avg_cost')) await rawRun(`ALTER TABLE stock_balance ADD COLUMN avg_cost REAL DEFAULT 0`)
      if (!sbNames.has('total_cost')) await rawRun(`ALTER TABLE stock_balance ADD COLUMN total_cost REAL DEFAULT 0`)
    } catch {}
    try {
      const smCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_movements'")
      const smNames = new Set(smCols.map(c => c.name))
      if (!smNames.has('unit_cost')) await rawRun(`ALTER TABLE stock_movements ADD COLUMN unit_cost REAL`)
      if (!smNames.has('total_cost')) await rawRun(`ALTER TABLE stock_movements ADD COLUMN total_cost REAL`)
      if (!smNames.has('balance_qty')) await rawRun(`ALTER TABLE stock_movements ADD COLUMN balance_qty REAL`)
      if (!smNames.has('balance_cost')) await rawRun(`ALTER TABLE stock_movements ADD COLUMN balance_cost REAL`)
      if (!smNames.has('balance_avg_cost')) await rawRun(`ALTER TABLE stock_movements ADD COLUMN balance_avg_cost REAL`)
    } catch {}

    // Fetch barang jenis & hpp (standard cost)
    const barang = await rawGet<any>(`SELECT jenis, hpp FROM master_barang WHERE id = $1`, [ingredient_id])
    const isHppEligible = barang && (Number(barang.jenis) === 1 || Number(barang.jenis) === 2 || Number(barang.jenis) === 3)
    const hppStandar = isHppEligible ? (Number(barang.hpp) || 0) : 0

    // Check if stock balance already exists
    const existing = await rawGet<any>(`
      SELECT id FROM stock_balance 
      WHERE ingredient_id = $1 AND warehouse_id = $2
    `, [ingredient_id, warehouse_id])

    // Lock: jika sudah ada transaksi lain, tolak update
    if (existing && await checkInitialLocked(pool, Number(ingredient_id), Number(warehouse_id))) {
      return NextResponse.json({
        error: 'Tidak bisa mengubah saldo awal karena stok barang ini sudah memiliki riwayat transaksi (pembelian, penjualan, produksi, dll).',
        code: 'INITIAL_STOCK_LOCKED'
      }, { status: 409 })
    }

    let stockBalanceId: number

    if (existing) {
      // Update existing stock balance (REPLACE)
      if (isHppEligible) {
        const newTotalCost = (Number(quantity) || 0) * hppStandar
        await rawRun(`
          UPDATE stock_balance 
          SET quantity = $1, unit = $2, avg_cost = $3, total_cost = $4, updated_at = CURRENT_TIMESTAMP
          WHERE ingredient_id = $5 AND warehouse_id = $6
        `, [quantity, unit, hppStandar, newTotalCost, ingredient_id, warehouse_id])
      } else {
        await rawRun(`
          UPDATE stock_balance 
          SET quantity = $1, unit = $2, avg_cost = 0, total_cost = 0, updated_at = CURRENT_TIMESTAMP
          WHERE ingredient_id = $3 AND warehouse_id = $4
        `, [quantity, unit, ingredient_id, warehouse_id])
      }
      
      stockBalanceId = existing.id
    } else {
      // Insert new stock balance
      const initAvg = isHppEligible ? hppStandar : 0
      const initTotal = isHppEligible ? (Number(quantity) || 0) * hppStandar : 0
      const r = await pool.query(`
        INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, unit, avg_cost, total_cost, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [ingredient_id, warehouse_id, quantity, unit, initAvg, initTotal])
      
      stockBalanceId = r.rows[0].id
    }

    // Record in stock_movements with period_id and warehouse_id
    try {
      // Compute movement cost & balances
      const qtyNum = Number(quantity) || 0
      const unitCost = isHppEligible ? hppStandar : null
      const totalCost = isHppEligible ? (qtyNum * hppStandar) : null
      // Read final balance for movement snapshot
      const bal = await rawGet<any>(`SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2`, [ingredient_id, warehouse_id])
      const balanceQty = bal ? Number(bal.quantity) || 0 : qtyNum
      const balanceCost = bal ? Number(bal.total_cost) || 0 : (totalCost || 0)
      const balanceAvg = bal ? Number(bal.avg_cost) || 0 : (isHppEligible ? hppStandar : 0)

      await rawRun(`
        INSERT INTO stock_movements (
          ingredient_id, warehouse_id, movement_type, quantity, unit,
          reference_type, reference_id, period_id, transaction_date, notes,
          unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        ingredient_id,
        warehouse_id,
        'in',
        quantity,
        unit,
        'initial_stock',
        stockBalanceId,
        period.id,
        txDate,
        `Saldo awal: ${input_quantity} ${input_unit}`,
        unitCost,
        totalCost,
        balanceQty,
        balanceCost,
        balanceAvg
      ])
    } catch (movementError) {
      console.warn('Stock movement insert failed:', movementError)
      // Continue without failing the main operation
    }

    return NextResponse.json({ 
      success: true, 
      id: stockBalanceId,
      message: existing ? 'Saldo awal berhasil diupdate' : 'Saldo awal berhasil ditambahkan'
    })
  } catch (error: any) {
    console.error('Error creating stock initial:', error)
    return NextResponse.json({ error: 'Failed to create stock initial', details: error.message }, { status: 500 })
  }
}

async function checkInitialLocked(pool: any, ingredient_id: number, warehouse_id: number): Promise<boolean> {
  const otherMovements = await rawGet<any>(`
    SELECT COUNT(*) as cnt FROM stock_movements
    WHERE ingredient_id = $1 AND warehouse_id = $2
      AND (reference_type IS NULL OR reference_type != 'initial_stock')
  `, [ingredient_id, warehouse_id])
  return Number(otherMovements?.cnt || 0) > 0
}

// DELETE stock initial
export async function DELETE(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'stock_initial', 'delete') && !hasPermission(request as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus saldo awal stok' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const pool = (getDb() as any).$client

    // Get the stock balance to know ingredient_id & warehouse_id
    const sb = await rawGet<any>(`SELECT ingredient_id, warehouse_id, quantity FROM stock_balance WHERE id = $1`, [id])
    if (!sb) {
      return NextResponse.json({ error: 'Saldo awal tidak ditemukan' }, { status: 404 })
    }

    // Check if stock has been used in any transaction
    if (await checkInitialLocked(pool, Number(sb.ingredient_id), Number(sb.warehouse_id))) {
      return NextResponse.json({
        error: 'Tidak bisa menghapus saldo awal karena stok barang ini sudah memiliki riwayat transaksi (pembelian, penjualan, produksi, dll).',
        code: 'INITIAL_STOCK_LOCKED'
      }, { status: 409 })
    }

    // Delete stock balance
    await rawRun(`DELETE FROM stock_balance WHERE id = $1`, [id])

    // Delete related stock movements
    await rawRun(`
      DELETE FROM stock_movements 
      WHERE reference_type = 'initial_stock' AND reference_id = $1
    `, [id])

    return NextResponse.json({ 
      success: true, 
      message: 'Saldo awal berhasil dihapus' 
    })
  } catch (error: any) {
    console.error('Error deleting stock initial:', error)
    return NextResponse.json({ error: 'Failed to delete stock initial', details: error.message }, { status: 500 })
  }
}
