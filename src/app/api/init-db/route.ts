import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { seedDatabase } from '@/lib/seedDatabase'

export async function POST() {
  try {
    getDb()
    
    seedDatabase()
    
    return NextResponse.json({ 
      message: 'Database initialized and seeded successfully' 
    })
  } catch (error) {
    console.error('Database initialization error:', error)
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
