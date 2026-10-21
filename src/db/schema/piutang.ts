import { pgTable, text, integer, doublePrecision, index, uniqueIndex, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './keuangan'
import { masterCustomer } from './customer-supplier'

export const arPayments = pgTable('ar_payments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentNumber: text('payment_number').unique().notNull(),
  paymentDate: date('payment_date', { mode: 'string' }).notNull(),
  customerId: integer('customer_id').notNull(),
  customerName: text('customer_name'),
  periodId: integer('period_id').notNull(),
  status: text('status').default('active'),
  subtotal: doublePrecision('subtotal').default(0),
  total: doublePrecision('total').default(0),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userUpdate: integer('user_update'),
  userEdit: integer('user_edit'),
  void: integer('void').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_payments_customer').on(t.customerId),
  index('idx_ar_payments_period').on(t.periodId),
])

export const arPaymentItems = pgTable('ar_payment_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer('payment_id').notNull().references(() => arPayments.id, { onDelete: 'cascade' }),
  saleId: integer('sale_id').notNull(),
  invoiceNumber: text('invoice_number'),
  dueAmount: doublePrecision('due_amount').default(0),
  payAmount: doublePrecision('pay_amount').default(0),
  remarks: text('remarks'),
  sourceType: text('source_type'),
  sourceId: integer('source_id').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_payment_items_payment').on(t.paymentId),
  index('idx_ar_payment_items_sale').on(t.saleId),
])

export const arPaymentMethods = pgTable('ar_payment_methods', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer('payment_id').notNull().references(() => arPayments.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull(),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  amount: doublePrecision('amount').default(0),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_payment_methods_payment').on(t.paymentId),
])

export const arPaymentExtras = pgTable('ar_payment_extras', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer('payment_id').notNull().references(() => arPayments.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull(),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  notes: text('notes'),
  debit: doublePrecision('debit').default(0),
  credit: doublePrecision('credit').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const arAdvances = pgTable('ar_advances', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  kodeNota: text('kode_nota').unique().notNull(),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  customerId: integer('customer_id'),
  customerCode: text('customer_code'),
  customerName: text('customer_name'),
  notes: text('notes'),
  total: doublePrecision('total').default(0),
  status: text('status').notNull().default('active'),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  periodId: integer('period_id').notNull().default(1),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_adv_customer').on(t.customerId),
  index('idx_ar_adv_tanggal').on(t.tanggal),
])

export const arAdvanceLines = pgTable('ar_advance_lines', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  advanceId: integer('advance_id').notNull(),
  accountId: integer('account_id'),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  notes: text('notes'),
  nominal: doublePrecision('nominal').default(0),
  arAdvanceId: integer('ar_advance_id'),
  lineNo: integer('line_no').notNull().default(0),
  amount: doublePrecision('amount').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_adv_lines_acc').on(t.accountId),
  index('idx_ar_adv_lines_hdr').on(t.arAdvanceId),
])

export const arOpeningBalances = pgTable('ar_opening_balances', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  kodeNota: text('kode_nota').unique().notNull(),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  customerId: integer('customer_id'),
  customerCode: text('customer_code'),
  customerName: text('customer_name'),
  nominal: doublePrecision('nominal').default(0),
  periodId: integer('period_id').notNull().default(1),
  notes: text('notes'),
  status: text('status').notNull().default('active'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_opening_customer').on(t.customerId),
  index('idx_ar_opening_period').on(t.periodId),
])

export const arLedger = pgTable('ar_ledger', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  docType: text('doc_type'),
  docId: integer('doc_id'),
  customerId: integer('customer_id'),
  transDate: date('trans_date', { mode: 'string' }),
  description: text('description'),
  debit: doublePrecision('debit').default(0),
  credit: doublePrecision('credit').default(0),
  balance: doublePrecision('balance').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ar_ledger_customer').on(t.customerId),
  index('idx_ar_ledger_doc').on(t.docType, t.docId),
])

export const arReceipts = pgTable('ar_receipts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  receiptNumber: text('receipt_number').unique(),
  receiptDate: date('receipt_date', { mode: 'string' }),
  customerId: integer('customer_id'),
  method: text('method'),
  amount: doublePrecision('amount').default(0),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const arReceiptItems = pgTable('ar_receipt_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  receiptId: integer('receipt_id').notNull().references(() => arReceipts.id, { onDelete: 'cascade' }),
  referenceDocType: text('reference_doc_type'),
  referenceId: integer('reference_id'),
  appliedAmount: doublePrecision('applied_amount').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})
