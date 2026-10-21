import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { deleteMenuItem, toggleMenuItem, reorderMenuItem, updateMenuItemDeskripsi, updateMenuItemPhoto, updateMenuItemMediaSettings, updateMenuItemDiskon } from '@/lib/repositories/promoRepository'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'delete'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    await deleteMenuItem(Number(params.id))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal hapus' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    let row = null
    if (body?.deskripsi !== undefined) row = await updateMenuItemDeskripsi(Number(params.id), String(body.deskripsi || ''))
    else if (body?.diskon !== undefined) row = await updateMenuItemDiskon(Number(params.id), Number(body.diskon))
    else if (body?.aktif !== undefined) row = await toggleMenuItem(Number(params.id), Number(body.aktif))
    else if (body?.urutan !== undefined) row = await reorderMenuItem(Number(params.id), Number(body.urutan))
    else if (body?.photoUrl !== undefined) row = await updateMenuItemPhoto(Number(params.id), body.photoUrl ? String(body.photoUrl) : null)
    else if (body?.mediaCategory !== undefined || body?.isRecommended !== undefined || body?.isNew !== undefined) {
      // preserve existing values when only one field is sent (e.g. paket creation sets only mediaCategory)
      if (body?.mediaCategory !== undefined && body?.isRecommended === undefined && body?.isNew === undefined) {
        // update only media_category to avoid resetting flags
        const { rawRun } = await import('@/db/raw')
        await rawRun(`UPDATE menu_item SET media_category = ? WHERE id = ?`, [body.mediaCategory ? String(body.mediaCategory) : null, Number(params.id)])
        row = { id: Number(params.id) } as any
      } else {
        const current = await updateMenuItemMediaSettings(
          Number(params.id),
          body.mediaCategory !== undefined ? (body.mediaCategory ? String(body.mediaCategory) : null) : null,
          Number(body.isRecommended) || 0,
          Number(body.isNew) || 0,
        )
        row = current
      }
    }
    return NextResponse.json({ row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal update' }, { status: 500 })
  }
}
