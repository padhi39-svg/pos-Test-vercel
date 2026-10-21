import { getDb } from '@/db'
import { masterKategori, masterSpesifikasi, masterMerk } from '@/db/schema'
import { eq, like, and, asc, desc, sql, count, or } from 'drizzle-orm'

// === KATEGORI ===
export function findAllKategori(q?: string) {
  const db = getDb()
  const conditions = [eq(masterKategori.isdelete, 0)]
  if (q) conditions.push(like(masterKategori.name, `%${q}%`))
  return db.select().from(masterKategori).where(and(...conditions)).orderBy(asc(masterKategori.name))
}

export async function findKategoriPaginated({
  q, page, pageSize, sortBy, sortDir
}: {
  q?: string; page: number; pageSize: number; sortBy: string; sortDir: string
}) {
  const db = getDb()
  const conditions = [eq(masterKategori.isdelete, 0)]
  if (q) {
    conditions.push(
      or(
        like(masterKategori.name, `%${q}%`),
        like(masterKategori.code, `%${q}%`),
      )!,
    )
  }
  const where = and(...conditions)!
  const offset = (page - 1) * pageSize
  const allowedSort: Record<string, any> = {
    code: masterKategori.code,
    name: masterKategori.name,
  }
  const orderCol = allowedSort[sortBy] || masterKategori.name
  const orderFn = sortDir === 'asc' ? asc : desc
  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(masterKategori).where(where),
    db.select().from(masterKategori).where(where).orderBy(orderFn(orderCol)).limit(pageSize).offset(offset),
  ])
  return { rows, total: Number(totalResult[0]?.value || 0), page, pageSize }
}

export function findKategoriById(id: number) {
  const db = getDb()
  return db.select().from(masterKategori).where(eq(masterKategori.id, id)).then(r => r[0] ?? null)
}

export function findKategoriByCode(code: string) {
  const db = getDb()
  return db.select().from(masterKategori).where(and(eq(masterKategori.isdelete, 0), eq(masterKategori.code, code))).then(r => r[0] ?? null)
}

export function createKategori(data: { code: string; name: string; printTarget?: string | null; userCreate?: number | null }) {
  const db = getDb()
  return db.insert(masterKategori).values(data).returning().then(r => r[0] ?? null)
}

export function updateKategori(id: number, data: { code?: string; name?: string; printTarget?: string | null; userEdit?: number | null }) {
  const db = getDb()
  return db.update(masterKategori).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(masterKategori.id, id))
}

export function softDeleteKategori(id: number, userEdit?: number | null) {
  const db = getDb()
  return db.update(masterKategori).set({ isdelete: 1, updatedAt: sql`CURRENT_TIMESTAMP`, userEdit: userEdit ?? undefined }).where(eq(masterKategori.id, id))
}

// === SPESIFIKASI ===
export function findAllSpesifikasi(q?: string) {
  const db = getDb()
  const conditions = [eq(masterSpesifikasi.isdelete, 0)]
  if (q) conditions.push(like(masterSpesifikasi.name, `%${q}%`))
  return db.select().from(masterSpesifikasi).where(and(...conditions)).orderBy(asc(masterSpesifikasi.name))
}

export async function findSpesifikasiPaginated({
  q, page, pageSize, sortBy, sortDir
}: {
  q?: string; page: number; pageSize: number; sortBy: string; sortDir: string
}) {
  const db = getDb()
  const conditions = [eq(masterSpesifikasi.isdelete, 0)]
  if (q) {
    conditions.push(
      or(
        like(masterSpesifikasi.name, `%${q}%`),
        like(masterSpesifikasi.code, `%${q}%`),
      )!,
    )
  }
  const where = and(...conditions)!
  const offset = (page - 1) * pageSize
  const allowedSort: Record<string, any> = {
    code: masterSpesifikasi.code,
    name: masterSpesifikasi.name,
  }
  const orderCol = allowedSort[sortBy] || masterSpesifikasi.name
  const orderFn = sortDir === 'asc' ? asc : desc
  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(masterSpesifikasi).where(where),
    db.select().from(masterSpesifikasi).where(where).orderBy(orderFn(orderCol)).limit(pageSize).offset(offset),
  ])
  return { rows, total: Number(totalResult[0]?.value || 0), page, pageSize }
}

