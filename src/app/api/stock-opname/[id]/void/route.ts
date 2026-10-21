import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { getPeriodByDate } from '@/lib/period'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try{
    const id = Number(params.id)
    if (!Number.isFinite(id) || id<=0) return NextResponse.json({ error: 'Dokumen tidak valid' }, { status: 400 })
    const body = await req.json().catch(()=>({}))
    const reason = String(body?.reason || '').trim()
    if (!reason) return NextResponse.json({ error: 'Alasan void wajib diisi' }, { status: 400 })

    await addAuditColumns()

    const hdr = await rawGet<any>('SELECT id, status, tdate FROM stock_opname WHERE id=?', [id])
    if (!hdr) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const voidPeriod = await getPeriodByDate(String(hdr.tdate || '').slice(0,10))
    if (voidPeriod && Number(voidPeriod.is_closed) === 1) {
      return NextResponse.json({ error: `Periode '${voidPeriod.name}' sudah ditutup, tidak dapat void.` }, { status: 400 })
    }

    const stStr = String(hdr.status)
    const stNum = Number(hdr.status)
    if (stStr==='posted' || stStr==='approved' || stNum===1 || stNum===2) {
      return NextResponse.json({ error: 'Dokumen sudah approved, tidak dapat di-void' }, { status: 400 })
    }

    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_opname' AND table_schema = 'public'"
    )
    const hasCol = (n:string)=> cols.some(c=> String(c.column_name).toLowerCase()===n)
    try{
      const hasVoid = hasCol('void')
      if (!hasVoid) await rawRun('ALTER TABLE stock_opname ADD COLUMN void INTEGER DEFAULT 0')
    }catch{}
    const hasVoidReason = hasCol('void_reason')
    const hasUserVoidCol = hasCol('user_void')
    if (!hasVoidReason) {
      try { await rawRun('ALTER TABLE stock_opname ADD COLUMN void_reason TEXT') } catch {}
    }
    if (!hasUserVoidCol) {
      try { await rawRun('ALTER TABLE stock_opname ADD COLUMN user_void INTEGER') } catch {}
    }

    const userId = getUserId(req)
    const hasUserVoid = hasCol('user_void')
    const hasUserEdit = hasCol('user_edit')
    const hasUpdatedAt = hasCol('updated_at')
    const appendNotesSQL = `CASE WHEN notes IS NULL OR TRIM(notes)='' THEN 'VOID: ' || ? ELSE notes || E'\\n' || 'VOID: ' || ? END`

    if (hasUserVoid && hasUpdatedAt) {
      await rawRun(`UPDATE stock_opname SET void=1, void_reason=?, notes=${appendNotesSQL}, user_void=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reason, reason, reason, userId || null, id])
    } else if (hasUserVoid) {
      await rawRun(`UPDATE stock_opname SET void=1, void_reason=?, notes=${appendNotesSQL}, user_void=? WHERE id=?`, [reason, reason, reason, userId || null, id])
    } else if (hasUserEdit && hasUpdatedAt) {
      await rawRun(`UPDATE stock_opname SET void=1, void_reason=?, notes=${appendNotesSQL}, user_edit=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reason, reason, reason, userId || null, id])
    } else if (hasUserEdit) {
      await rawRun(`UPDATE stock_opname SET void=1, void_reason=?, notes=${appendNotesSQL}, user_edit=? WHERE id=?`, [reason, reason, reason, userId || null, id])
    } else if (hasUpdatedAt) {
      await rawRun(`UPDATE stock_opname SET void=1, void_reason=?, notes=${appendNotesSQL}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reason, reason, reason, id])
    } else {
      await rawRun(`UPDATE stock_opname SET void=1, void_reason=?, notes=${appendNotesSQL} WHERE id=?`, [reason, reason, reason, id])
    }

    return NextResponse.json({ ok: true })
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal mem-void dokumen' }, { status: 500 })
  }
}
