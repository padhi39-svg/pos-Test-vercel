import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    
    // Check if master_supplier table exists
    const tableExists = await rawGet(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA AND table_name = 'master_supplier'
    `)
    
    if (tableExists) {
      return NextResponse.json({ 
        success: true, 
        message: 'Table master_supplier already exists',
        alreadyExists: true 
      })
    }
    
    // Create master_supplier table
    await rawRun(`
      CREATE TABLE master_supplier (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        npwp TEXT,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        term INTEGER DEFAULT 0,
        isdelete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Insert sample data
    await rawRun(`
      INSERT INTO master_supplier (code, name, address, phone, discount_percent, term)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['SUPP-001', 'Umum', 'Alamat Supplier Umum', '08123456789', 0, 0])
    
    // Verify table created
    const verifyTable = await rawGet(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' AND table_schema = CURRENT_SCHEMA AND table_name = 'master_supplier'
    `)
    
    if (!verifyTable) {
      throw new Error('Failed to create master_supplier table')
    }
    
    // Count rows
    const count = await rawGet<{ count: number }>('SELECT COUNT(*) as count FROM master_supplier')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Table master_supplier created successfully',
      sampleDataCount: count?.count ?? 0
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
}
