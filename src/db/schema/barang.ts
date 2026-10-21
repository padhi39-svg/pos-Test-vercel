import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterKategori, masterSpesifikasi, masterMerk } from './master'

export const masterBarang = pgTable('master_barang', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  kategoriId: integer('kategori_id').references(() => masterKategori.id),
  spesifikasiId: integer('spesifikasi_id').references(() => masterSpesifikasi.id),
  merkId: integer('merk_id').references(() => masterMerk.id),
  hpp: doublePrecision('hpp').default(0),
  jenis: integer('jenis').default(1),
  aktif: integer('aktif').default(1),
  tampilMenu: integer('tampil_menu').default(0),
  photoUrl: text('photo_url'),
  isdelete: integer('isdelete').default(0),
  accountId: integer('account_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_master_barang_code').on(t.code),
  index('idx_master_barang_jenis').on(t.jenis),
  index('idx_master_barang_aktif').on(t.aktif),
  index('idx_master_barang_tampil_menu').on(t.tampilMenu),
])

export const barangUnits = pgTable('barang_units', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ratio: doublePrecision('ratio').default(1),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const barangPrices = pgTable('barang_prices', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  unitId: integer('unit_id').references(() => barangUnits.id, { onDelete: 'cascade' }),
  price: doublePrecision('price').notNull().default(0),
  effectiveDate: date('effective_date', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const barangRecipes = pgTable('barang_recipes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').notNull().references(() => masterBarang.id),
  quantity: doublePrecision('quantity').notNull(),
  unit: text('unit').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const masterIngredient = pgTable('master_ingredient', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  kategoriId: integer('kategori_id').references(() => masterKategori.id),
  unit: text('unit').notNull(),
  hpp: doublePrecision('hpp').default(0),
  stockMinimum: doublePrecision('stock_minimum').default(0),
  stockCurrent: doublePrecision('stock_current').default(0),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_ingredient_code').on(t.code)])
