import { pgTable, text, integer, doublePrecision, date, index, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { masterBarang } from './barang'

export const promoBanner = pgTable('promo_banner', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  imageUrl: text('image_url').notNull(),
  title: text('title'),
  subtitle: text('subtitle'),
  linkUrl: text('link_url'),
  urutan: integer('urutan').default(0),
  aktif: integer('aktif').default(1),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_promo_banner_aktif').on(t.aktif),
])

export const promo = pgTable('promo', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  nama: text('nama').notNull(),
  deskripsi: text('deskripsi'),
  bannerImage: text('banner_image'),
  tipeDiskon: text('tipe_diskon').notNull().default('persen'), // 'persen' | 'nominal'
  nilaiDiskon: doublePrecision('nilai_diskon').default(0),
  mulai: date('mulai', { mode: 'string' }),
  selesai: date('selesai', { mode: 'string' }),
  aktif: integer('aktif').default(1),
  createdAt: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_promo_aktif').on(t.aktif),
])

export const promoItem = pgTable('promo_item', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  promoId: integer('promo_id').notNull().references(() => promo.id, { onDelete: 'cascade' }),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').default(0),
}, (t) => [
  index('idx_promo_item_promo').on(t.promoId),
  index('idx_promo_item_barang').on(t.barangId),
])

export const menuItem = pgTable('menu_item', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  barangId: integer('barang_id').notNull().references(() => masterBarang.id, { onDelete: 'cascade' }),
  deskripsi: text('deskripsi'),
  photoUrl: text('photo_url'),
  mediaCategory: text('media_category'),
  isRecommended: integer('is_recommended').default(0),
  isNew: integer('is_new').default(0),
  diskon: integer('diskon').default(0),
  urutan: integer('urutan').default(0),
  aktif: integer('aktif').default(1),
}, (t) => [
  index('idx_menu_item_aktif').on(t.aktif),
  index('idx_menu_item_barang').on(t.barangId),
])

export const menuItemPhoto = pgTable('menu_item_photo', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  menuItemId: integer('menu_item_id').notNull().references(() => menuItem.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  urutan: integer('urutan').default(0),
}, (t) => [
  index('idx_menu_item_photo_item').on(t.menuItemId),
])
