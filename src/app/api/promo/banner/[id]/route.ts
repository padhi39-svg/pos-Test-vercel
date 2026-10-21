import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { updateBanner, deleteBanner } from '@/lib/repositories/promoRepository'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const id = Number(params.id)
    const body = await req.json()
    const data: any = {}
    if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl)
    if (body.title !== undefined) data.title = body.title ? String(body.title) : null
    if (body.subtitle !== undefined) data.subtitle = body.subtitle ? String(body.subtitle) : null
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl ? String(body.linkUrl) : null
    if (body.urutan !== undefined) data.urutan = Number(body.urutan)
    if (body.aktif !== undefined) data.aktif = Number(body.aktif)
    const row = await updateBanner(id, data)
    return NextResponse.json({ row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'delete'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    await deleteBanner(Number(params.id))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal hapus' }, { status: 500 })
  }
}
