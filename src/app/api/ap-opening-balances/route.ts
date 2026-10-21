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
  const last = await rawGet<any>(`SELECT kode_nota FROM ap_opening_balances WHERE substr(kode_nota, 4, 4) = $1 ORDER BY id DESC LIMIT 1`, [year])
  let next = 1
  if (last && last.kode_nota) {
    const m = String(last.kode_nota).match(/SH\/(\d{4})\/(\d{6})$/)
    if (m) next = Math.max(next, Number(m[2]) + 1)
  }
  return `SH/${year}/${pad(next, 6)}`
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
    pidx++; where += ` AND (lower(kode_nota) LIKE $${pidx} OR EXISTS(SELECT 1 FROM master_supplier s WHERE s.id = ap.supplier_id AND (lower(s.code) LIKE $${pidx+1} OR lower(s.name) LIKE $${pidx+2})))`
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (start) { pidx++; where += ` AND tanggal >= $${pidx}`; params.push(start) }
  if (end) { pidx++; where += ` AND tanggal <= $${pidx}`; params.push(end) }

  const totalRow = await rawGet<any>(`SELECT COUNT(*) AS c FROM ap_opening_balances ap WHERE ${where}`, params)
  const total = Number(totalRow?.c || 0)
  const rows = await rawAll<any>(`
    SELECT ap.*, s.code as supplier_code, s.name as supplier_name
    FROM ap_opening_balances ap
    LEFT JOIN master_supplier s ON s.id = ap.supplier_id
    WHERE ${where}
    ORDER BY ap.tanggal DESC, ap.id DESC
    LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}
  `, params)

  let paidSet = new Set<number>()
  try {
    const paidRows = await rawAll<any>(`
      SELECT pi.source_id AS src_id, COALESCE(SUM(pi.pay_amount),0) AS paid
      FROM ap_payment_items pi
      JOIN ap_payments p ON p.id = pi.payment_id AND p.status <> 'void'
      WHERE pi.source_type = 'ap_opening'
      GROUP BY pi.source_id
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
    const supplierId = Number(body?.partnerId || body?.supplierId)
    const nominal = Math.max(0, Number(body?.nominal)||0)
    const canBackdate = getAllowBackdate(pool) || hasPermission(req as any, 'keu_saldo_awal_hutang', 'backdate')
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
    if (!supplierId) return NextResponse.json({ error: 'Supplier wajib diisi' }, { status: 400 })

    const userId = getUserId(req)
    const kode = await generateNumber(tanggal)
    const info = await pool.query(`
      INSERT INTO ap_opening_balances(kode_nota, tanggal, supplier_id, nominal, period_id, notes, status, user_create)
      VALUES($1, $2, $3, $4, 1, $5, 'posted', $6)
      RETURNING id
    `, [kode, tanggal, supplierId, nominal, String(body?.notes||body?.catatan||''), userId])
    const row = await rawGet<any>('SELECT * FROM ap_opening_balances WHERE id = $1', [Number(info.rows[0].id)])
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal membuat saldo awal hutang' }, { status: 500 })
  }
}
