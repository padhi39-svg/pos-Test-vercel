import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getDb()
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || '')
    if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })
    const row = await rawGet(`SELECT omzet, pph25 FROM fiscal_settings WHERE year = ?`, [year]) as any
    return NextResponse.json(row || { omzet: 0, pph25: 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getDb()
    const body = await req.json()
    const { year, omzet, pph25 } = body
    if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })
    await rawRun(`
      INSERT INTO fiscal_settings (year, omzet, pph25, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(year) DO UPDATE SET omzet = excluded.omzet, pph25 = excluded.pph25, updated_at = excluded.updated_at
    `, [year, omzet || 0, pph25 || 0])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
