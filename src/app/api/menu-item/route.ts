import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { listMenuItemsAll, addMenuItem } from '@/lib/repositories/promoRepository'

export async function GET(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const paketParam = searchParams.get('paket')
  const rows = await listMenuItemsAll()
  let filtered = rows
  if (paketParam === '1') filtered = rows.filter((r: any) => r.mediaCategory === 'Paket')
  else if (paketParam === '0') filtered = rows.filter((r: any) => r.mediaCategory !== 'Paket')
  return NextResponse.json({ rows: filtered })
}

export async function POST(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'create'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    if (body?.barangId == null) return NextResponse.json({ error: 'barangId wajib' }, { status: 400 })
    const row = await addMenuItem(Number(body.barangId))
    return NextResponse.json({ row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal tambah' }, { status: 500 })
  }
}
