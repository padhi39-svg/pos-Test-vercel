import { NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'

export async function POST() {
  try {
    await rawRun(`ALTER TABLE menu_item ADD COLUMN IF NOT EXISTS photo_url text`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal migrasi' }, { status: 500 })
  }
}
