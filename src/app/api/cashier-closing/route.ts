import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getUserId, addAuditColumns } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'cashier_closing', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20))
    const offset = (page - 1) * limit
    const search = url.searchParams.get('search') || ''
    const tanggal = url.searchParams.get('tanggal') || ''

    const whereParts: string[] = []
    const params: any[] = []

    if (tanggal) {
      whereParts.push('cc.tanggal = ?')
      params.push(tanggal)
    }

    if (search) {
      whereParts.push('(cc.user_name LIKE ? OR CAST(cc.user_id AS TEXT) LIKE ? OR cc.notes LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like)
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    const countRow = await rawGet(`SELECT COUNT(*) as total FROM cashier_closing cc ${whereSql}`, params.length > 0 ? params : undefined) as any
    const total = countRow?.total || 0

    const data = await rawAll(`
      SELECT cc.*
      FROM cashier_closing cc
      ${whereSql}
      ORDER BY cc.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return NextResponse.json({
      data,
      pagination: { total, page, limit }
    })
  } catch (e: any) {
    console.error('GET /api/cashier-closing error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'cashier_closing', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getDb(); const pool = (db as any).$client
    addAuditColumns(db)
    const userId = getUserId(req)

    const body = await req.json()
    const { tanggal, user_id, tunai_di_kasir, notes } = body

    if (!tanggal || !user_id) {
      return NextResponse.json({ error: 'tanggal and user_id are required' }, { status: 400 })
    }

    const uid = Number(user_id)

    const existing = await rawGet(`SELECT COUNT(*) as cnt FROM cashier_closing WHERE user_id = ? AND tanggal = ?`, [uid, tanggal]) as any
    if (existing?.cnt > 0) {
      return NextResponse.json({ error: 'Closing sudah dibuat untuk user dan tanggal ini' }, { status: 409 })
    }

    const userRow = await rawGet(`SELECT name FROM master_users WHERE id = ?`, [uid]) as any
    const userName = userRow?.name || null

    const txnIds = await rawAll(`
      SELECT id FROM transactions
      WHERE COALESCE(void,0) = 0
        AND user_create = ?
        AND (tgl_nota = ? OR created_at::date = ?)
    `, [uid, tanggal, tanggal]) as { id: number }[]

    if (txnIds.length === 0) {
      return NextResponse.json({ error: 'Tidak ada transaksi untuk user dan tanggal ini' }, { status: 400 })
    }

    const idsStr = txnIds.map(r => r.id).join(',')

    const summaryTx = await rawGet(`
      SELECT COALESCE(SUM(total),0) as total_penjualan,
             COUNT(*) as jumlah_transaksi
      FROM transactions
      WHERE id IN (${idsStr})
    `) as any

    const summaryPay = await rawGet(`
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(method) IN ('cash','tunai') THEN amount ELSE 0 END),0) as total_tunai,
        COALESCE(SUM(CASE WHEN LOWER(method) NOT IN ('cash','tunai') THEN amount ELSE 0 END),0) as total_transfer,
        COALESCE(SUM(change_amount),0) as total_kembalian
      FROM transaction_payments
      WHERE transaction_id IN (${idsStr})
    `) as any

    const totalPenjualan = Number(summaryTx.total_penjualan)
    const totalTunai = Number(summaryPay.total_tunai)
    const totalTransfer = Number(summaryPay.total_transfer)
    const totalKembalian = Number(summaryPay.total_kembalian)
    const jumlahTransaksi = Number(summaryTx.jumlah_transaksi)
    const tunaiDiKasir = Number(tunai_di_kasir) || 0
    const selisihTunai = tunaiDiKasir - (totalTunai - totalKembalian)

    const result = await pool.query(`
      INSERT INTO cashier_closing (tanggal, user_id, user_name, total_penjualan, total_tunai, total_transfer, total_kembalian, tunai_di_kasir, selisih_tunai, jumlah_transaksi, notes, user_create, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      RETURNING id
    `, [tanggal, uid, userName, totalPenjualan, totalTunai, totalTransfer, totalKembalian, tunaiDiKasir, selisihTunai, jumlahTransaksi, notes || null, userId])

    return NextResponse.json({ success: true, id: result.rows[0].id as number })
  } catch (e: any) {
    console.error('POST /api/cashier-closing error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
