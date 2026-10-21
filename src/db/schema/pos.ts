import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const cashierClosing = pgTable('cashier_closing', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  userId: integer('user_id').notNull(),
  userName: text('user_name'),
  totalPenjualan: doublePrecision('total_penjualan').notNull().default(0),
  totalTunai: doublePrecision('total_tunai').notNull().default(0),
  totalTransfer: doublePrecision('total_transfer').notNull().default(0),
  totalKembalian: doublePrecision('total_kembalian').notNull().default(0),
  tunaiDiKasir: doublePrecision('tunai_di_kasir').notNull().default(0),
  selisihTunai: doublePrecision('selisih_tunai').notNull().default(0),
  jumlahTransaksi: integer('jumlah_transaksi').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_cashier_closing_tanggal').on(t.tanggal),
  index('idx_cashier_closing_user').on(t.userId),
])
