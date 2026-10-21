import { NextRequest, NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST(_req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client

    await pool.query('BEGIN')
    try {
      const tablesInOrder = [
        'transaction_items',
        'stock_movements',
        'transactions',
        'barang_recipes',
        'barang_prices',
        'barang_units',
        'master_barang',
        'master_ingredient',
        'master_customer',
        'master_periode',
        'master_merk',
        'master_spesifikasi',
        'master_kategori',
      ]

      for (const t of tablesInOrder) {
        await pool.query(`DELETE FROM ${t}`)
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true, message: 'All tables wiped and sequences reset.' })
  } catch (error: any) {
    console.error('reset-db error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to reset database' }, { status: 500 })
  }
}
