import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { migrateDatabase } from '@/lib/dbMigrate'

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const { actions } = await migrateDatabase(pool)
    return NextResponse.json({ success: true, actions })
  } catch (e: any) {
    console.error('db migrate error', e)
    return NextResponse.json({ error: e?.message || 'Failed migrate' }, { status: 500 })
  }
}
