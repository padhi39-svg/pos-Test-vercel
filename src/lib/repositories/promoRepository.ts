import { getDb } from '@/db'
import { promoBanner, promo, promoItem, menuItem, menuItemPhoto } from '@/db/schema/promo'
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { rawAll, rawRun } from '@/db/raw'

const PRICE_SUBQ = `(SELECT bp.price FROM barang_prices bp LEFT JOIN barang_units bu ON bu.id = bp.unit_id WHERE bp.barang_id = mb.id AND bp.effective_date <= CURRENT_DATE ORDER BY COALESCE(bu.ratio, 1) ASC, bp.effective_date DESC LIMIT 1)`

export type BannerRow = {
  id: number
  imageUrl: string
  title: string | null
  subtitle: string | null
  linkUrl: string | null
  urutan: number | null
  aktif: number | null
}

export type PromoItemLanding = {
  id: number
  code: string
  name: string
  photoUrl: string | null
  kategori: string | null
  harga: number | null
  promoHarga: number | null
}

export type PromoLanding = {
  id: number
  nama: string
  deskripsi: string | null
  bannerImage: string | null
  tipeDiskon: string
  nilaiDiskon: number
  items: PromoItemLanding[]
}

export type MenuItemLanding = {
  id: number
  code: string
  name: string
  photoUrl: string | null
  kategori: string | null
  harga: number | null
  deskripsi: string | null
  isRecommended: number
  isNew: number
  diskon: number
  photos?: string[]
}

export type PaketLanding = {
  id: number
  code: string
  name: string
  photoUrl: string | null
  photos: string[]
  kategori: string | null
  harga: number | null
  deskripsi: string | null
  diskon: number
}

export type MenuGroup = {
  kategori: string
  items: MenuItemLanding[]
}

function hitungPromo(harga: number | null, tipe: string, nilai: number): number | null {
  if (harga == null) return null
  let p = tipe === 'persen' ? harga * (1 - nilai / 100) : harga - nilai
  if (p < 0) p = 0
  return Math.round(p)
}

export async function getBanners(): Promise<BannerRow[]> {
  const db = getDb()
  return db.select({
    id: promoBanner.id,
    imageUrl: promoBanner.imageUrl,
    title: promoBanner.title,
    subtitle: promoBanner.subtitle,
    linkUrl: promoBanner.linkUrl,
    urutan: promoBanner.urutan,
    aktif: promoBanner.aktif,
  }).from(promoBanner)
    .where(eq(promoBanner.aktif, 1))
    .orderBy(asc(promoBanner.urutan))
}

export async function getActivePromosWithItems(): Promise<PromoLanding[]> {
  const db = getDb()
  const rows = await db.select().from(promo).where(and(
    eq(promo.aktif, 1),
    sql`(${promo.mulai} IS NULL OR ${promo.mulai} <= CURRENT_DATE)`,
    sql`(${promo.selesai} IS NULL OR ${promo.selesai} >= CURRENT_DATE)`,
  )  ).orderBy(asc(promo.id))

  if (rows.length === 0) return []

  const promoIds = rows.map((p) => p.id)
  const itemRows = await rawAll<any>(
     `SELECT pi.promo_id AS "promoId", mb.id, mb.code, mb.name, mb.photo_url AS "photoUrl",
            mk.name AS kategori, ${PRICE_SUBQ} AS harga
     FROM promo_item pi
     JOIN master_barang mb ON mb.id = pi.barang_id
     LEFT JOIN master_kategori mk ON mk.id = mb.kategori_id
     WHERE pi.promo_id = ANY(?) AND mb.isdelete = 0 AND mb.aktif = 1
     ORDER BY pi.urutan ASC`,
    [promoIds],
  )

  const byPromo: Record<number, PromoItemLanding[]> = {}
  for (const it of itemRows) {
    const promoId = Number(it.promoId)
    const harga = it.harga != null ? Number(it.harga) : null
    byPromo[promoId] = byPromo[promoId] || []
    byPromo[promoId].push({
      id: Number(it.id),
      code: it.code,
      name: it.name,
      photoUrl: it.photoUrl,
      kategori: it.kategori,
      harga,
      promoHarga: null,
    })
  }

  return rows.map((p) => {
    const items = (byPromo[p.id] || []).map((it) => ({
      ...it,
      promoHarga: hitungPromo(it.harga, p.tipeDiskon, Number(p.nilaiDiskon) || 0),
    }))
    return {
      id: p.id,
      nama: p.nama,
      deskripsi: p.deskripsi,
      bannerImage: p.bannerImage,
      tipeDiskon: p.tipeDiskon,
      nilaiDiskon: Number(p.nilaiDiskon) || 0,
      items,
    }
  }).filter((p) => p.items.length > 0)
}

