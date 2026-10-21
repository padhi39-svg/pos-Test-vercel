import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    
    // Check if term column exists
    const tableInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_customer'`)
    const hasTerm = tableInfo.some((col: any) => col.name === 'term')
    
    if (hasTerm) {
      return NextResponse.json({ 
        success: true, 
        message: 'Column term already exists',
        alreadyExists: true 
      })
    }
    
    // Add term column
    await rawRun(`ALTER TABLE master_customer ADD COLUMN term INTEGER DEFAULT 0`)
    
    // Verify
    const updatedInfo = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'master_customer'`)
    const termAdded = updatedInfo.some((col: any) => col.name === 'term')
    
    if (!termAdded) {
      throw new Error('Failed to add term column')
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Column term added successfully',
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
