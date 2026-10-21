import { pgTable, text, integer, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const masterKategori = pgTable('master_kategori', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  isdelete: integer('isdelete').default(0),
  printTarget: text('print_target'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_kategori_code').on(t.code)])

export const masterSpesifikasi = pgTable('master_spesifikasi', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  isdelete: integer('isdelete').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_spesifikasi_code').on(t.code)])

export const masterMerk = pgTable('master_merk', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  isdelete: integer('isdelete').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index('idx_master_merk_code').on(t.code)])

export const masterPeriode = pgTable('master_periode', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  isActive: integer('is_active').default(0),
  isdelete: integer('isdelete').default(0),
  statusBuku: text('status_buku').default('OPEN'),
  isClosed: integer('is_closed').default(0),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_master_periode_code').on(t.code),
  index('idx_master_periode_status_buku').on(t.statusBuku),
  index('idx_master_periode_is_closed').on(t.isClosed),
])

export const masterLevelManager = pgTable('master_level_manager', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
})

export const masterUsers = pgTable('master_users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique(),
  name: text('name'),
  levelId: integer('level_id'),
  aktif: integer('aktif').default(1),
  isActive: integer('is_active').default(1),
  isdelete: integer('isdelete').default(0),
  email: text('email'),
  passwordHash: text('password_hash'),
  userCreate: integer('user_create'),
  userEdit: integer('user_edit'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_master_users_email').on(t.email),
  index('idx_master_users_aktif').on(t.aktif),
])
