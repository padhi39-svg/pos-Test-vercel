import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'
import { getUserId } from '@/lib/audit'

const pool = (getDb() as any).$client

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const row = await rawGet<any>(`
    SELECT ar.*, c.code as customer_code, c.name as customer_name
    FROM ar_opening_balances ar
    LEFT JOIN master_customer c ON c.id = ar.customer_id
    WHERE ar.id = $1
  `, [Number(params.id)])
  if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(()=>({}))
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    if (String(body?.action||'') === 'void') {
      const userId = getUserId(req)
      await rawRun(`UPDATE ar_opening_balances SET status='void', user_edit=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [userId || null, id])
      const row = await rawGet<any>('SELECT * FROM ar_opening_balances WHERE id=$1', [id])
      return NextResponse.json(row)
    }

    const canBackdate = await getAllowBackdate(pool) || hasPermission(req as any, 'keu_saldo_awal_piutang', 'backdate')
    const tanggal = canBackdate ? String(body?.tanggal||'') : ''
    const customerId = body?.partnerId || body?.customerId
    const nominal = body?.nominal
    const notes = body?.notes ?? body?.catatan

    const sets: string[] = []
    const paramsArr: any[] = []
    let pidx = 0
    const userId = getUserId(req)
    if (tanggal) { pidx++; sets.push(`tanggal = $${pidx}`); paramsArr.push(tanggal) }
    if (typeof customerId !== 'undefined') { pidx++; sets.push(`customer_id = $${pidx}`); paramsArr.push(Number(customerId)) }
    if (typeof nominal !== 'undefined') { pidx++; sets.push(`nominal = $${pidx}`); paramsArr.push(Math.max(0, Number(nominal)||0)) }
    if (typeof notes !== 'undefined') { pidx++; sets.push(`notes = $${pidx}`); paramsArr.push(String(notes||'')) }
    pidx++; sets.push(`user_edit = $${pidx}`); paramsArr.push(userId || null)
    sets.push('updated_at = CURRENT_TIMESTAMP')

    if (sets.length > 0) {
      const sql = `UPDATE ar_opening_balances SET ${sets.join(', ')} WHERE id=$${pidx + 1}`
      paramsArr.push(id)
      await rawRun(sql, paramsArr)
    }

    const row = await rawGet<any>('SELECT * FROM ar_opening_balances WHERE id=$1', [id])
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah saldo awal piutang' }, { status: 500 })
  }
}
