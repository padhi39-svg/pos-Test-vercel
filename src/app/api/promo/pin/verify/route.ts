import { NextRequest, NextResponse } from 'next/server'
import { getSettingPin } from '@/lib/repositories/promoRepository'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const pin = body?.pin ? String(body.pin) : ''
    const stored = await getSettingPin()
    if (!stored) {
      // belum ada PIN -> dianggap terbuka
      return NextResponse.json({ ok: true })
    }
    if (stored === pin) return NextResponse.json({ ok: true })
    return NextResponse.json({ error: 'PIN salah' }, { status: 403 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal verifikasi' }, { status: 500 })
  }
}
