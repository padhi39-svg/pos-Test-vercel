import { pgTable, text, integer, doublePrecision, index, uniqueIndex, primaryKey, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterBarang } from './barang'

export const masterGudang = pgTable('master_gudang', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  isActive: integer('is_active').default(1),
  isdelete: integer('isdelete').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_gudang_active').on(t.isActive, t.isdelete),
])

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  role: text('role').notNull().default('staff'),
  passwordHash: text('password_hash'),
  isActive: integer('is_active').notNull().default(1),
  isdelete: integer('isdelete').notNull().default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_users_code').on(t.code),
  index('idx_users_email').on(t.email),
  index('idx_users_isdelete').on(t.isdelete),
])

export const levelManager = pgTable('level_manager', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const masterSales = pgTable('master_sales', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique(),
  name: text('name'),
  userId: integer('user_id'),
  phone: text('phone'),
  email: text('email'),
  ktp: text('ktp'),
  aktif: integer('aktif').default(1),
  isdelete: integer('isdelete').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const stockUsage = pgTable('stock_usage', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number: text('number'),
  tdate: date('tdate', { mode: 'string' }),
  warehouseId: integer('warehouse_id'),
  notes: text('notes'),
  status: text('status').default('draft'),
  void: integer('void').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  periodId: integer('period_id'),
  userVoid: integer('user_void'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_stock_usage_period').on(t.periodId),
])

export const stockUsageItems = pgTable('stock_usage_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  usageId: integer('usage_id').references(() => stockUsage.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id'),
  qty: doublePrecision('qty'),
  unitId: integer('unit_id'),
  unitRatio: doublePrecision('unit_ratio'),
  qtyTotal: doublePrecision('qty_total'),
  cogsUnit: doublePrecision('cogs_unit').default(0),
  cogsTotal: doublePrecision('cogs_total').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const stockOpname = pgTable('stock_opname', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number: text('number'),
  tdate: date('tdate', { mode: 'string' }),
  warehouseId: integer('warehouse_id'),
  notes: text('notes'),
  status: text('status').default('draft'),
  assignees: text('assignees'),
  periodId: integer('period_id'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  userVoid: integer('user_void'),
  void: integer('void').default(0),
  voidReason: text('void_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_stock_opname_period').on(t.periodId),
])

export const stockOpnameItems = pgTable('stock_opname_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  opnameId: integer('opname_id').references(() => stockOpname.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id'),
  systemQty: doublePrecision('system_qty').default(0),
  countQty: doublePrecision('count_qty'),
  varianceQty: doublePrecision('variance_qty'),
  unitIdDefault: integer('unit_id_default'),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const stockOpnameSessions = pgTable('stock_opname_sessions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  opnameId: integer('opname_id').references(() => stockOpname.id, { onDelete: 'cascade' }),
  token: text('token'),
  assignee: text('assignee'),
  status: text('status').default('open'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const stockOpnameCounts = pgTable('stock_opname_counts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: integer('session_id').references(() => stockOpnameSessions.id, { onDelete: 'cascade' }),
  opnameId: integer('opname_id').references(() => stockOpname.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id'),
  qty: doublePrecision('qty'),
  unitId: integer('unit_id'),
  unitRatio: doublePrecision('unit_ratio'),
  qtyBase: doublePrecision('qty_base'),
  method: text('method'),
  notes: text('notes'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const stockTransfers = pgTable('stock_transfers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number: text('number').unique(),
  tdate: date('tdate', { mode: 'string' }),
  fromWarehouseId: integer('from_warehouse_id'),
  toWarehouseId: integer('to_warehouse_id'),
  notes: text('notes'),
  void: integer('void').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  periodId: integer('period_id'),
  userVoid: integer('user_void'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_stock_transfers_period').on(t.periodId),
])

export const stockTransferItems = pgTable('stock_transfer_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  transferId: integer('transfer_id').references(() => stockTransfers.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id'),
  qty: doublePrecision('qty').default(0),
  unitId: integer('unit_id'),
  unitName: text('unit_name'),
  unitRatio: doublePrecision('unit_ratio').default(1),
  qtyTotal: doublePrecision('qty_total').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const stockBalanceByWarehouse = pgTable('stock_balance_by_warehouse', {
  barangId: integer('barang_id'),
  warehouseId: integer('warehouse_id'),
  qty: doublePrecision('qty').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  pk: primaryKey({ columns: [t.barangId, t.warehouseId] }),
}))

export const stockBalanceMonthly = pgTable('stock_balance_monthly', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  barangId: integer('barang_id').notNull(),
  warehouseId: integer('warehouse_id').default(1),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  quantity: doublePrecision('quantity').default(0),
  avgCost: doublePrecision('avg_cost').default(0),
  totalCost: doublePrecision('total_cost').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: uniqueIndex('uq_stock_balance_monthly').on(t.barangId, t.warehouseId, t.year, t.month),
}))

export const ingredientUnits = pgTable('ingredient_units', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  ingredientId: integer('ingredient_id').notNull(),
  name: text('name').notNull(),
  ratio: doublePrecision('ratio').default(1),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})
