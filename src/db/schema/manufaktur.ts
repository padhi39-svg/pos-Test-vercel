import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterBarang } from './barang'

export const manufaktur = pgTable('manufaktur', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  nomor: text('nomor').unique().notNull(),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id),
  barangCode: text('barang_code'),
  barangName: text('barang_name'),
  quantity: doublePrecision('quantity').notNull().default(1),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  warehouseId: integer('warehouse_id').notNull().default(1),
  hppSebelum: doublePrecision('hpp_sebelum').default(0),
  hppSesudah: doublePrecision('hpp_sesudah').default(0),
  totalBiayaBahan: doublePrecision('total_biaya_bahan').default(0),
  totalBiayaLain: doublePrecision('total_biaya_lain').default(0),
  totalBiaya: doublePrecision('total_biaya').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  userApprove: integer('user_approve'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
}, (t) => [
  index('idx_manufaktur_tanggal').on(t.tanggal),
  index('idx_manufaktur_barang').on(t.barangId),
  index('idx_manufaktur_status').on(t.status),
])

export const manufakturDetail = pgTable('manufaktur_detail', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  manufakturId: integer('manufaktur_id').notNull().references(() => manufaktur.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id),
  barangCode: text('barang_code'),
  barangName: text('barang_name'),
  quantity: doublePrecision('quantity').notNull().default(0),
  hppSatuan: doublePrecision('hpp_satuan').default(0),
  totalHpp: doublePrecision('total_hpp').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_manufaktur_detail_mf').on(t.manufakturId)])

export const manufakturBiaya = pgTable('manufaktur_biaya', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  manufakturId: integer('manufaktur_id').notNull().references(() => manufaktur.id, { onDelete: 'cascade' }),
  accountId: integer('account_id'),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  notes: text('notes'),
  debit: doublePrecision('debit').notNull().default(0),
  credit: doublePrecision('credit').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_manufaktur_biaya_mf').on(t.manufakturId)])
