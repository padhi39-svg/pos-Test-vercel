import { pgTable, text, integer, doublePrecision, index, uniqueIndex, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterBarang } from './barang'
import { masterPeriode } from './master'

export const stockMovements = pgTable('stock_movements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  ingredientId: integer('ingredient_id').notNull(),
  movementType: text('movement_type').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  unit: text('unit').notNull(),
  referenceType: text('reference_type'),
  referenceId: integer('reference_id'),
  notes: text('notes'),
  warehouseId: integer('warehouse_id'),
  transactionDate: date('transaction_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_stock_movements_ingredient').on(t.ingredientId),
  index('idx_stock_movements_date').on(t.createdAt),
  index('idx_stock_movements_item_wh_date').on(t.ingredientId, t.warehouseId, t.transactionDate, t.createdAt, t.id),
])

export const stockBalance = pgTable('stock_balance', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  ingredientId: integer('ingredient_id'),
  warehouseId: integer('warehouse_id'),
  quantity: doublePrecision('quantity').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_stock_balance_item_wh').on(t.ingredientId, t.warehouseId)])

export const stockPeriodSnapshots = pgTable('stock_period_snapshots', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  periodeId: integer('periode_id').notNull().references(() => masterPeriode.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  qtyBaseUnit: doublePrecision('qty_base_unit').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: uniqueIndex('uq_stock_snapshot_periode_barang').on(t.periodeId, t.barangId),
  idxPeriode: index('idx_stock_snapshot_periode').on(t.periodeId),
  idxBarang: index('idx_stock_snapshot_barang').on(t.barangId),
}))

export const barangMonthlyHpp = pgTable('barang_monthly_hpp', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  hpp: doublePrecision('hpp').notNull().default(0),
  avgCost: doublePrecision('avg_cost').notNull().default(0),
  calculatedAt: timestamp('calculated_at', { mode: 'string' }),
}, (t) => ({
  unq: uniqueIndex('uq_barang_monthly_hpp').on(t.barangId, t.year, t.month),
  idxBarang: index('idx_barang_monthly_hpp_barang').on(t.barangId),
  idxDate: index('idx_barang_monthly_hpp_date').on(t.year, t.month),
}))
