import { getDb } from '@/db'
import { transactions, transactionItems, transactionPayments, masterCustomer } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

export async function createTransaction(data: {
  transactionNumber: string; customerId?: number | null; subtotal?: number
  discPercent?: number; discValue?: number; total?: number; status?: string
  cashierId?: number; notes?: string | null; transactionType?: string
}) {
  const db = getDb()
  const [row] = await db.insert(transactions).values({
    transactionNumber: data.transactionNumber,
    customerId: data.customerId ?? null,
    subtotal: String(data.subtotal ?? 0),
    discPercent: String(data.discPercent ?? 0),
    discValue: String(data.discValue ?? 0),
    total: String(data.total ?? 0),
    status: data.status ?? 'completed',
    cashierId: data.cashierId ?? null,
    notes: data.notes ?? null,
    transactionType: data.transactionType ?? 'pos',
  }).returning()
  return row
}

export async function createTransactionItem(data: {
  transactionId: number; barangId?: number | null; barangName?: string
  quantity: number; unitName?: string; unitPrice: number; totalPrice: number
}) {
  const db = getDb()
  const [row] = await db.insert(transactionItems).values({
    transactionId: data.transactionId,
    barangId: data.barangId ?? null,
    barangName: data.barangName ?? 'Item',
    quantity: String(data.quantity),
    unitName: data.unitName ?? 'PCS',
    unitPrice: String(data.unitPrice),
    totalPrice: String(data.totalPrice),
  }).returning()
  return row
}

export async function createTransactionPayment(data: {
  transactionId: number; metodeBayar: string; amount: number
  referensi?: string | null; cardNumber?: string | null
}) {
  const db = getDb()
  const [row] = await db.insert(transactionPayments).values({
    transactionId: data.transactionId,
    metodeBayar: data.metodeBayar,
    amount: String(data.amount),
    referensi: data.referensi ?? null,
    cardNumber: data.cardNumber ?? null,
  }).returning()
  return row
}

export async function voidTransaction(id: number) {
  const db = getDb()
  return await db.update(transactions).set({ status: 'void' }).where(eq(transactions.id, id))
}
