import { getDb } from '@/db'
import { masterBarang, barangUnits, barangPrices, barangRecipes, masterKategori, masterSpesifikasi, masterMerk, accounts } from '@/db/schema'
import { eq, ilike, and, or, sql, asc, desc, count, inArray } from 'drizzle-orm'

export interface BarangFilter {
  q?: string
  jenis?: number[]
  kategoriId?: number
  aktif?: boolean
  tampilMenu?: boolean
  includeDeleted?: boolean
}

export interface CreateBarangInput {
  code: string
  name: string
  kategoriId?: number | null
  spesifikasiId?: number | null
  merkId?: number | null
  hpp?: number
  jenis?: number
  aktif?: boolean
  tampilMenu?: boolean
  photoUrl?: string | null
  accountId?: number | null
}

export function findAllBarang(filter: BarangFilter = {}) {
  const db = getDb()
  const conditions = [sql`COALESCE(${masterBarang.isdelete}, 0) = 0`]
  
  if (filter.q) {
    conditions.push(
      or(
        ilike(masterBarang.name, `%${filter.q}%`),
        ilike(masterBarang.code, `%${filter.q}%`),
      )!,
    )
  }
  if (filter.jenis && filter.jenis.length > 0) {
    conditions.push(inArray(masterBarang.jenis, filter.jenis))
  }
  if (filter.kategoriId !== undefined) {
    conditions.push(eq(masterBarang.kategoriId, filter.kategoriId))
  }
  if (filter.aktif !== undefined) {
    conditions.push(eq(masterBarang.aktif, filter.aktif ? 1 : 0))
  }

  return db.select().from(masterBarang).where(and(...conditions)).orderBy(asc(masterBarang.name))
}

export function findAllBarangWithJoins(filter: BarangFilter = {}) {
  const db = getDb()
  const conditions = [sql`COALESCE(${masterBarang.isdelete}, 0) = 0`]

  if (filter.q) {
    conditions.push(
      or(
        ilike(masterBarang.name, `%${filter.q}%`),
        ilike(masterBarang.code, `%${filter.q}%`),
      )!,
    )
  }
  if (filter.jenis && filter.jenis.length > 0) {
    conditions.push(inArray(masterBarang.jenis, filter.jenis))
  }
  if (filter.aktif !== undefined) {
    conditions.push(eq(masterBarang.aktif, filter.aktif ? 1 : 0))
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]

  return db.select({
    id: masterBarang.id,
    code: masterBarang.code,
    name: masterBarang.name,
    hpp: masterBarang.hpp,
    jenis: masterBarang.jenis,
    aktif: masterBarang.aktif,
    tampilMenu: masterBarang.tampilMenu,
    photoUrl: masterBarang.photoUrl,
    isdelete: masterBarang.isdelete,
    createdAt: masterBarang.createdAt,
    updatedAt: masterBarang.updatedAt,
    accountId: masterBarang.accountId,
    accountCode: accounts.code,
    accountName: accounts.name,
    kategoriId: masterBarang.kategoriId,
    kategoriName: masterKategori.name,
    spesifikasiId: masterBarang.spesifikasiId,
    spesifikasiName: masterSpesifikasi.name,
    merkId: masterBarang.merkId,
    merkName: masterMerk.name,
  }).from(masterBarang)
    .leftJoin(masterKategori, eq(masterBarang.kategoriId, masterKategori.id))
    .leftJoin(masterSpesifikasi, eq(masterBarang.spesifikasiId, masterSpesifikasi.id))
    .leftJoin(masterMerk, eq(masterBarang.merkId, masterMerk.id))
    .leftJoin(accounts, eq(masterBarang.accountId, accounts.id))
    .where(where)
    .orderBy(asc(masterBarang.name))
    
}

export async function findBarangPaginated({
  q, jenis, sortBy, sortDir, page, pageSize
}: BarangFilter & { sortBy: string; sortDir: string; page: number; pageSize: number }) {
  const db = getDb()
  const conditions: any[] = [sql`COALESCE(${masterBarang.isdelete}, 0) = 0`]

  if (q) {
    conditions.push(
      or(
        ilike(masterBarang.name, `%${q}%`),
        ilike(masterBarang.code, `%${q}%`),
      )!,
    )
  }
  if (jenis && jenis.length > 0) {
    conditions.push(inArray(masterBarang.jenis, jenis))
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]
  const offset = (page - 1) * pageSize

  const allowedSort: Record<string, any> = {
    code: masterBarang.code,
    name: masterBarang.name,
    hpp: masterBarang.hpp,
    jenis: masterBarang.jenis,
    aktif: masterBarang.aktif,
    created_at: masterBarang.createdAt,
    updated_at: masterBarang.updatedAt,
    kategori_id: masterBarang.kategoriId,
  }
  const orderCol = allowedSort[sortBy] || masterBarang.name
  const orderFn = sortDir === 'asc' ? asc : desc

  const baseQuery = db.select({
    id: masterBarang.id,
    code: masterBarang.code,
    name: masterBarang.name,
    hpp: masterBarang.hpp,
    jenis: masterBarang.jenis,
    aktif: masterBarang.aktif,
    tampilMenu: masterBarang.tampilMenu,
    photoUrl: masterBarang.photoUrl,
    isdelete: masterBarang.isdelete,
    createdAt: masterBarang.createdAt,
    updatedAt: masterBarang.updatedAt,
    accountId: masterBarang.accountId,
    accountCode: accounts.code,
    accountName: accounts.name,
    kategoriId: masterBarang.kategoriId,
    kategoriName: masterKategori.name,
    spesifikasiId: masterBarang.spesifikasiId,
    spesifikasiName: masterSpesifikasi.name,
    merkId: masterBarang.merkId,
    merkName: masterMerk.name,
  }).from(masterBarang)
    .leftJoin(masterKategori, eq(masterBarang.kategoriId, masterKategori.id))
    .leftJoin(masterSpesifikasi, eq(masterBarang.spesifikasiId, masterSpesifikasi.id))
    .leftJoin(masterMerk, eq(masterBarang.merkId, masterMerk.id))
    .leftJoin(accounts, eq(masterBarang.accountId, accounts.id))
    .where(where)

  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(masterBarang).where(where),
    baseQuery.orderBy(orderFn(orderCol)).limit(pageSize).offset(offset),
  ])

  const total = Number(totalResult[0]?.value || 0)
  return { rows, total, page, pageSize }
}

