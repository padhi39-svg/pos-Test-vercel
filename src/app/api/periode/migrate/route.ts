import { NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'

export async function POST() {
  try {
    const messages: string[] = []

    try {
      await rawGet('SELECT is_closed FROM master_periode LIMIT 1')
      messages.push('✓ Column is_closed already exists')
    } catch {
      await rawRun('ALTER TABLE master_periode ADD COLUMN is_closed INTEGER DEFAULT 0')
      messages.push('✓ Added column is_closed (default 0)')
    }

    try {
      await rawGet('SELECT is_active FROM master_periode LIMIT 1')
      messages.push('✓ Column is_active already exists')
    } catch {
      await rawRun('ALTER TABLE master_periode ADD COLUMN is_active INTEGER DEFAULT 1')
      messages.push('✓ Added column is_active (default 1)')
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed',
      details: messages
    })
  } catch (error: any) {
    console.error('Error migrating periode table:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
