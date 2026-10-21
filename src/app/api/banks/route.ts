import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterBanks, accounts } from '@/db/schema'
import { eq, and, asc, desc, sql, like, or, count } from 'drizzle-orm'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const canBank = hasPermission(req as any, 'bank', 'view')
    const canPosResto = hasPermission(req as any, 'pos_resto', 'view')
    const canSalesList = hasPermission(req as any, 'sales_list', 'view')
    const canTransaksi = hasPermission(req as any, 'transaksi', 'view')
    if (!canBank && !canPosResto && !canSalesList && !canTransaksi) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat bank' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const sortBy = searchParams.get('sort_by') || 'id'
    const sortDir = (searchParams.get('sort_dir') || 'desc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20))

    const db = getDb()
    const pool = (db as any).$client
    try {
      await pool.query(`ALTER TABLE master_banks ADD COLUMN IF NOT EXISTS account_id INTEGER`)
    } catch {}

    const allowedSort: Record<string, any> = {
      name: masterBanks.bankName,
      ownerName: masterBanks.ownerName,
      accountNumber: masterBanks.accountNumber,
      id: masterBanks.id,
    }
    const orderCol = allowedSort[sortBy] || masterBanks.id
    const orderFn = sortDir === 'asc' ? asc : desc

    const conditions = [eq(masterBanks.isdelete, 0)]
    if (q) {
      conditions.push(
        or(
          like(masterBanks.bankName, `%${q}%`),
          like(masterBanks.ownerName, `%${q}%`),
          like(masterBanks.accountNumber, `%${q}%`),
        )!,
      )
    }
    const where = and(...conditions)!
    const offset = (page - 1) * pageSize

    let rows: any[]
    let total: number

    try {
      const [totalResult, data] = await Promise.all([
        db.select({ value: count() }).from(masterBanks).where(where),
        db.select({
          id: masterBanks.id,
          name: masterBanks.bankName,
          ownerName: masterBanks.ownerName,
          accountNumber: masterBanks.accountNumber,
          accountId: masterBanks.accountId,
          accountCode: accounts.code,
          accountName: accounts.name,
          createdAt: masterBanks.createdAt,
          updatedAt: masterBanks.updatedAt,
        }).from(masterBanks)
          .leftJoin(accounts, eq(accounts.id, masterBanks.accountId))
          .where(where)
          .orderBy(orderFn(orderCol))
          .limit(pageSize)
          .offset(offset),
      ])
      total = Number(totalResult[0]?.value || 0)
      rows = data
    } catch {
      const [totalResult, data] = await Promise.all([
        db.select({ value: count() }).from(masterBanks).where(where),
        db.select({
          id: masterBanks.id,
          name: masterBanks.bankName,
          ownerName: masterBanks.ownerName,
          accountNumber: masterBanks.accountNumber,
          accountId: masterBanks.accountId,
          createdAt: masterBanks.createdAt,
          updatedAt: masterBanks.updatedAt,
        }).from(masterBanks)
          .where(where)
          .orderBy(orderFn(orderCol))
          .limit(pageSize)
          .offset(offset),
      ])
      total = Number(totalResult[0]?.value || 0)
      rows = data
    }

    return NextResponse.json({ rows, total, page, pageSize })
  } catch (e: any) {
    console.error('GET /api/banks error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch banks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'bank', 'create') && !hasPermission(req as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat bank' }, { status: 403 })
    }
    const body = await req.json()
    const { bankName, ownerName, accountNumber, accountId } = body || {}
    if (!bankName) {
      return NextResponse.json({ error: 'bankName is required' }, { status: 400 })
    }
    const upperBank = String(bankName).toUpperCase().trim()
    const titleOwner = ownerName ? String(ownerName).toLowerCase().split(/\s+/).filter(Boolean).map((w:string)=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ') : null
    const digitsOnly = accountNumber != null && accountNumber !== '' ? String(accountNumber).replace(/\D/g,'') : ''

    const db = getDb()
    const pool = (db as any).$client
    try {
      await pool.query(`ALTER TABLE master_banks ADD COLUMN IF NOT EXISTS account_id INTEGER`)
    } catch {}
    const userId = getUserId(req)
    const accIdVal = (accountId != null && accountId !== '') ? Number(accountId) : null
    const result = await pool.query(`
      INSERT INTO master_banks (bank_name, owner_name, account_number, account_id, user_create, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, bank_name, owner_name, account_number, account_id, created_at, updated_at
    `, [upperBank, titleOwner, digitsOnly, accIdVal, userId])

    const created = result.rows[0]

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/banks error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create bank' }, { status: 500 })
  }
}
