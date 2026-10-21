import { NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb(); const pool = (db as any).$client

    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_gudang (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        isdelete INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('✅ Table master_gudang created')

    const sampleData = [
      { code: 'GDG-001', name: 'Gudang Utama', is_active: 1 },
      { code: 'GDG-002', name: 'Gudang Bahan Baku', is_active: 1 },
      { code: 'GDG-003', name: 'Gudang Produk Jadi', is_active: 1 }
    ]

    for (const item of sampleData) {
      await rawRun(`
        INSERT INTO master_gudang (code, name, is_active, isdelete)
        VALUES (?, ?, ?, 0)
        ON CONFLICT (code) DO NOTHING
      `, [item.code, item.name, item.is_active])
    }

    console.log('✅ Sample data inserted')

    return NextResponse.json({ 
      success: true, 
      message: 'Table master_gudang created successfully with sample data' 
    })
  } catch (error: any) {
    console.error('Error creating master_gudang table:', error)
    return NextResponse.json(
      { error: 'Failed to create table', details: error.message },
      { status: 500 }
    )
  }
}
