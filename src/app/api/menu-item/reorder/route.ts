import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { reorderMenuItems } from '@/lib/repositories/promoRepository'

export async function PATCH(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map((x: any) => Number(x)) : []
    if (ids.length === 0) return NextResponse.json({ error: 'ids kosong' }, { status: 400 })
    await reorderMenuItems(ids)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal reorder' }, { status: 500 })
  }
}
