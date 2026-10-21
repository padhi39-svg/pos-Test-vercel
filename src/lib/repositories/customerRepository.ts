import { getDb } from '@/db'
import { masterCustomer } from '@/db/schema'
import { eq, like, or, and, asc, desc, sql } from 'drizzle-orm'
import { count } from 'drizzle-orm'

export interface CustomerFilter {
  q?: string
  includeDeleted?: boolean
}

export function findAllCustomers(filter: CustomerFilter = {}) {
  const db = getDb()
  const conditions = filter.includeDeleted ? [] : [eq(masterCustomer.isdelete, 0)]
  
  if (filter.q) {
    conditions.push(
      or(
        like(masterCustomer.name, `%${filter.q}%`),
        like(masterCustomer.code, `%${filter.q}%`),
        like(masterCustomer.phone, `%${filter.q}%`),
      )!,
    )
  }

  return db.select().from(masterCustomer)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(masterCustomer.name))
}

export async function findCustomersPaginated({
  q, page, pageSize, sortBy, sortDir
}: {
  q?: string; page: number; pageSize: number; sortBy: string; sortDir: string
}) {
  const db = getDb()
  const conditions = [eq(masterCustomer.isdelete, 0)]

  if (q) {
    conditions.push(
      or(
        like(masterCustomer.name, `%${q}%`),
        like(masterCustomer.code, `%${q}%`),
        like(masterCustomer.phone, `%${q}%`),
      )!,
    )
  }

  const where = and(...conditions)!
  const offset = (page - 1) * pageSize

  const allowedSort: Record<string, any> = {
    code: masterCustomer.code,
    name: masterCustomer.name,
    address: masterCustomer.address,
    phone: masterCustomer.phone,
    discount_percent: masterCustomer.discountPercent,
    term: masterCustomer.term,
    jenis_customer_id: masterCustomer.jenisCustomerId,
  }
  const orderCol = allowedSort[sortBy] || masterCustomer.name
  const orderFn = sortDir === 'asc' ? asc : desc

  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(masterCustomer).where(where),
    db.select().from(masterCustomer)
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(pageSize)
      .offset(offset),
  ])

  const total = Number(totalResult[0]?.value || 0)
  return { rows, total, page, pageSize }
}

export function findCustomerById(id: number) {
  const db = getDb()
  return db.select().from(masterCustomer).where(eq(masterCustomer.id, id)).then(r => r[0] ?? null)
}

export function findCustomerByCode(code: string) {
  const db = getDb()
  return db.select().from(masterCustomer).where(eq(masterCustomer.code, code)).then(r => r[0] ?? null)
}

export function createCustomer(data: {
  code: string
  name: string
  address?: string | null
  phone?: string | null
  npwp?: string | null
  discountPercent?: number
  term?: number
  jenisCustomerId?: number | null
}) {
  const db = getDb()
  return db.insert(masterCustomer).values({
    code: data.code,
    name: data.name,
    address: data.address ?? null,
    phone: data.phone ?? null,
    npwp: data.npwp ?? null,
    discountPercent: data.discountPercent ?? 0,
    term: data.term ?? 0,
    jenisCustomerId: data.jenisCustomerId ?? null,
  }).returning().then(r => r[0] ?? null)
}

export function updateCustomer(id: number, data: Partial<{
  code: string; name: string; address: string; phone: string
  npwp: string; discountPercent: number; term: number; jenisCustomerId: number | null
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
  if (data.jenisCustomerId !== undefined) values.jenisCustomerId = data.jenisCustomerId
  return db.update(masterCustomer).set(values).where(eq(masterCustomer.id, id))
}

export function softDeleteCustomer(id: number) {
  const db = getDb()
  return db.update(masterCustomer).set({ isdelete: 1 }).where(eq(masterCustomer.id, id))
}
