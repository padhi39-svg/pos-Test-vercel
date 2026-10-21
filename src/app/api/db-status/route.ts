import { NextResponse } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'

export async function GET() {
  try {
    const barangCount = await rawGet('SELECT COUNT(*) as count FROM master_barang WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const customerCount = await rawGet('SELECT COUNT(*) as count FROM master_customer WHERE COALESCE(isdelete, 0) = 0') as { count: number }
    const transactionCount = await rawGet('SELECT COUNT(*) as count FROM transactions') as { count: number }
    
    const tables = await rawAll(`
      SELECT table_name as name FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND (table_name LIKE 'master_%' OR table_name LIKE 'barang_%' OR table_name = 'transactions')
    `)
    
    return NextResponse.json({
      status: 'connected',
      tables: tables.length,
      data: {
        barang: barangCount.count,
        customers: customerCount.count,
        transactions: transactionCount.count
      },
      message: 'Database is ready'
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
