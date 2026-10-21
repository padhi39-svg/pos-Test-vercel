import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || '')
    if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

    const rows = await rawAll<any>(`
      SELECT id, type, account_name, account_code, amount FROM fiscal_corrections WHERE year = ? ORDER BY type, account_name
    `, [year])
    return NextResponse.json({ corrections: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const { year, type, account_code, account_name, amount } = body
    if (!year || !type || !account_name) {
      return NextResponse.json({ error: 'year, type, account_name required' }, { status: 400 })
    }
    if (!['positif', 'negatif'].includes(type)) {
      return NextResponse.json({ error: 'type must be positif or negatif' }, { status: 400 })
    }
    const db = getDb()
    const pool = (db as any).$client
    const r = await pool.query(
      `INSERT INTO fiscal_corrections (year, type, account_code, account_name, amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [year, type, account_code || null, account_name, amount || 0]
    )
    return NextResponse.json({ success: true, id: r.rows[0].id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
