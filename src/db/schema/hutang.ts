import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './keuangan'

export const apPayments = pgTable('ap_payments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentNumber: text('payment_number').unique(),
  paymentDate: date('payment_date', { mode: 'string' }),
  supplierId: integer('supplier_id'),
  method: text('method'),
  amount: doublePrecision('amount').default(0),
  notes: text('notes'),
  periodId: integer('period_id'),
  subtotal: doublePrecision('subtotal').default(0),
  total: doublePrecision('total').default(0),
  status: text('status').default('active'),
  userCreate: integer('user_create'),
  userUpdate: integer('user_update'),
  userEdit: integer('user_edit'),
  void: integer('void').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ap_payments_supplier').on(t.supplierId),
])

export const apPaymentItems = pgTable('ap_payment_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer('payment_id').notNull().references(() => apPayments.id, { onDelete: 'cascade' }),
  referenceDocType: text('reference_doc_type'),
  referenceId: integer('reference_id'),
  appliedAmount: doublePrecision('applied_amount').default(0),
  sourceType: text('source_type'),
  sourceId: integer('source_id').default(0),
  invoiceNumber: text('invoice_number'),
  dueAmount: doublePrecision('due_amount').default(0),
  payAmount: doublePrecision('pay_amount').default(0),
  remarks: text('remarks'),
  purchaseId: integer('purchase_id').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ap_payment_items_payment').on(t.paymentId),
])

export const apPaymentMethods = pgTable('ap_payment_methods', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer('payment_id').notNull().references(() => apPayments.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const apPaymentExtras = pgTable('ap_payment_extras', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paymentId: integer('payment_id').notNull().references(() => apPayments.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull(),
  notes: text('notes'),
  debit: doublePrecision('debit').default(0),
  credit: doublePrecision('credit').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const apAdvances = pgTable('ap_advances', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  kodeNota: text('kode_nota').unique().notNull(),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  supplierId: integer('supplier_id'),
  supplierCode: text('supplier_code'),
  supplierName: text('supplier_name'),
  notes: text('notes'),
  total: doublePrecision('total').default(0),
  status: text('status').notNull().default('active'),
  purchaseId: integer('purchase_id'),
  periodId: integer('period_id').notNull().default(1),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ap_adv_supplier').on(t.supplierId),
  index('idx_ap_adv_tanggal').on(t.tanggal),
])

export const apAdvanceLines = pgTable('ap_advance_lines', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  advanceId: integer('advance_id').notNull(),
  accountId: integer('account_id'),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  notes: text('notes'),
  nominal: doublePrecision('nominal').default(0),
  apAdvanceId: integer('ap_advance_id'),
  lineNo: integer('line_no').notNull().default(0),
  amount: doublePrecision('amount').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ap_adv_lines_acc').on(t.accountId),
  index('idx_ap_adv_lines_hdr').on(t.apAdvanceId),
])

export const apOpeningBalances = pgTable('ap_opening_balances', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  kodeNota: text('kode_nota').unique().notNull(),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  supplierId: integer('supplier_id'),
  supplierCode: text('supplier_code'),
  supplierName: text('supplier_name'),
  nominal: doublePrecision('nominal').default(0),
  periodId: integer('period_id').notNull().default(1),
  notes: text('notes'),
  status: text('status').notNull().default('active'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ap_opening_supplier').on(t.supplierId),
  index('idx_ap_opening_period').on(t.periodId),
])

export const apLedger = pgTable('ap_ledger', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  docType: text('doc_type'),
  docId: integer('doc_id'),
  supplierId: integer('supplier_id'),
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
  index('idx_ap_ledger_supplier').on(t.supplierId),
  index('idx_ap_ledger_doc').on(t.docType, t.docId),
])