export async function getMenuItemsGrouped(): Promise<MenuGroup[]> {
  const rows = await rawAll<any>(
    `SELECT mi.id AS "menuId", mi.deskripsi, mb.id AS "barangId", mb.code, mb.name, mb.photo_url AS "photoUrl", mi.photo_url AS "menuPhotoUrl",
            mk.name AS kategori, mi.media_category AS "mediaCategory", mi.is_recommended AS "isRecommended", mi.is_new AS "isNew", mi.diskon AS "diskon", ${PRICE_SUBQ} AS harga
     FROM menu_item mi
     JOIN master_barang mb ON mb.id = mi.barang_id
     LEFT JOIN master_kategori mk ON mk.id = mb.kategori_id
     WHERE mi.aktif = 1 AND mb.isdelete = 0 AND mb.aktif = 1 AND mb.jenis = 1 AND (mi.media_category IS NULL OR mi.media_category != 'Paket')
     ORDER BY mi.urutan ASC`,
    [],
  )
  const groups: Record<string, MenuItemLanding[]> = {}
  for (const r of rows) {
    const kategori = r.mediaCategory || 'Lainnya'
    groups[kategori] = groups[kategori] || []
    groups[kategori].push({
      id: Number(r.menuId),
      code: r.code,
      name: r.name,
      photoUrl: r.menuPhotoUrl || r.photoUrl,
      kategori: r.mediaCategory,
      harga: r.harga != null ? Number(r.harga) : null,
      deskripsi: r.deskripsi || null,
      isRecommended: Number(r.isRecommended) || 0,
      isNew: Number(r.isNew) || 0,
      diskon: Number(r.diskon) || 0,
    })
  }
  return Object.entries(groups).map(([kategori, items]) => ({ kategori, items }))
}

export async function getPaketItems(): Promise<PaketLanding[]> {
  const rows = await rawAll<any>(
    `SELECT mi.id AS "menuId", mi.deskripsi, mb.id AS "barangId", mb.code, mb.name, mb.photo_url AS "photoUrl", mi.photo_url AS "menuPhotoUrl",
            mk.name AS kategori, mi.diskon AS "diskon", ${PRICE_SUBQ} AS harga
     FROM menu_item mi
     JOIN master_barang mb ON mb.id = mi.barang_id
     LEFT JOIN master_kategori mk ON mk.id = mb.kategori_id
     WHERE mi.aktif = 1 AND mb.isdelete = 0 AND mb.aktif = 1 AND mb.jenis = 1 AND mi.media_category = 'Paket'
     ORDER BY mi.urutan ASC`,
    [],
  )
  if (rows.length === 0) return []
  const ids = rows.map((r: any) => Number(r.menuId))
  const photoRows = await rawAll<any>(
    `SELECT menu_item_id AS "menuItemId", image_url AS "imageUrl" FROM menu_item_photo WHERE menu_item_id = ANY(?) ORDER BY urutan ASC, id ASC`,
    [ids],
  )
  const byItem: Record<number, string[]> = {}
  for (const p of photoRows) {
    const k = Number(p.menuItemId)
    byItem[k] = byItem[k] || []
    byItem[k].push(p.imageUrl)
  }
  return rows.map((r: any) => {
    const id = Number(r.menuId)
    const extra = byItem[id] || []
    const fallback = r.menuPhotoUrl || r.photoUrl ? [r.menuPhotoUrl || r.photoUrl] : []
    const photos = extra.length > 0 ? extra : fallback
    return {
      id,
      code: r.code,
      name: r.name,
      photoUrl: r.menuPhotoUrl || r.photoUrl || null,
      photos,
      kategori: 'Paket',
      harga: r.harga != null ? Number(r.harga) : null,
      deskripsi: r.deskripsi || null,
      diskon: Number(r.diskon) || 0,
    }
  })
}

