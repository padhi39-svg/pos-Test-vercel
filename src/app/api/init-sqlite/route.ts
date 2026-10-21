import { NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { getDb } from '@/db'
import { seedDatabase } from '@/lib/seedDatabase'

export async function POST() {
  try {
    console.log('Initializing database...')
    
    const db = getDb()
    
    seedDatabase()
    
    const kategori = await rawGet('SELECT COUNT(*) as count FROM master_kategori WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const spesifikasi = await rawGet('SELECT COUNT(*) as count FROM master_spesifikasi WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const merk = await rawGet('SELECT COUNT(*) as count FROM master_merk WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const periode = await rawGet('SELECT COUNT(*) as count FROM master_periode WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const customer = await rawGet('SELECT COUNT(*) as count FROM master_customer WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const ingredient = await rawGet('SELECT COUNT(*) as count FROM master_ingredient WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const barang = await rawGet('SELECT COUNT(*) as count FROM master_barang WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const transactions = await rawGet('SELECT COUNT(*) as count FROM transactions') as { count: number }
    
    return NextResponse.json({ 
      message: 'Database initialized and seeded successfully',
      counts: {
        kategori: kategori.count,
        spesifikasi: spesifikasi.count,
        merk: merk.count,
        periode: periode.count,
        customer: customer.count,
        ingredient: ingredient.count,
        barang: barang.count,
        transactions: transactions.count
      }
    })
  } catch (error) {
    console.error('Database initialization error:', error)
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
