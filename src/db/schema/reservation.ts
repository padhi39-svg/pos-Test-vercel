import { pgTable, text, integer, doublePrecision, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const floors = pgTable('floors', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  levelNo: integer('level_no'),
  isActive: integer('is_active').default(1),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_floors_code').on(t.code)])

export const masterMeja = pgTable('master_meja', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  floorId: integer('floor_id').references(() => floors.id, { onDelete: 'set null' }),
  zone: text('zone'),
  capacity: integer('capacity').default(2),
  isActive: integer('is_active').default(1),
  isMergeable: integer('is_mergeable').default(1),
  isSmoking: integer('is_smoking').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_master_meja_code').on(t.code),
  index('idx_master_meja_floor').on(t.floorId),
])

export const reservations = pgTable('reservations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number: text('number').unique().notNull(),
  customerName: text('customer_name'),
  pic: text('pic'),
  company: text('company'),
  phone: text('phone'),
  date: date('date', { mode: 'string' }).notNull(),
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { mode: 'string' }).notNull(),
  pax: integer('pax').notNull(),
  status: text('status').notNull().default('pending'),
  dpAmount: doublePrecision('dp_amount'),
  dpPaid: integer('dp_paid').default(0),
  notes: text('notes'),
  transferName: text('transfer_name'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_reservations_date').on(t.date),
  index('idx_reservations_status').on(t.status),
])

export const reservationTables = pgTable('reservation_tables', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  reservationId: integer('reservation_id').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  tableId: integer('table_id').notNull().references(() => masterMeja.id, { onDelete: 'cascade' }),
}, (t) => [
  index('idx_reservation_tables_res').on(t.reservationId),
  index('idx_reservation_tables_table').on(t.tableId),
])
