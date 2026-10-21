import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { getPeriodByDate } from '@/lib/period'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    await addAuditColumns()
    const userId = getUserId(req)

    const hdr = await rawGet<any>('SELECT id, status, tdate FROM stock_opname WHERE id=?', [id])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    if (String(hdr.status) === 'posted' || Number(hdr.status) === 2) return NextResponse.json({ error: 'Dokumen sudah diposting' }, { status: 400 })

    const approvePeriod = await getPeriodByDate(String(hdr.tdate || '').slice(0,10))
    if (!approvePeriod) {
      return NextResponse.json({ error: 'Periode tidak ditemukan untuk tanggal dokumen.' }, { status: 400 })
    }
    if (Number(approvePeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${approvePeriod.name}' sudah ditutup.` }, { status: 400 })
    }

    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
    )
    const hasCol = (n: string) => cols.some(c => String(c.column_name).toLowerCase() === n.toLowerCase())
    const hasUserEdit = hasCol('user_edit')
    const hasUpdatedAt = hasCol('updated_at')

    if (hasUserEdit) {
      await rawRun('UPDATE stock_opname SET status=1, updated_at=CURRENT_TIMESTAMP, user_edit=? WHERE id=?', [userId || null, id])
    } else if (hasUpdatedAt) {
      await rawRun('UPDATE stock_opname SET status=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id])
    } else {
      await rawRun('UPDATE stock_opname SET status=1 WHERE id=?', [id])
    }

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal approve dokumen' }, { status: 500 })
  }
}