export function findSpesifikasiById(id: number) {
  const db = getDb()
  return db.select().from(masterSpesifikasi).where(eq(masterSpesifikasi.id, id)).then(r => r[0] ?? null)
}

export function findSpesifikasiByCode(code: string) {
  const db = getDb()
  return db.select().from(masterSpesifikasi).where(and(eq(masterSpesifikasi.isdelete, 0), eq(masterSpesifikasi.code, code))).then(r => r[0] ?? null)
}

export function createSpesifikasi(data: { code: string; name: string; userCreate?: number | null }) {
  const db = getDb()
  return db.insert(masterSpesifikasi).values(data).returning().then(r => r[0] ?? null)
}

export function updateSpesifikasi(id: number, data: { code?: string; name?: string; userEdit?: number | null }) {
  const db = getDb()
  return db.update(masterSpesifikasi).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(masterSpesifikasi.id, id))
}

export function softDeleteSpesifikasi(id: number, userEdit?: number | null) {
  const db = getDb()
  return db.update(masterSpesifikasi).set({ isdelete: 1, updatedAt: sql`CURRENT_TIMESTAMP`, userEdit: userEdit ?? undefined }).where(eq(masterSpesifikasi.id, id))
}

// === MERK ===
export function findAllMerk(q?: string) {
  const db = getDb()
  const conditions = [eq(masterMerk.isdelete, 0)]
  if (q) conditions.push(like(masterMerk.name, `%${q}%`))
  return db.select().from(masterMerk).where(and(...conditions)).orderBy(asc(masterMerk.name))
}

export async function findMerkPaginated({
  q, page, pageSize, sortBy, sortDir
}: {
  q?: string; page: number; pageSize: number; sortBy: string; sortDir: string
}) {
  const db = getDb()
  const conditions = [eq(masterMerk.isdelete, 0)]
  if (q) {
    conditions.push(
      or(
        like(masterMerk.name, `%${q}%`),
        like(masterMerk.code, `%${q}%`),
      )!,
    )
  }
  const where = and(...conditions)!
  const offset = (page - 1) * pageSize
  const allowedSort: Record<string, any> = {
    code: masterMerk.code,
    name: masterMerk.name,
  }
  const orderCol = allowedSort[sortBy] || masterMerk.name
  const orderFn = sortDir === 'asc' ? asc : desc
  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(masterMerk).where(where),
    db.select().from(masterMerk).where(where).orderBy(orderFn(orderCol)).limit(pageSize).offset(offset),
  ])
  return { rows, total: Number(totalResult[0]?.value || 0), page, pageSize }
}

export function findMerkById(id: number) {
  const db = getDb()
  return db.select().from(masterMerk).where(eq(masterMerk.id, id)).then(r => r[0] ?? null)
}

export function findMerkByCode(code: string) {
  const db = getDb()
  return db.select().from(masterMerk).where(and(eq(masterMerk.isdelete, 0), eq(masterMerk.code, code))).then(r => r[0] ?? null)
}

export function createMerk(data: { code: string; name: string; userCreate?: number | null }) {
  const db = getDb()
  return db.insert(masterMerk).values(data).returning().then(r => r[0] ?? null)
}

export function updateMerk(id: number, data: { code?: string; name?: string; userEdit?: number | null }) {
  const db = getDb()
  return db.update(masterMerk).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(masterMerk.id, id))
}

export function softDeleteMerk(id: number, userEdit?: number | null) {
  const db = getDb()
  return db.update(masterMerk).set({ isdelete: 1, updatedAt: sql`CURRENT_TIMESTAMP`, userEdit: userEdit ?? undefined }).where(eq(masterMerk.id, id))
}
