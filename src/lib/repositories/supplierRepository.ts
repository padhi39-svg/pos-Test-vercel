import { getDb } from '@/db'
import { masterSupplier, accounts } from '@/db/schema'
import { eq, like, or, and, asc, desc, sql } from 'drizzle-orm'
import { count } from 'drizzle-orm'

export function findAllSuppliers(q?: string) {
  const db = getDb()
  const conditions = [eq(masterSupplier.isdelete, 0)]
  
  if (q) {
    conditions.push(
      or(
        like(masterSupplier.name, `%${q}%`),
        like(masterSupplier.code, `%${q}%`),
      )!,
    )
  }

  return db.select().from(masterSupplier)
    .where(and(...conditions))
    .orderBy(asc(masterSupplier.name))
}

export async function findSuppliersPaginated({
  q, page, pageSize, sortBy, sortDir
}: {
  q?: string; page: number; pageSize: number; sortBy: string; sortDir: string
}) {
  const db = getDb()
  const conditions = [eq(masterSupplier.isdelete, 0)]

  if (q) {
    conditions.push(
      or(
        like(masterSupplier.name, `%${q}%`),
        like(masterSupplier.code, `%${q}%`),
        like(masterSupplier.phone, `%${q}%`),
      )!,
    )
  }

  const where = and(...conditions)!
  const offset = (page - 1) * pageSize

  const allowedSort: Record<string, any> = {
    code: masterSupplier.code,
    name: masterSupplier.name,
    address: masterSupplier.address,
    phone: masterSupplier.phone,
    discount_percent: masterSupplier.discountPercent,
    term: masterSupplier.term,
  }
  const orderCol = allowedSort[sortBy] || masterSupplier.name
  const orderFn = sortDir === 'asc' ? asc : desc

  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(masterSupplier).where(where),
    db.select().from(masterSupplier)
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(pageSize)
      .offset(offset),
  ])

  const total = Number(totalResult[0]?.value || 0)
  return { rows, total, page, pageSize }
}

export function findSupplierById(id: number) {
  const db = getDb()
  return db.select().from(masterSupplier).where(eq(masterSupplier.id, id)).then(r => r[0] ?? null)
}

export function findSupplierWithAccount(id: number) {
  const db = getDb()
  return db
    .select({
      id: masterSupplier.id,
      code: masterSupplier.code,
      name: masterSupplier.name,
      address: masterSupplier.address,
      phone: masterSupplier.phone,
      npwp: masterSupplier.npwp,
      discountPercent: masterSupplier.discountPercent,
      term: masterSupplier.term,
      accountId: masterSupplier.accountId,
      kodeInt: masterSupplier.kodeInt,
      isdelete: masterSupplier.isdelete,
      createdAt: masterSupplier.createdAt,
      updatedAt: masterSupplier.updatedAt,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(masterSupplier)
    .leftJoin(accounts, eq(masterSupplier.accountId, accounts.id))
    .where(eq(masterSupplier.id, id))
    .then(r => r[0] ?? null)
}

export function createSupplier(data: {
  code: string; name: string; address?: string | null; phone?: string | null
  npwp?: string | null; discountPercent?: number; term?: number
  accountId?: number | null; kodeInt?: string | null
}) {
  const db = getDb()
  return db.insert(masterSupplier).values({
    code: data.code,
    name: data.name,
    address: data.address ?? null,
    phone: data.phone ?? null,
    npwp: data.npwp ?? null,
    discountPercent: String(data.discountPercent ?? 0),
    term: data.term ?? 0,
    accountId: data.accountId ?? null,
    kodeInt: data.kodeInt ?? null,
  }).returning().then(r => r[0] ?? null)
}

export function updateSupplier(id: number, data: Partial<{
  code: string; name: string; address: string; phone: string
  npwp: string; discountPercent: number; term: number
  accountId: number | null
}>) {
  const db = getDb()
  const values: Record<string, any> = {}
  if (data.code !== undefined) values.code = data.code
  if (data.name !== undefined) values.name = data.name
  if (data.address !== undefined) values.address = data.address
  if (data.phone !== undefined) values.phone = data.phone
  if (data.npwp !== undefined) values.npwp = data.npwp
  if (data.discountPercent !== undefined) values.discountPercent = String(data.discountPercent)
  if (data.term !== undefined) values.term = data.term
  if (data.accountId !== undefined) values.accountId = data.accountId
  values.updatedAt = sql`CURRENT_TIMESTAMP`
  return db.update(masterSupplier).set(values).where(eq(masterSupplier.id, id))
}

export function softDeleteSupplier(id: number) {
  const db = getDb()
  return db.update(masterSupplier).set({ isdelete: 1, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(masterSupplier.id, id))
}