// ----- Menu item photos (paket multi-foto, upload manual) -----
export async function listMenuItemPhotos(menuItemId: number): Promise<{ id: number; imageUrl: string; urutan: number }[]> {
  const db = getDb()
  const rows = await db.select({ id: menuItemPhoto.id, imageUrl: menuItemPhoto.imageUrl, urutan: menuItemPhoto.urutan }).from(menuItemPhoto).where(eq(menuItemPhoto.menuItemId, menuItemId)).orderBy(asc(menuItemPhoto.urutan), asc(menuItemPhoto.id))
  return rows.map((r) => ({ id: Number(r.id), imageUrl: r.imageUrl, urutan: Number(r.urutan) || 0 }))
}

export async function addMenuItemPhoto(menuItemId: number, imageUrl: string) {
  const db = getDb()
  const maxRow = await rawAll<any>(`SELECT COALESCE(MAX(urutan),0) AS m FROM menu_item_photo WHERE menu_item_id = ?`, [menuItemId])
  const next = Number(maxRow[0]?.m || 0) + 1
  const [row] = await db.insert(menuItemPhoto).values({ menuItemId, imageUrl, urutan: next }).returning()
  return row
}

export async function deleteMenuItemPhoto(id: number) {
  const db = getDb()
  await db.delete(menuItemPhoto).where(eq(menuItemPhoto.id, id))
}

export async function reorderMenuItemPhotos(menuItemId: number, orderedIds: number[]) {
  const db = getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(menuItemPhoto).set({ urutan: i + 1 }).where(eq(menuItemPhoto.id, orderedIds[i]))
  }
}

// ----- Options (dropdown barang jadi) -----
export async function getBarangJadiOptions(): Promise<MenuItemLanding[]> {
  const rows = await rawAll<any>(
    `SELECT mb.id, mb.code, mb.name, mb.photo_url AS "photoUrl",
            mk.name AS kategori, ${PRICE_SUBQ} AS harga
     FROM master_barang mb
     LEFT JOIN master_kategori mk ON mk.id = mb.kategori_id
     WHERE mb.isdelete = 0 AND mb.aktif = 1 AND mb.jenis = 1
     ORDER BY mb.name ASC`,
    [],
  )
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    photoUrl: r.menuPhotoUrl || r.photoUrl,
    kategori: r.kategori,
    harga: r.harga != null ? Number(r.harga) : null,
    deskripsi: null,
    isRecommended: 0,
    isNew: 0,
    diskon: 0,
  }))
}

// ----- Banner CRUD -----
export async function listBannersAll(): Promise<BannerRow[]> {
  const db = getDb()
  return db.select({
    id: promoBanner.id,
    imageUrl: promoBanner.imageUrl,
    title: promoBanner.title,
    subtitle: promoBanner.subtitle,
    linkUrl: promoBanner.linkUrl,
    urutan: promoBanner.urutan,
    aktif: promoBanner.aktif,
  }).from(promoBanner).orderBy(asc(promoBanner.urutan))
}

