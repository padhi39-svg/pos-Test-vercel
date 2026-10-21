import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { reorderMenuItemPhotos } from '@/lib/repositories/promoRepository'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const ids: number[] = body?.ids || []
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids harus array' }, { status: 400 })
    await reorderMenuItemPhotos(Number(params.id), ids.map(Number))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal reorder' }, { status: 500 })
  }
}
