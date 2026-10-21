import { pgTable, text, integer, primaryKey, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  settingKey: text('setting_key').unique().notNull(),
  settingValue: text('setting_value'),
  settingGroup: text('setting_group'),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const userBarangJenis = pgTable('user_barang_jenis', {
  userId: integer('user_id').notNull(),
  jenis: integer('jenis').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.jenis] }),
  index('idx_user_barang_jenis_user').on(t.userId),
])