export async function createBanner(data: { imageUrl: string; title?: string; subtitle?: string; linkUrl?: string; urutan?: number; aktif?: number }) {
  const db = getDb()
  const [row] = await db.insert(promoBanner).values({
    imageUrl: data.imageUrl,
    title: data.title || null,
    subtitle: data.subtitle || null,
    linkUrl: data.linkUrl || null,
    urutan: data.urutan ?? 0,
    aktif: data.aktif ?? 1,
  }).returning()
  return row
}

export async function updateBanner(id: number, data: Partial<{ imageUrl: string; title: string; subtitle: string; linkUrl: string; urutan: number; aktif: number }>) {
  const db = getDb()
  const [row] = await db.update(promoBanner).set(data).where(eq(promoBanner.id, id)).returning()
  return row
}

export async function deleteBanner(id: number) {
  const db = getDb()
  await db.delete(promoBanner).where(eq(promoBanner.id, id))
}

// ----- Promo CRUD -----
export type PromoRow = {
  id: number
  nama: string
  deskripsi: string | null
  bannerImage: string | null
  tipeDiskon: string
  nilaiDiskon: number | null
  mulai: string | null
  selesai: string | null
  aktif: number | null
}

export async function listPromosAll(): Promise<PromoRow[]> {
  const db = getDb()
  return db.select().from(promo).orderBy(desc(promo.id))
}

export async function getPromoDetail(id: number): Promise<PromoRow | null> {
  const db = getDb()
  const [row] = await db.select().from(promo).where(eq(promo.id, id))
  return row || null
}

export async function createPromo(data: { nama: string; deskripsi?: string; bannerImage?: string; tipeDiskon?: string; nilaiDiskon?: number; mulai?: string; selesai?: string; aktif?: number }) {
  const db = getDb()
  const [row] = await db.insert(promo).values({
    nama: data.nama,
    deskripsi: data.deskripsi || null,
    bannerImage: data.bannerImage || null,
    tipeDiskon: data.tipeDiskon || 'persen',
    nilaiDiskon: data.nilaiDiskon ?? 0,
    mulai: data.mulai || null,
    selesai: data.selesai || null,
    aktif: data.aktif ?? 1,
  }).returning()
  return row
}

export async function updatePromo(id: number, data: Partial<{ nama: string; deskripsi: string; bannerImage: string; tipeDiskon: string; nilaiDiskon: number; mulai: string; selesai: string; aktif: number }>) {
  const db = getDb()
  const [row] = await db.update(promo).set(data).where(eq(promo.id, id)).returning()
  return row
}

export async function deletePromo(id: number) {
  const db = getDb()
  await db.delete(promo).where(eq(promo.id, id))
}

export async function getPromoItems(promoId: number): Promise<{ id: number; name: string; code: string }[]> {
  const rows = await rawAll<any>(
    `SELECT mb.id, mb.name, mb.code
     FROM promo_item pi
     JOIN master_barang mb ON mb.id = pi.barang_id
     WHERE pi.promo_id = ?
     ORDER BY pi.urutan ASC`,
    [promoId],
  )
  return rows.map((r) => ({ id: Number(r.id), name: r.name, code: r.code }))
}

export async function setPromoItems(promoId: number, barangIds: number[]) {
  const db = getDb()
  await db.delete(promoItem).where(eq(promoItem.promoId, promoId))
  if (barangIds.length > 0) {
    await db.insert(promoItem).values(
      barangIds.map((barangId, idx) => ({ promoId, barangId, urutan: idx })),
    )
  }
}

// ----- Menu Item CRUD -----
export type MenuItemRow = {
  id: number
  barangId: number
  kode: string
  nama: string
  photoUrl: string | null
  kategori: string | null
  urutan: number
  aktif: number
  deskripsi: string | null
  mediaCategory: string | null
  isRecommended: number
  isNew: number
  diskon: number
}

