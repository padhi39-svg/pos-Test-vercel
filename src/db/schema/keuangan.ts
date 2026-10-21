import { pgTable, text, integer, doublePrecision, index, uniqueIndex, primaryKey, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const accounts = pgTable('accounts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  parentId: integer('parent_id'),
  level: integer('level').notNull().default(1),
  isHeader: integer('is_header').notNull().default(0),
  normalBalance: text('normal_balance').notNull(),
  isActive: integer('is_active').notNull().default(1),
  isCash: integer('is_cash').notNull().default(0),
  isBankAccount: integer('is_bank_account').notNull().default(0),
  isControlAccount: integer('is_control_account').notNull().default(0),
  postingAllowed: integer('posting_allowed').notNull().default(1),
  currency: text('currency').default('IDR'),
  golongan: text('golongan'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_accounts_code').on(t.code),
  index('idx_accounts_parent').on(t.parentId),
  index('idx_accounts_golongan').on(t.golongan),
])

export const accountMappings = pgTable('account_mappings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  mapGroup: text('map_group').notNull(),
  mapKey: text('map_key').notNull(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: uniqueIndex('uq_account_mappings').on(t.mapGroup, t.mapKey),
  idxGroup: index('idx_account_mappings_group').on(t.mapGroup),
  idxKey: index('idx_account_mappings_key').on(t.mapKey),
}))

export const memorialJournals = pgTable('memorial_journals', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  journalNumber: text('journal_number').unique().notNull(),
  journalDate: date('journal_date', { mode: 'string' }).notNull(),
  notes: text('notes'),
  totalDebit: doublePrecision('total_debit').notNull().default(0),
  totalCredit: doublePrecision('total_credit').notNull().default(0),
  status: text('status').notNull().default('active'),
  voidedAt: timestamp('voided_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_memorial_journals_number').on(t.journalNumber),
  index('idx_memorial_journals_date').on(t.journalDate),
  index('idx_memorial_journals_status').on(t.status),
])

export const memorialJournalDetails = pgTable('memorial_journal_details', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  memorialJournalId: integer('memorial_journal_id').notNull().references(() => memorialJournals.id, { onDelete: 'cascade' }),
  lineNo: integer('line_no').notNull(),
  accountId: integer('account_id').references(() => accounts.id),
  accountCode: text('account_code'),
  notes: text('notes'),
  debit: doublePrecision('debit').notNull().default(0),
  credit: doublePrecision('credit').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_memorial_journal_details_journal').on(t.memorialJournalId),
  index('idx_memorial_journal_details_account_code').on(t.accountCode),
])

export const journalEntries = pgTable('journal_entries', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  entryDate: date('entry_date', { mode: 'string' }).notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: integer('source_id'),
  sourceNumber: text('source_number'),
  accountCode: text('account_code').notNull(),
  accountName: text('account_name').default(''),
  debit: doublePrecision('debit').notNull().default(0),
  credit: doublePrecision('credit').notNull().default(0),
  description: text('description').default(''),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_je_date').on(t.entryDate),
  index('idx_je_account').on(t.accountCode),
  index('idx_je_source').on(t.sourceType, t.sourceId),
])

export const reportSnapshotCache = pgTable('report_snapshot_cache', {
  reportType: text('report_type').notNull(),
  periodId: integer('period_id').notNull(),
  data: text('data').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }),
}, (t) => [
  primaryKey({ columns: [t.reportType, t.periodId] }),
])

export const fiscalCorrections = pgTable('fiscal_corrections', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  year: integer('year').notNull(),
  type: text('type').notNull(),
  accountName: text('account_name').notNull(),
  accountCode: text('account_code'),
  amount: doublePrecision('amount').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_fiscal_corrections_year').on(t.year)])

export const fiscalSettings = pgTable('fiscal_settings', {
  year: integer('year').primaryKey(),
  omzet: doublePrecision('omzet').notNull().default(0),
  pph25: doublePrecision('pph25').notNull().default(0),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const masterBanks = pgTable('master_banks', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  bankName: text('bank_name').notNull(),
  ownerName: text('owner_name'),
  accountNumber: text('account_number').notNull(),
  accountId: integer('account_id'),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_master_banks_bank_name').on(t.bankName),
  index('idx_master_banks_isdelete').on(t.isdelete),
])
