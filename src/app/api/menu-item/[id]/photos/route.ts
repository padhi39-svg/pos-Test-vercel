import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { listMenuItemPhotos, addMenuItemPhoto } from '@/lib/repositories/promoRepository'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const rows = await listMenuItemPhotos(Number(params.id))
  return NextResponse.json({ rows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'create'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    if (!body?.imageUrl) return NextResponse.json({ error: 'imageUrl wajib' }, { status: 400 })
    const row = await addMenuItemPhoto(Number(params.id), String(body.imageUrl))
    return NextResponse.json({ row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal tambah foto' }, { status: 500 })
  }
}
