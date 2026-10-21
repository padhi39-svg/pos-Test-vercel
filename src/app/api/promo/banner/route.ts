import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { listBannersAll, createBanner, updateBanner, deleteBanner } from '@/lib/repositories/promoRepository'

export async function GET(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const rows = await listBannersAll()
  return NextResponse.json({ rows })
}

export async function POST(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'create'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    if (!body?.imageUrl) return NextResponse.json({ error: 'imageUrl wajib' }, { status: 400 })
    const row = await createBanner({
      imageUrl: String(body.imageUrl),
      title: body.title ? String(body.title) : undefined,
      subtitle: body.subtitle ? String(body.subtitle) : undefined,
      linkUrl: body.linkUrl ? String(body.linkUrl) : undefined,
      urutan: body.urutan != null ? Number(body.urutan) : 0,
      aktif: body.aktif != null ? Number(body.aktif) : 1,
    })
    return NextResponse.json({ row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal simpan' }, { status: 500 })
  }
}
