import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getPromoItems, setPromoItems } from '@/lib/repositories/promoRepository'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const rows = await getPromoItems(Number(params.id))
  return NextResponse.json({ rows })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const barangIds: number[] = Array.isArray(body?.barangIds)
      ? body.barangIds.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))
      : []
    await setPromoItems(Number(params.id), barangIds)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal simpan item' }, { status: 500 })
  }
}
