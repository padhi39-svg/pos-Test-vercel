import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterBarang } from './barang'

export const masterPaket = pgTable('master_paket', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  kode: text('kode').unique().notNull(),
  nama: text('nama').notNull(),
  hargaJual: doublePrecision('harga_jual').notNull().default(0),
  aktif: integer('aktif').notNull().default(1),
  isdelete: integer('isdelete').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
})

export const masterPaketDetail = pgTable('master_paket_detail', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paketId: integer('paket_id').notNull().references(() => masterPaket.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id),
  quantity: doublePrecision('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_paket_detail_paket').on(t.paketId)])