export async function listMenuItemsAll(): Promise<MenuItemRow[]> {
  const rows = await rawAll<any>(
    `SELECT mi.id, mi.barang_id AS "barangId", mb.code AS "kode", mb.name AS "nama",
            mb.photo_url AS "photoUrl", mi.photo_url AS "menuPhotoUrl", mk.name AS kategori,
            mi.media_category AS "mediaCategory", mi.is_recommended AS "isRecommended", mi.is_new AS "isNew",
            mi.diskon AS "diskon", mi.urutan, mi.aktif, mi.deskripsi
     FROM menu_item mi
     JOIN master_barang mb ON mb.id = mi.barang_id
     LEFT JOIN master_kategori mk ON mk.id = mb.kategori_id
     ORDER BY mi.urutan ASC`,
    [],
  )
  return rows.map((r) => ({
    id: Number(r.id),
    barangId: Number(r.barangId),
    kode: r.kode,
    nama: r.nama,
    photoUrl: r.menuPhotoUrl || r.photoUrl,
    kategori: r.kategori,
    urutan: Number(r.urutan),
    aktif: Number(r.aktif),
    deskripsi: r.deskripsi || null,
    mediaCategory: r.mediaCategory || null,
    isRecommended: Number(r.isRecommended) || 0,
    isNew: Number(r.isNew) || 0,
    diskon: Number(r.diskon) || 0,
  }))
}

export async function addMenuItem(barangId: number) {
  const db = getDb()
  const existing = await db.select({ id: menuItem.id }).from(menuItem).where(eq(menuItem.barangId, barangId))
  if (existing.length > 0) return existing[0]
  const [row] = await db.insert(menuItem).values({ barangId, urutan: 0, aktif: 1 }).returning()
  return row
}

export async function deleteMenuItem(id: number) {
  const db = getDb()
  await db.delete(menuItem).where(eq(menuItem.id, id))
}

export async function toggleMenuItem(id: number, aktif: number) {
  const db = getDb()
  const [row] = await db.update(menuItem).set({ aktif }).where(eq(menuItem.id, id)).returning()
  return row
}

export async function reorderMenuItem(id: number, urutan: number) {
  const db = getDb()
  const [row] = await db.update(menuItem).set({ urutan }).where(eq(menuItem.id, id)).returning()
  return row
}

export async function updateMenuItemDeskripsi(id: number, deskripsi: string) {
  const db = getDb()
  const [row] = await db.update(menuItem).set({ deskripsi }).where(eq(menuItem.id, id)).returning()
  return row
}

export async function updateMenuItemPhoto(id: number, url: string | null) {
  const db = getDb()
  const [row] = await db.update(menuItem).set({ photoUrl: url || null }).where(eq(menuItem.id, id)).returning()
  return row
}

export async function updateMenuItemMediaSettings(id: number, mediaCategory: string | null, isRecommended: number, isNew: number) {
  const db = getDb()
  const [row] = await db.update(menuItem).set({
    mediaCategory: mediaCategory || null,
    isRecommended: isRecommended ? 1 : 0,
    isNew: isNew ? 1 : 0,
  }).where(eq(menuItem.id, id)).returning()
  return row
}

export async function updateMenuItemDiskon(id: number, diskon: number) {
  const db = getDb()
  const v = Math.max(0, Math.min(100, Math.round(Number(diskon) || 0)))
  const [row] = await db.update(menuItem).set({ diskon: v }).where(eq(menuItem.id, id)).returning()
  return row
}

export async function reorderMenuItems(orderedIds: number[]) {
  const db = getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(menuItem).set({ urutan: i + 1 }).where(eq(menuItem.id, orderedIds[i]))
  }
}

// ----- Landing appearance settings -----
export type LandingSettings = {
  mainBackgroundType: 'default' | 'color' | 'image'
  mainBackgroundValue: string | null
  menuBackgroundType: 'default' | 'color' | 'image'
  menuBackgroundValue: string | null
  promoHeaderBg: string | null
  menuHeaderBg: string | null
  promoDiscountBg: string | null
  menuPriceColor: string | null
  cardBorderColor: string | null
  dividerColor: string | null
  promoCardTextColor: string | null
  promoCardDescriptionColor: string | null
  promoCardPriceColor: string | null
  menuCardTextColor: string | null
  heroImage: string | null
  heroTitle: string | null
  heroSubtitle: string | null
  promoCardBg: string | null
  menuDescColor: string | null
  menuCaptionColor: string | null
  categoryActiveBg: string | null
  categoryActiveText: string | null
  categoryInactiveBg: string | null
  categoryInactiveText: string | null
  categoryInactiveBorder: string | null
  categoryLabelBg: string | null
  categoryLabelText: string | null
  categoryLabelBorder: string | null
}