export function findBarangById(id: number) {
  const db = getDb()
  return db.select().from(masterBarang).where(eq(masterBarang.id, id)).then(r => r[0] ?? null)
}

export function findBarangByCode(code: string) {
  const db = getDb()
  return db.select().from(masterBarang).where(eq(masterBarang.code, code)).then(r => r[0] ?? null)
}

export async function countBarang() {
  const db = getDb()
  const result = await db.select({ total: count() }).from(masterBarang).then(r => r[0] ?? null)
  return result?.total ?? 0
}

export function createBarang(data: CreateBarangInput) {
  const db = getDb()
  return db.insert(masterBarang).values({
    code: data.code,
    name: data.name,
    kategoriId: data.kategoriId ?? null,
    spesifikasiId: data.spesifikasiId ?? null,
    merkId: data.merkId ?? null,
    hpp: Number(data.hpp ?? 0),
    jenis: data.jenis ?? 1,
    aktif: data.aktif !== false ? 1 : 0,
    tampilMenu: data.tampilMenu === true ? 1 : 0,
    photoUrl: data.photoUrl ?? null,
    accountId: data.accountId ?? null,
  }).returning().then(r => r[0] ?? null)
}

export function updateBarang(id: number, data: Partial<CreateBarangInput>) {
  const db = getDb()
  const values: Record<string, any> = {}
  if (data.code !== undefined) values.code = data.code
  if (data.name !== undefined) values.name = data.name
  if (data.kategoriId !== undefined) values.kategoriId = data.kategoriId
  if (data.spesifikasiId !== undefined) values.spesifikasiId = data.spesifikasiId
  if (data.merkId !== undefined) values.merkId = data.merkId
  if (data.hpp !== undefined) values.hpp = Number(data.hpp)
  if (data.jenis !== undefined) values.jenis = data.jenis
  if (data.aktif !== undefined) values.aktif = data.aktif ? 1 : 0
  if (data.tampilMenu !== undefined) values.tampilMenu = data.tampilMenu ? 1 : 0
  if (data.photoUrl !== undefined) values.photoUrl = data.photoUrl
  return db.update(masterBarang).set(values).where(eq(masterBarang.id, id))
}

export function softDeleteBarang(id: number) {
  const db = getDb()
  return db.update(masterBarang).set({ isdelete: 1 }).where(eq(masterBarang.id, id))
}

export function findBarangUnits(barangId: number) {
  const db = getDb()
  return db.select().from(barangUnits).where(eq(barangUnits.barangId, barangId)).orderBy(asc(barangUnits.ratio))
}

export function findBarangPrices(barangId: number) {
  const db = getDb()
  return db.select().from(barangPrices).where(eq(barangPrices.barangId, barangId)).orderBy(asc(barangPrices.effectiveDate))
}

export async function findBarangWithDetails(id: number) {
  const db = getDb()
  const barang = await findBarangById(id)
  if (!barang) return null
  const units = findBarangUnits(id)
  const prices = findBarangPrices(id)
  return { ...barang, units, prices }
}

export async function validateFk(table: string, id: number | null): Promise<boolean> {
  if (!id) return true
  const db = getDb()
  const result = await db.select({ id: sql<number>`id` })
    .from(sql.raw(table))
    .where(and(
      eq(sql`id`, id),
      sql`isdelete = 0`,
    ))
    .then(r => r[0] ?? null)
  return !!result
}

export function findLatestPrices(barangId: number) {
  const db = getDb()
  return db.select({
    unitId: barangPrices.unitId,
    price: barangPrices.price,
    effectiveDate: barangPrices.effectiveDate,
  }).from(barangPrices)
    .where(and(
      eq(barangPrices.barangId, barangId),
      sql`${barangPrices.effectiveDate}::date <= CURRENT_DATE`,
    ))
    .orderBy(desc(barangPrices.effectiveDate))
    
}
