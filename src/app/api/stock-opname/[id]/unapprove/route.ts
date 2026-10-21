import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    await addAuditColumns()
    const userId = getUserId(req)

    const hdr = await rawGet<any>('SELECT id, status FROM stock_opname WHERE id=?', [id])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    if (String(hdr.status) === 'posted') return NextResponse.json({ error: 'Dokumen sudah diposting' }, { status: 400 })

    let hasCounts = false
    try {
      const c = await rawGet<any>('SELECT COUNT(1) AS n FROM stock_opname_counts WHERE opname_id=?', [id])
      hasCounts = Number(c?.n || 0) > 0
    } catch {}

    const target = hasCounts ? 'submitted' : 'draft'

    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
    )
    const hasCol = (n: string) => cols.some(c => String(c.column_name).toLowerCase() === n.toLowerCase())
    const hasUserEdit = hasCol('user_edit')
    const hasUpdatedAt = hasCol('updated_at')

    if (hasUserEdit && hasUpdatedAt) {
      await rawRun('UPDATE stock_opname SET status=?, updated_at=CURRENT_TIMESTAMP, user_edit=? WHERE id=?', [target, userId || null, id])
    } else if (hasUpdatedAt) {
      await rawRun('UPDATE stock_opname SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [target, id])
    } else {
      await rawRun('UPDATE stock_opname SET status=? WHERE id=?', [target, id])
    }

    return NextResponse.json({ ok: true, status: target })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal unapprove dokumen' }, { status: 500 })
  }
}
