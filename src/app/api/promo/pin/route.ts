import { NextRequest, NextResponse } from 'next/server'
import { getSettingPin, setSettingPin } from '@/lib/repositories/promoRepository'

export async function GET() {
  const pin = await getSettingPin()
  return NextResponse.json({ set: !!pin })
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const pin = body?.pin ? String(body.pin) : ''
    if (!/^\d{4,8}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN harus 4-8 digit angka' }, { status: 400 })
    }
    await setSettingPin(pin)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal simpan PIN' }, { status: 500 })
  }
}
