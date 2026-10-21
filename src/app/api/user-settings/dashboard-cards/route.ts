import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { getUserId } from '@/lib/audit'

const SETTING_KEY = 'dashboard_cards'

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req)

    await rawRun(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, setting_key)
      )
    `)

    const row = await rawGet<{ setting_value: string }>(
      `SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = $2`,
      [userId, SETTING_KEY]
    )

    const value = row ? JSON.parse(row.setting_value) : null
    return NextResponse.json({ value })
  } catch (error) {
    console.error('Error loading dashboard card settings:', error)
    return NextResponse.json({ value: null })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = getUserId(req)
    const body = await req.json()

    await rawRun(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, setting_key)
      )
    `)

    await rawRun(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, SETTING_KEY, JSON.stringify({ cards: body.cards, quickActions: body.quickActions })]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving dashboard card settings:', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
