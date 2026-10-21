import { getDb } from '@/db'
import { transactions, transactionItems, masterBarang, masterCustomer, masterKategori } from '@/db/schema'
import { eq, and, gte, lte, like, desc, sql } from 'drizzle-orm'

export interface SalesReportFilter {
  from?: string
  to?: string
  transactionNumber?: string
  kategoriId?: number
  barangId?: number
}

export function getSalesDetailReport(filter: SalesReportFilter) {
  const db = getDb()

  let query = db.select({
    transactionId: transactions.id,
    transactionNumber: transactions.transactionNumber,
    transactionDate: sql`COALESCE(${transactions.createdAt})::date`.as('transaction_date'),
    customerName: sql`COALESCE(${masterCustomer.name}, 'Customer Umum')`.as('customer_name'),
    itemName: transactionItems.barangName,
    quantity: transactionItems.quantity,
    unit: transactionItems.unitName,
    unitPrice: transactionItems.unitPrice,
    subtotal: transactionItems.totalPrice,
  }).from(transactions)
    .innerJoin(transactionItems, eq(transactionItems.transactionId, transactions.id))
    .leftJoin(masterCustomer, eq(masterCustomer.id, transactions.customerId))
    .where(sql`COALESCE(transactions.status, 'completed') != 'void'`)

  if (filter.from) {
    query = query.where(sql`COALESCE(${transactions.createdAt})::date >= ${filter.from}`)
  }
  if (filter.to) {
    query = query.where(sql`COALESCE(${transactions.createdAt})::date <= ${filter.to}`)
  }
  if (filter.transactionNumber) {
    query = query.where(like(transactions.transactionNumber, `%${filter.transactionNumber}%`))
  }

  return query.orderBy(desc(transactions.createdAt))
}

export function getDailyRevenue(from: string, to: string) {
  const db = getDb()
  return db.select({
    date: sql<string>`${transactions.createdAt}::date`.as('date'),
    total: sql<string>`COALESCE(SUM(${transactions.total}), 0)`.as('total'),
    count: sql<number>`COUNT(*)`.as('count'),
  }).from(transactions)
    .where(and(
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to + ' 23:59:59'),
      sql`COALESCE(transactions.status, 'completed') != 'void'`,
    ))
    .groupBy(sql`${transactions.createdAt}::date`)
    .orderBy(sql`${transactions.createdAt}::date`)
    
}

export function getTopProducts(limit = 10) {
  const db = getDb()
  return db.select({
    name: transactionItems.barangName,
    qty: sql<string>`SUM(${transactionItems.quantity})`.as('qty'),
    total: sql<string>`SUM(${transactionItems.totalPrice})`.as('total'),
  }).from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(sql`COALESCE(transactions.status, 'completed') != 'void'`)
    .groupBy(transactionItems.barangName)
    .orderBy(desc(sql`SUM(${transactionItems.quantity})`))
    .limit(limit)
    
}
