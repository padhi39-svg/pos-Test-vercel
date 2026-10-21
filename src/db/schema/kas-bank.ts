import { pgTable, text, integer, doublePrecision, index, uniqueIndex, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const cashMutations = pgTable('cash_mutations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  mutationNumber: text('mutation_number').notNull(),
  mutationDate: date('mutation_date', { mode: 'string' }).notNull(),
  cashAccountId: integer('cash_account_id').notNull(),
  cashAccountCode: text('cash_account_code').notNull(),
  mutationType: text('mutation_type', { enum: ['MASUK', 'KELUAR'] }).notNull(),
  notes: text('notes').default(''),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  status: text('status').notNull().default('active'),
  userCreate: integer('user_create'),
  userUpdate: integer('user_update'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uq_cash_mutations_number').on(t.mutationNumber),
  index('idx_cm_cash_acc').on(t.cashAccountId),
  index('idx_cm_date').on(t.mutationDate),
])

export const cashMutationDetails = pgTable('cash_mutation_details', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  cashMutationId: integer('cash_mutation_id').notNull().references(() => cashMutations.id, { onDelete: 'cascade' }),
  lineNo: integer('line_no').notNull(),
  accountId: integer('account_id').notNull(),
  accountCode: text('account_code').notNull(),
  notes: text('notes').default(''),
  amount: doublePrecision('amount').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_cmd_hdr').on(t.cashMutationId),
  index('idx_cmd_acc').on(t.accountId),
])

export const cashbankAccounts = pgTable('cashbank_accounts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique(),
  name: text('name'),
  type: text('type'),
  currency: text('currency'),
  isActive: integer('is_active').default(1),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const cashbankTransactions = pgTable('cashbank_transactions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  transNumber: text('trans_number').unique(),
  transDate: date('trans_date', { mode: 'string' }),
  accountId: integer('account_id'),
  direction: text('direction'),
  amount: doublePrecision('amount').default(0),
  referenceType: text('reference_type'),
  referenceId: integer('reference_id'),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const cashbankTransactionLines = pgTable('cashbank_transaction_lines', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  transId: integer('trans_id').notNull().references(() => cashbankTransactions.id, { onDelete: 'cascade' }),
  description: text('description'),
  amount: doublePrecision('amount').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const cashOpeningBalances = pgTable('cash_opening_balances', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  accountId: integer('account_id').notNull(),
  amount: doublePrecision('amount').notNull().default(0),
  balanceDate: date('balance_date', { mode: 'string' }).notNull(),
  notes: text('notes').default(''),
  isDefault: integer('is_default').notNull().default(0),
  status: text('status').notNull().default('active'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_cash_opening_account').on(t.accountId),
  index('idx_cash_opening_status').on(t.status),
])
