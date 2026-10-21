import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { updatePromo, deletePromo } from '@/lib/repositories/promoRepository'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const id = Number(params.id)
    const body = await req.json()
    const data: any = {}
    if (body.nama !== undefined) data.nama = String(body.nama)
    if (body.deskripsi !== undefined) data.deskripsi = body.deskripsi ? String(body.deskripsi) : null
    if (body.bannerImage !== undefined) data.bannerImage = body.bannerImage ? String(body.bannerImage) : null
    if (body.tipeDiskon !== undefined) data.tipeDiskon = String(body.tipeDiskon)
    if (body.nilaiDiskon !== undefined) data.nilaiDiskon = Number(body.nilaiDiskon)
    if (body.mulai !== undefined) data.mulai = body.mulai ? String(body.mulai) : null
    if (body.selesai !== undefined) data.selesai = body.selesai ? String(body.selesai) : null
    if (body.aktif !== undefined) data.aktif = Number(body.aktif)
    const row = await updatePromo(id, data)
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
    await deletePromo(Number(params.id))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal hapus' }, { status: 500 })
  }
}
