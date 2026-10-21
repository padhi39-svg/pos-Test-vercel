import { pgTable, text, integer, index, timestamp, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const sessions = pgTable('sessions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_sessions_token').on(t.token),
  index('idx_sessions_user_id').on(t.userId),
  index('idx_sessions_expires').on(t.expiresAt),
])

export const masterPermissions = pgTable('master_permissions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isdelete: integer('isdelete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
})

export const menuPermissions = pgTable('menu_permissions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  menuCode: text('menu_code').notNull(),
  permissionCode: text('permission_code').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: index('uq_menu_permissions').on(t.menuCode, t.permissionCode),
}))

export const levelPermissions = pgTable('level_permissions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  levelId: integer('level_id').notNull(),
  menuCode: text('menu_code').notNull(),
  permissionCode: text('permission_code').notNull(),
  allowed: integer('allowed').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: index('uq_level_permissions').on(t.levelId, t.menuCode, t.permissionCode),
}))

export const levelPermissionsLegacy = pgTable('level_permissions_legacy', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  levelId: integer('level_id').notNull(),
  menuCode: text('menu_code').notNull(),
  canCreate: integer('can_create').default(0),
  canEdit: integer('can_edit').default(0),
  canView: integer('can_view').default(1),
  canDelete: integer('can_delete').default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  unq: index('uq_level_permissions_legacy').on(t.levelId, t.menuCode),
}))
