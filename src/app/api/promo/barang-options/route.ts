import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getBarangJadiOptions } from '@/lib/repositories/promoRepository'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const rows = await getBarangJadiOptions()
  const options = rows.map((r) => ({
    value: r.id,
    label: `${r.name}${r.kategori ? ' • ' + r.kategori : ''}`,
    description: r.code,
  }))
  return NextResponse.json({ rows, options })
}
