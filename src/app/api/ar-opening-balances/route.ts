import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'
import { getUserId } from '@/lib/audit'

function pad(n: number, len = 6) { return String(n).padStart(len, '0') }

const pool = (getDb() as any).$client

async function generateNumber(dateStr: string) {
  const year = String(dateStr).slice(0,4)
  const last = await rawGet<any>(`SELECT kode_nota FROM ar_opening_balances WHERE substr(kode_nota, 4, 4) = $1 ORDER BY id DESC LIMIT 1`, [year])
  let next = 1
  if (last && last.kode_nota) {
    const m = String(last.kode_nota).match(/SP\/(\d{4})\/(\d{6})$/)
    if (m) next = Math.max(next, Number(m[2]) + 1)
  }
  return `SP/${year}/${pad(next, 6)}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page')||'1'))
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize')||'10')))
  const q = (url.searchParams.get('q')||'').trim().toLowerCase()
  const start = url.searchParams.get('startDate')
  const end = url.searchParams.get('endDate')

  let where = '1=1'
  const params: any[] = []
  let pidx = 0
  if (q) {
    pidx++; where += ` AND (lower(kode_nota) LIKE $${pidx} OR EXISTS(SELECT 1 FROM master_customer c WHERE c.id = ar.customer_id AND (lower(c.code) LIKE $${pidx+1} OR lower(c.name) LIKE $${pidx+2})))`
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (start) { pidx++; where += ` AND tanggal >= $${pidx}`; params.push(start) }
  if (end) { pidx++; where += ` AND tanggal <= $${pidx}`; params.push(end) }

  const totalRow = await rawGet<any>(`SELECT COUNT(*) AS c FROM ar_opening_balances ar WHERE ${where}`, params)
  const total = Number(totalRow?.c || 0)
  const rows = await rawAll<any>(`
    SELECT ar.*, c.code as customer_code, c.name as customer_name
    FROM ar_opening_balances ar
    LEFT JOIN master_customer c ON c.id = ar.customer_id
    WHERE ${where}
    ORDER BY ar.tanggal DESC, ar.id DESC
    LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}
  `, params)

  let paidSet = new Set<number>()
  try {
    const paidRows = await rawAll<any>(`
      SELECT si.source_id AS src_id, COALESCE(SUM(si.pay_amount),0) AS paid
      FROM ar_payment_items si
      JOIN ar_payments sp ON sp.id = si.payment_id AND sp.status = 'active'
      WHERE si.source_type = 'ar_opening'
      GROUP BY si.source_id
    `)
    for (const r of paidRows) {
      if (Number(r.paid||0) > 0) paidSet.add(Number(r.src_id))
    }
  } catch {}

  const withFlags = rows.map(r => ({ ...r, is_paid: paidSet.has(Number(r.id)) ? 1 : 0, void: r.status === 'void' ? 1 : 0 }))
  return NextResponse.json({ data: withFlags, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}))
    const customerId = Number(body?.partnerId || body?.customerId)
    const nominal = Math.max(0, Number(body?.nominal)||0)
    const canBackdate = await getAllowBackdate(pool) || hasPermission(req as any, 'keu_saldo_awal_piutang', 'backdate')
    const getDefaultTanggal = async () => {
      const firstRow = await rawGet<any>('SELECT start_date FROM master_periode WHERE id = 1 LIMIT 1')
      if (firstRow?.start_date) {
        return firstRow.start_date instanceof Date
          ? `${firstRow.start_date.getFullYear()}-${String(firstRow.start_date.getMonth()+1).padStart(2,'0')}-${String(firstRow.start_date.getDate()).padStart(2,'0')}`
          : String(firstRow.start_date).slice(0,10)
      }
      const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10)
    }
    let tanggal = String(body?.tanggal || '')
    if (!canBackdate || !tanggal) {
      tanggal = await getDefaultTanggal()
    }
    if (!customerId) return NextResponse.json({ error: 'Customer wajib diisi' }, { status: 400 })

    const userId = getUserId(req)
    const kode = await generateNumber(tanggal)
    const info = await pool.query(`
      INSERT INTO ar_opening_balances(kode_nota, tanggal, customer_id, nominal, period_id, notes, status, user_create)
      VALUES($1, $2, $3, $4, 1, $5, 'posted', $6)
      RETURNING id
    `, [kode, tanggal, customerId, nominal, String(body?.notes||body?.catatan||''), userId])
    const row = await rawGet<any>('SELECT * FROM ar_opening_balances WHERE id = $1', [Number(info.rows[0].id)])
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal membuat saldo awal piutang' }, { status: 500 })
  }
}
