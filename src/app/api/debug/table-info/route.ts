import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('table') || 'stock_movements'

    const schema = await rawAll<any>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    )

    const foreignKeys = await rawAll<any>(
      `SELECT
        tc.table_schema, tc.table_name, kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
      [tableName]
    )

    const indexes = await rawAll<any>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`,
      [tableName]
    )

    const barangSample = await rawAll<any>(
      `SELECT id, code, name FROM master_barang 
       WHERE isdelete = 0 
       ORDER BY id 
       LIMIT 10`
    )

    return NextResponse.json({
      table: tableName,
      schema,
      foreignKeys,
      indexes,
      barangSample
    })
  } catch (error: any) {
    console.error('Error getting table info:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
