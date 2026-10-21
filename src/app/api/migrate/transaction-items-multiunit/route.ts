import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    
    // Check if columns already exist
    const tableInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transaction_items'`)
    const hasUnitName = tableInfo.some((col: any) => col.name === 'unit_name')
    const hasUnitRatio = tableInfo.some((col: any) => col.name === 'unit_ratio')
    const hasDiscountPercent = tableInfo.some((col: any) => col.name === 'discount_percent')
    const hasDiscountAmount = tableInfo.some((col: any) => col.name === 'discount_amount')
    
    const updates: string[] = []
    
    if (!hasUnitName) {
      await rawRun(`ALTER TABLE transaction_items ADD COLUMN unit_name TEXT DEFAULT 'PCS'`)
      updates.push('unit_name')
    }
    
    if (!hasUnitRatio) {
      await rawRun(`ALTER TABLE transaction_items ADD COLUMN unit_ratio INTEGER DEFAULT 1`)
      updates.push('unit_ratio')
    }
    
    if (!hasDiscountPercent) {
      await rawRun(`ALTER TABLE transaction_items ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0`)
      updates.push('discount_percent')
    }
    
    if (!hasDiscountAmount) {
      await rawRun(`ALTER TABLE transaction_items ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT 0`)
      updates.push('discount_amount')
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All columns already exist',
        alreadyExists: true 
      })
    }
    
    // Show current table schema
    const updatedTableInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'transaction_items'`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transaction items table updated successfully',
      columnsAdded: updates,
      currentColumns: updatedTableInfo.map((c: any) => c.name)
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
}
