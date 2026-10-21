import { NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await rawRun(`ALTER TABLE menu_item ADD COLUMN IF NOT EXISTS media_category TEXT`)
    await rawRun(`ALTER TABLE menu_item ADD COLUMN IF NOT EXISTS is_recommended INTEGER DEFAULT 0`)
    await rawRun(`ALTER TABLE menu_item ADD COLUMN IF NOT EXISTS is_new INTEGER DEFAULT 0`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Migration gagal' }, { status: 500 })
  }
}
