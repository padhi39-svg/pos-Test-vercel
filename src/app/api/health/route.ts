import { NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const row = await rawGet<{ ok: number }>('SELECT 1 as ok')
    return NextResponse.json({ ok: true, db: !!row })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'DB unreachable' }, { status: 500 })
  }
}
