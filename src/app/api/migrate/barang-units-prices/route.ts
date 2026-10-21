import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    const pool = (db as any).$client
    
    // Create barang_units table
    await rawRun(`
      CREATE TABLE IF NOT EXISTS barang_units (
        id SERIAL PRIMARY KEY,
        barang_id INTEGER NOT NULL,
        unit_name TEXT NOT NULL,
        ratio_to_smallest INTEGER DEFAULT 1,
        is_smallest BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (barang_id) REFERENCES master_barang(id),
        UNIQUE(barang_id, unit_name)
      )
    `)
    
    // Create barang_prices table
    await rawRun(`
      CREATE TABLE IF NOT EXISTS barang_prices (
        id SERIAL PRIMARY KEY,
        barang_id INTEGER NOT NULL,
        unit_id INTEGER NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        effective_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (barang_id) REFERENCES master_barang(id),
        FOREIGN KEY (unit_id) REFERENCES barang_units(id)
      )
    `)
    
    console.log('✓ Tables barang_units and barang_prices created')
    
    // Check if we need to populate default data
    const unitsCount = await rawGet<{count: number}>('SELECT COUNT(*) as count FROM barang_units')
    
    if (unitsCount?.count === 0) {
      console.log('Populating default units for existing barang...')
      
      // Get all active barang
      const barangs = await rawAll<any[]>(`
        SELECT id, code, name, price, smallest_unit 
        FROM master_barang 
        WHERE isdelete = 0 AND jenis = 1
      `)
      
      for (const barang of barangs) {
        try {
          // Create default unit (PCS with ratio 1)
          const unitResult = await pool.query(
            'INSERT INTO barang_units (barang_id, unit_name, ratio_to_smallest, is_smallest) VALUES ($1, $2, $3, $4) RETURNING id',
            [barang.id, barang.smallest_unit || 'PCS', 1, true]
          )
          
          const unitId = unitResult.rows[0].id
          
          // Create default price
          await pool.query(
            'INSERT INTO barang_prices (barang_id, unit_id, price, effective_date) VALUES ($1, $2, $3, CURRENT_DATE)',
            [barang.id, unitId, barang.price || 0]
          )
          
          console.log(`✓ Created default unit for ${barang.code}`)
        } catch (err) {
          console.error(`Error creating unit for ${barang.code}:`, err)
        }
      }
      
      console.log(`✓ Created default units for ${barangs.length} products`)
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tables barang_units and barang_prices created successfully',
      unitsCreated: unitsCount?.count === 0
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
}