const SETTING_GROUP = 'promo_landing'

export async function getLandingSettings(): Promise<LandingSettings> {
  const rows = await rawAll<any>(`SELECT setting_key, setting_value FROM settings WHERE setting_group = ?`, [SETTING_GROUP])
  const map: Record<string, string> = {}
  for (const r of rows) map[r.setting_key] = r.setting_value ?? ''
  return {
    mainBackgroundType: (map[`${SETTING_GROUP}.main_background_type`] as any) || 'default',
    mainBackgroundValue: map[`${SETTING_GROUP}.main_background_value`] || null,
    menuBackgroundType: (map[`${SETTING_GROUP}.menu_background_type`] as any) || 'default',
    menuBackgroundValue: map[`${SETTING_GROUP}.menu_background_value`] || null,
    promoHeaderBg: map[`${SETTING_GROUP}.promo_header_bg`] || null,
    menuHeaderBg: map[`${SETTING_GROUP}.menu_header_bg`] || null,
    promoDiscountBg: map[`${SETTING_GROUP}.promo_discount_bg`] || null,
    menuPriceColor: map[`${SETTING_GROUP}.menu_price_color`] || null,
    cardBorderColor: map[`${SETTING_GROUP}.card_border_color`] || null,
    dividerColor: map[`${SETTING_GROUP}.divider_color`] || null,
    promoCardTextColor: map[`${SETTING_GROUP}.promo_card_text_color`] || null,
    promoCardDescriptionColor: map[`${SETTING_GROUP}.promo_card_description_color`] || null,
    promoCardPriceColor: map[`${SETTING_GROUP}.promo_card_price_color`] || null,
    menuCardTextColor: map[`${SETTING_GROUP}.menu_card_text_color`] || null,
    heroImage: map[`${SETTING_GROUP}.hero_image`] ?? null,
    heroTitle: map[`${SETTING_GROUP}.hero_title`] ?? null,
    heroSubtitle: map[`${SETTING_GROUP}.hero_subtitle`] ?? null,
    promoCardBg: map[`${SETTING_GROUP}.promo_card_bg`] || null,
    menuDescColor: map[`${SETTING_GROUP}.menu_desc_color`] || null,
    menuCaptionColor: map[`${SETTING_GROUP}.menu_caption_color`] || null,
    categoryActiveBg: map[`${SETTING_GROUP}.category_active_bg`] || null,
    categoryActiveText: map[`${SETTING_GROUP}.category_active_text`] || null,
    categoryInactiveBg: map[`${SETTING_GROUP}.category_inactive_bg`] || null,
    categoryInactiveText: map[`${SETTING_GROUP}.category_inactive_text`] || null,
    categoryInactiveBorder: map[`${SETTING_GROUP}.category_inactive_border`] || null,
    categoryLabelBg: map[`${SETTING_GROUP}.category_label_bg`] || null,
    categoryLabelText: map[`${SETTING_GROUP}.category_label_text`] || null,
    categoryLabelBorder: map[`${SETTING_GROUP}.category_label_border`] || null,
  }
}

