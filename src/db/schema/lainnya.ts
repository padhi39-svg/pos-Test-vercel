import { pgTable, text, integer, doublePrecision, index, uniqueIndex, primaryKey, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const akunSaldoBulanan = pgTable('akun_saldo_bulanan', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  accountCode: text('account_code').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  saldoAkhir: doublePrecision('saldo_akhir').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: uniqueIndex('uq_akun_saldo_bulanan').on(t.accountCode, t.year, t.month),
}))

export const glJournal = pgTable('gl_journal', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  journalNumber: text('journal_number').unique(),
  journalDate: date('journal_date', { mode: 'string' }),
  description: text('description'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const glJournalLines = pgTable('gl_journal_lines', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  journalId: integer('journal_id').notNull().references(() => glJournal.id, { onDelete: 'cascade' }),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  debit: doublePrecision('debit').default(0),
  credit: doublePrecision('credit').default(0),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

// Sales Order (SO) - distinct from transactions
export const salesOrder = pgTable('sales_order', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  soNumber: text('so_number').unique(),
  soDate: date('so_date', { mode: 'string' }).notNull(),
  customerId: integer('customer_id'),
  warehouseId: integer('warehouse_id'),
  salesId: integer('sales_id'),
  status: text('status').notNull().default('draft'),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discountPercent: doublePrecision('discount_percent').notNull().default(0),
  discountAmount: doublePrecision('discount_amount').notNull().default(0),
  ppnPercent: doublePrecision('ppn_percent').notNull().default(0),
  ppnAmount: doublePrecision('ppn_amount').notNull().default(0),
  total: doublePrecision('total').notNull().default(0),
  notes: text('notes'),
  priceIncludeTax: integer('price_include_tax').notNull().default(0),
  taxRatePercent: doublePrecision('tax_rate_percent').notNull().default(11),
  isFullyInvoiced: integer('is_fully_invoiced').notNull().default(0),
  soStatus: text('so_status').notNull().default('outstanding'),
  realisasiManual: integer('realisasi_manual').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const salesOrderItems = pgTable('sales_order_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  salesOrderId: integer('sales_order_id').notNull().references(() => salesOrder.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull(),
  barangName: text('barang_name'),
  quantity: doublePrecision('quantity').notNull().default(0),
  realizedQty: doublePrecision('realized_qty').notNull().default(0),
  realizedQtyBase: doublePrecision('realized_qty_base').notNull().default(0),
  unitName: text('unit_name'),
  unitRatio: doublePrecision('unit_ratio').notNull().default(1),
  unitPrice: doublePrecision('unit_price').notNull().default(0),
  discountPercent: doublePrecision('discount_percent').notNull().default(0),
  disconTotal: doublePrecision('discon_total').notNull().default(0),
  totalPrice: doublePrecision('total_price').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

// Legacy SO (Stock Opname related)
export const legacySO = pgTable('SO', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number: text('number'),
  tdate: date('tdate', { mode: 'string' }),
  warehouseId: integer('warehouse_id'),
  notes: text('notes'),
  approved: integer('approved').default(0),
  periodId: integer('period_id'),
  void: integer('void').default(0),
  dsoId: integer('dso_id'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_so_number').on(t.number),
  index('idx_so_date').on(t.tdate),
  index('idx_so_approved').on(t.approved),
  index('idx_so_period_wh').on(t.periodId, t.warehouseId),
])

export const legacySODetail = pgTable('SODetail', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  soId: integer('so_id').notNull().references(() => legacySO.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull(),
  systemQty: doublePrecision('system_qty').default(0),
  countQty: doublePrecision('count_qty'),
  varianceQty: doublePrecision('variance_qty'),
  unitIdDefault: integer('unit_id_default'),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_sodetail_so_id').on(t.soId),
  index('idx_sodetail_barang_id').on(t.barangId),
])

// Resto temp orders (for POS in-progress orders)
export const restoTempOrders = pgTable('resto_temp_orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tableId: integer('table_id').notNull(),
  customerId: integer('customer_id'),
  customerName: text('customer_name'),
  waiterId: integer('waiter_id'),
  waiterName: text('waiter_name'),
  guestCount: integer('guest_count').default(1),
  status: text('status').default('open'),
  notes: text('notes'),
  void: integer('void').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const restoTempOrderItems = pgTable('resto_temp_order_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tempOrderId: integer('temp_order_id').notNull().references(() => restoTempOrders.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull(),
  barangCode: text('barang_code').notNull(),
  barangName: text('barang_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  totalPrice: doublePrecision('total_price').notNull(),
  modifier: text('modifier'),
  kategoriId: integer('kategori_id'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

// Table locks
export const posTableLocks = pgTable('pos_table_locks', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tableId: integer('table_id').notNull(),
  deviceId: text('device_id').notNull(),
  lockedAt: timestamp('locked_at', { mode: 'string' }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_pos_table_locks_table').on(t.tableId),
])

export const restoTableLocks = pgTable('resto_table_locks', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tableId: integer('table_id').notNull(),
  deviceId: text('device_id').notNull(),
  userId: integer('user_id'),
  userName: text('user_name'),
  lockedAt: timestamp('locked_at', { mode: 'string' }),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: uniqueIndex('idx_table_locks_table').on(t.tableId),
}))

// Client settings
export const clientSettings = pgTable('client_settings', {
  deviceId: text('device_id').notNull(),
  settingGroup: text('setting_group').notNull(),
  settingKey: text('setting_key').notNull(),
  settingValue: text('setting_value'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  primaryKey({ columns: [t.deviceId, t.settingGroup, t.settingKey] }),
])
