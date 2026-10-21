import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    
    // Check if npwp column exists in master_customer
    const tableInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_customer'`)
    const hasNpwp = tableInfo.some((col: any) => col.name === 'npwp')
    
    if (hasNpwp) {
      return NextResponse.json({ 
        success: true, 
        message: 'Column npwp already exists in master_customer',
        alreadyExists: true 
      })
    }
    
    // Add npwp column
    await rawRun(`ALTER TABLE master_customer ADD COLUMN npwp TEXT`)
    
    console.log('✓ Column npwp added to master_customer')
    
    // Verify
    const updatedInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_customer'`)
    const npwpAdded = updatedInfo.some((col: any) => col.name === 'npwp')
    
    if (!npwpAdded) {
      throw new Error('Failed to add npwp column')
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Column npwp added successfully to master_customer',
      columns: updatedInfo.map((c: any) => c.name)
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
}
