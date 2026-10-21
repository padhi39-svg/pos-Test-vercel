import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { listPromosAll, createPromo } from '@/lib/repositories/promoRepository'

export async function GET(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const rows = await listPromosAll()
  return NextResponse.json({ rows })
}

export async function POST(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'create'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    if (!body?.nama) return NextResponse.json({ error: 'nama wajib' }, { status: 400 })
    const row = await createPromo({
      nama: String(body.nama),
      deskripsi: body.deskripsi ? String(body.deskripsi) : undefined,
      bannerImage: body.bannerImage ? String(body.bannerImage) : undefined,
      tipeDiskon: body.tipeDiskon ? String(body.tipeDiskon) : 'persen',
      nilaiDiskon: body.nilaiDiskon != null ? Number(body.nilaiDiskon) : 0,
      mulai: body.mulai ? String(body.mulai) : undefined,
      selesai: body.selesai ? String(body.selesai) : undefined,
      aktif: body.aktif != null ? Number(body.aktif) : 1,
    })
    return NextResponse.json({ row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal simpan' }, { status: 500 })
  }
}
