import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { encrypt, maskKey } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET: Check if key is set and return masked version
export async function GET() {
  try {
    const row = await rawGet(
      `SELECT setting_value FROM settings WHERE setting_key = 'self_order_midtrans_server_key'`
    ) as any

    const hasKey = !!(row?.setting_value && row.setting_value.trim())
    const masked = hasKey ? maskKey(row.setting_value) : null

    return NextResponse.json({ hasKey, masked })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// POST: Save encrypted key (overwrite)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const serverKey = String(body?.serverKey || '').trim()

    if (!serverKey) {
      return NextResponse.json({ error: 'Server key tidak boleh kosong' }, { status: 400 })
    }

    const encrypted = encrypt(serverKey)

    await rawRun(
      `INSERT INTO settings (setting_key, setting_value, setting_group)
       VALUES ('self_order_midtrans_server_key', $1, 'selforder')
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1`,
      [encrypted]
    )

    return NextResponse.json({ ok: true, masked: maskKey(encrypted) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: 500 })
  }
}
