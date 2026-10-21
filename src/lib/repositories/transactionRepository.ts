import { getDb } from '@/db'
import { transactions, transactionItems, transactionPayments, masterCustomer } from '@/db/schema'
import { eq, and, gte, lte, like, desc, asc, sql } from 'drizzle-orm'

export interface TransactionFilter {
  from?: string
  to?: string
  customerId?: number
  status?: string
  transactionNumber?: string
  limit?: number
  offset?: number
  includeVoid?: boolean
}

export function findAllTransactions(filter: TransactionFilter = {}) {
  const db = getDb()
  const conditions = filter.includeVoid ? [] : [sql`COALESCE(${transactions.status}, 'completed') != 'void'`]

  if (filter.from) conditions.push(gte(transactions.createdAt, filter.from))
  if (filter.to) conditions.push(lte(transactions.createdAt, filter.to + ' 23:59:59'))
  if (filter.customerId) conditions.push(eq(transactions.customerId, filter.customerId))
  if (filter.status) conditions.push(eq(transactions.status, filter.status))
  if (filter.transactionNumber) conditions.push(like(transactions.transactionNumber, `%${filter.transactionNumber}%`))

  return db.select().from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(filter.limit ?? 100)
    .offset(filter.offset ?? 0)
    
}

export function findTransactionById(id: number) {
  const db = getDb()
  return db.select().from(transactions).where(eq(transactions.id, id)).then(r => r[0] ?? null)
}

export function findTransactionByNumber(number: string) {
  const db = getDb()
  return db.select().from(transactions).where(eq(transactions.transactionNumber, number)).then(r => r[0] ?? null)
}

export async function findTransactionItems(transactionId: number) {
  const db = getDb()
  return db.select().from(transactionItems)
    .where(eq(transactionItems.transactionId, transactionId))
    .orderBy(asc(transactionItems.id))
}

export async function findTransactionPayments(transactionId: number) {
  const db = getDb()
  return db.select().from(transactionPayments)
    .where(eq(transactionPayments.transactionId, transactionId))
}

export async function getTransactionWithDetails(id: number) {
  const tx = await findTransactionById(id)
  if (!tx) return null
  const items = await findTransactionItems(id)
  const payments = await findTransactionPayments(id)
  return { ...tx, items, payments }
}

export function getDailySalesTotal(from: string, to: string) {
  const db = getDb()
  const result = db.select({
    total: sql<string>`COALESCE(SUM(${transactions.total}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(transactions)
    .where(and(
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to + ' 23:59:59'),
      sql`COALESCE(${transactions.status}, 'completed') != 'void'`,
    )).then(r => r[0] ?? null)
  return result
}
