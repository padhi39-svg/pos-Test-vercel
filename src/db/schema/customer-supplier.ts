import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterBarang } from './barang'

export const masterJenisCustomer = pgTable('master_jenis_customer', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_jenis_customer_code').on(t.code)])

export const masterCustomer = pgTable('master_customer', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  npwp: text('npwp'),
  discountPercent: doublePrecision('discount_percent').default(0),
  term: integer('term').default(0),
  isdelete: integer('isdelete').default(0),
  accountId: integer('account_id'),
  kodeInt: text('kode_int'),
  jenisCustomerId: integer('jenis_customer_id').references(() => masterJenisCustomer.id),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_customer_code').on(t.code)])

export const masterSeasonDiscount = pgTable('master_season_discount', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  jenisCustomerId: integer('jenis_customer_id').notNull().references(() => masterJenisCustomer.id),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  isActive: integer('is_active').default(1),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_season_discount_jenis').on(t.jenisCustomerId),
  index('idx_season_discount_active').on(t.isActive),
])

export const masterSeasonDiscountItem = pgTable('master_season_discount_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  seasonDiscountId: integer('season_discount_id').notNull().references(() => masterSeasonDiscount.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').references(() => masterBarang.id),
  discountType: text('discount_type').notNull().default('disc1'),
  discountValue: doublePrecision('discount_value').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_season_discount_item_season').on(t.seasonDiscountId),
  index('idx_season_discount_item_barang').on(t.barangId),
])

export const masterSupplier = pgTable('master_supplier', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  npwp: text('npwp'),
  discountPercent: doublePrecision('discount_percent').default(0),
  term: integer('term').default(0),
  isdelete: integer('isdelete').default(0),
  accountId: integer('account_id'),
  kodeInt: text('kode_int'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})
