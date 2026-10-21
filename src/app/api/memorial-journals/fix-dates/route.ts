import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

const pool = (getDb() as any).$client

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_jurnal_memorial', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const fromDate = searchParams.get('from') || ''
    const toDate = searchParams.get('to') || ''

    let conditions = "WHERE j.status = 'active'"
    const params: string[] = []

    if (fromDate && toDate) {
      conditions += " AND j.journal_date >= $1 AND j.journal_date <= $2"
      params.push(fromDate, toDate)
    } else if (fromDate) {
      conditions += " AND j.journal_date >= $1"
      params.push(fromDate)
    } else if (toDate) {
      conditions += " AND j.journal_date <= $1"
      params.push(toDate)
    }

    const rows = await rawAll<any[]>(`
      SELECT j.id, j.journal_number, j.journal_date, j.created_at
      FROM memorial_journals j
      ${conditions}
      ORDER BY j.journal_date DESC
      LIMIT 100
    `, params.length > 0 ? params : undefined)

    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_jurnal_memorial', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : []
    const newDate = String(body.date || '').slice(0, 10)

    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return NextResponse.json({ error: 'Parameter "date" (YYYY-MM-DD) wajib diisi' }, { status: 400 })
    }

    // Hitung tanggal yang salah (1 hari sebelum newDate)
    const d = new Date(newDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    const wrongDate = d.toISOString().slice(0, 10)

    let updated = 0
    if (ids.length > 0) {
      for (const id of ids) {
        const r = await pool.query(
          `UPDATE memorial_journals SET journal_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND journal_date = $3`,
          [newDate, id, wrongDate]
        )
        if (r.rowCount > 0) updated++
      }
    } else {
      const r = await pool.query(
        `UPDATE memorial_journals SET journal_date = $1, updated_at = CURRENT_TIMESTAMP WHERE journal_date = $2 AND status = 'active'`,
        [newDate, wrongDate]
      )
      updated = r.rowCount || 0
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `${updated} jurnal diperbaiki: tanggal ${wrongDate} → ${newDate}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
