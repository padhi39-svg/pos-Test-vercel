import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { deleteMenuItemPhoto } from '@/lib/repositories/promoRepository'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'delete'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    await deleteMenuItemPhoto(Number(params.id))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal hapus foto' }, { status: 500 })
  }
}
