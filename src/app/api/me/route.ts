import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    
    // Get session token from cookies
    const sessionToken = req.cookies.get('session_token')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Ensure sessions table exists
    await rawRun(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
    `)
    
    // Get user from session
    const user = await rawGet(`
      SELECT u.id, u.code, u.name, u.email, u.level_id, lm.name as level_name
      FROM sessions s
      JOIN master_users u ON u.id = s.user_id
      LEFT JOIN master_level_manager lm ON lm.id = u.level_id
      WHERE s.token = ? 
        AND (s.expires_at IS NULL OR s.expires_at::timestamptz > CURRENT_TIMESTAMP)
        AND COALESCE(u.isdelete, 0) = 0
        AND COALESCE(u.aktif, 1) = 1
      LIMIT 1
    `, [sessionToken]) as any
    
    if (!user) {
      return NextResponse.json({ error: 'Session expired or invalid' }, { status: 401 })
    }
    
    return NextResponse.json({
      id: user.id,
      code: user.code,
      name: user.name,
      email: user.email,
      levelId: user.level_id,
      levelName: user.level_name,
    })
  } catch (e: any) {
    console.error('GET /api/me error:', e)
    return NextResponse.json({ error: 'Failed to get current user' }, { status: 500 })
  }
}
