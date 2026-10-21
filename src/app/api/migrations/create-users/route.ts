import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'

export async function GET(_req: NextRequest) {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'staff',
        password_hash TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        isdelete INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_users_code ON users(code)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_users_isdelete ON users(isdelete)') } catch {}

    const sample = await rawAll<any>('SELECT id, code, name, email, role, is_active, isdelete, created_at FROM users ORDER BY id DESC LIMIT 5')
    return NextResponse.json({ ok: true, action: 'create-users', sample })
  } catch (e: any) {
    console.error('create-users migration error', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