export async function upsertLandingSettings(data: Partial<LandingSettings>) {
  const entries: [string, string][] = []
  if (data.mainBackgroundType !== undefined) entries.push(['main_background_type', data.mainBackgroundType])
  if (data.mainBackgroundValue !== undefined) entries.push(['main_background_value', data.mainBackgroundValue || ''])
  if (data.menuBackgroundType !== undefined) entries.push(['menu_background_type', data.menuBackgroundType])
  if (data.menuBackgroundValue !== undefined) entries.push(['menu_background_value', data.menuBackgroundValue || ''])
  if (data.promoHeaderBg !== undefined) entries.push(['promo_header_bg', data.promoHeaderBg || ''])
  if (data.menuHeaderBg !== undefined) entries.push(['menu_header_bg', data.menuHeaderBg || ''])
  if (data.promoDiscountBg !== undefined) entries.push(['promo_discount_bg', data.promoDiscountBg || ''])
    if (data.menuPriceColor !== undefined) entries.push(['menu_price_color', data.menuPriceColor || ''])
    if (data.cardBorderColor !== undefined) entries.push(['card_border_color', data.cardBorderColor || ''])
    if (data.dividerColor !== undefined) entries.push(['divider_color', data.dividerColor || ''])
    if (data.promoCardTextColor !== undefined) entries.push(['promo_card_text_color', data.promoCardTextColor || ''])
    if (data.promoCardDescriptionColor !== undefined) entries.push(['promo_card_description_color', data.promoCardDescriptionColor || ''])
    if (data.promoCardPriceColor !== undefined) entries.push(['promo_card_price_color', data.promoCardPriceColor || ''])
    if (data.menuCardTextColor !== undefined) entries.push(['menu_card_text_color', data.menuCardTextColor || ''])
    if (data.heroImage !== undefined) entries.push(['hero_image', data.heroImage || ''])
    if (data.heroTitle !== undefined) entries.push(['hero_title', data.heroTitle || ''])
    if (data.heroSubtitle !== undefined) entries.push(['hero_subtitle', data.heroSubtitle || ''])
    if (data.promoCardBg !== undefined) entries.push(['promo_card_bg', data.promoCardBg || ''])
    if (data.menuDescColor !== undefined) entries.push(['menu_desc_color', data.menuDescColor || ''])
    if (data.menuCaptionColor !== undefined) entries.push(['menu_caption_color', data.menuCaptionColor || ''])
    if (data.categoryActiveBg !== undefined) entries.push(['category_active_bg', data.categoryActiveBg || ''])
    if (data.categoryActiveText !== undefined) entries.push(['category_active_text', data.categoryActiveText || ''])
    if (data.categoryInactiveBg !== undefined) entries.push(['category_inactive_bg', data.categoryInactiveBg || ''])
    if (data.categoryInactiveText !== undefined) entries.push(['category_inactive_text', data.categoryInactiveText || ''])
    if (data.categoryInactiveBorder !== undefined) entries.push(['category_inactive_border', data.categoryInactiveBorder || ''])
    if (data.categoryLabelBg !== undefined) entries.push(['category_label_bg', data.categoryLabelBg || ''])
    if (data.categoryLabelText !== undefined) entries.push(['category_label_text', data.categoryLabelText || ''])
    if (data.categoryLabelBorder !== undefined) entries.push(['category_label_border', data.categoryLabelBorder || ''])
  for (const [k, v] of entries) {
    await rawRun(
      `INSERT INTO settings (setting_key, setting_value, setting_group) VALUES (?,?,?)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_group = EXCLUDED.setting_group`,
      [`${SETTING_GROUP}.${k}`, v, SETTING_GROUP],
    )
  }
}

// ----- PIN akses setting -----
export async function getSettingPin(): Promise<string | null> {
  const rows = await rawAll<any>(`SELECT setting_value FROM settings WHERE setting_key = ?`, ['promo_landing.settings_pin'])
  const v = rows[0]?.setting_value
  return v ? String(v) : null
}

export async function setSettingPin(pin: string) {
  await rawRun(
    `INSERT INTO settings (setting_key, setting_value, setting_group) VALUES (?,?,?)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_group = EXCLUDED.setting_group`,
    ['promo_landing.settings_pin', pin, SETTING_GROUP],
  )
}
