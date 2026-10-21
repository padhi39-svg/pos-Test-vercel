import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterBanks, accounts } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const rowArr = await db.select({
      id: masterBanks.id,
      bankName: masterBanks.bankName,
      ownerName: masterBanks.ownerName,
      accountNumber: masterBanks.accountNumber,
      accountId: masterBanks.accountId,
      createdAt: masterBanks.createdAt,
      updatedAt: masterBanks.updatedAt,
    }).from(masterBanks)
      .where(and(eq(masterBanks.id, Number(params.id)), eq(masterBanks.isdelete, 0)))
    const row = rowArr[0]

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: any) {
    console.error('GET /api/banks/[id] error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch bank' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'bank', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah bank' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await req.json()
    const { bankName, ownerName, accountNumber, accountId } = body || {}
    const upperBank = typeof bankName === 'string' ? bankName.toUpperCase().trim() : null
    const titleOwner = typeof ownerName === 'string' ? ownerName.toLowerCase().split(/\s+/).filter(Boolean).map((w:string)=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ') : null
    const digitsOnly = typeof accountNumber === 'string' ? accountNumber.replace(/\D/g,'') : null

    const db = getDb()
    const pool = (db as any).$client

    const existsArr = await db.select({ id: masterBanks.id }).from(masterBanks)
      .where(and(eq(masterBanks.id, id), eq(masterBanks.isdelete, 0)))
    const exists = existsArr[0]
    if (!exists) return NextResponse.json({ error: 'Bank not found' }, { status: 404 })

    const userId = getUserId(req)
    const accIdVal = (accountId != null && accountId !== '') ? Number(accountId) : null

    await pool.query(`
      UPDATE master_banks
      SET bank_name = COALESCE($1, bank_name),
          owner_name = COALESCE($2, owner_name),
          account_number = COALESCE($3, account_number),
          account_id = COALESCE($4, account_id),
          user_edit = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND isdelete = 0
    `, [upperBank, titleOwner, digitsOnly, accIdVal, userId, id])

    const updatedArr = await db.select({
      id: masterBanks.id,
      bankName: masterBanks.bankName,
      ownerName: masterBanks.ownerName,
      accountNumber: masterBanks.accountNumber,
      accountId: masterBanks.accountId,
      createdAt: masterBanks.createdAt,
      updatedAt: masterBanks.updatedAt,
    }).from(masterBanks).where(eq(masterBanks.id, id))
    const updated = updatedArr[0]

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PUT /api/banks/[id] error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to update bank' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'bank', 'delete') && !hasPermission(req as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus bank' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = getDb()
    const pool = (db as any).$client
    const existsArr = await db.select({ id: masterBanks.id }).from(masterBanks)
      .where(and(eq(masterBanks.id, id), eq(masterBanks.isdelete, 0)))
    const exists = existsArr[0]
    if (!exists) return NextResponse.json({ error: 'Bank not found' }, { status: 404 })

    const userId = getUserId(req)
    await pool.query(`
      UPDATE master_banks
      SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = $1
      WHERE id = $2 AND isdelete = 0
    `, [userId, id])

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/banks/[id] error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to delete bank' }, { status: 500 })
  }
}
