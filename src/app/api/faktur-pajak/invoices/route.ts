import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { transactions } from '@/db/schema'
import { eq, and, or, isNull, sql, asc } from 'drizzle-orm'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'generate_faktur_pajak', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getDb()
    const rows = await db.select({
      id: transactions.id,
      transactionNumber: transactions.transactionNumber,
      customerName: transactions.customerName,
      total: transactions.total,
      createdAt: transactions.createdAt,
      fakturPajak: transactions.fakturPajak,
    })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionType, 3),
          eq(transactions.void, 0),
          or(
            isNull(transactions.fakturPajak),
            eq(transactions.fakturPajak, ''),
          ),
        ),
      )
      .orderBy(asc(transactions.createdAt))

    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
