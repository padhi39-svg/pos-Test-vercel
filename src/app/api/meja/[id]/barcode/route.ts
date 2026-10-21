import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { rawGet, rawRun } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id || 0) || 0
    if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

    const meja = (await rawGet(
      `SELECT id, code, name FROM master_meja WHERE id = ? AND COALESCE(isdelete,0) = 0`,
      [id],
    )) as any
    if (!meja) return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 })

    const envBase = (process.env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
    const origin = envBase || new URL(req.url).origin
    const url = `${origin}/q/${encodeURIComponent(String(meja.code))}`

    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    const base64 = dataUrl.split(',')[1] || ''

    await rawRun('UPDATE master_meja SET barcode_data = ? WHERE id = ?', [base64, id])

    return NextResponse.json({ dataUrl, url, code: meja.code, name: meja.name })
  } catch (e: any) {
    console.error('Error generate barcode:', e)
    return NextResponse.json({ error: e?.message || 'Gagal generate barcode' }, { status: 500 })
  }
}
