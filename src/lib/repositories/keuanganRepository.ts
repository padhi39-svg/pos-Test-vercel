import { getDb } from '@/db'
import { jurnalHeader, jurnalDetail, accounts } from '@/db/schema'
import { eq, and, between, desc, asc, sql, like, gte, lte } from 'drizzle-orm'

export interface JurnalFilter {
  from?: string
  to?: string
  accountId?: number
  noBukti?: string
  limit?: number
  offset?: number
}

export async function findAllJurnal(filter: JurnalFilter = {}) {
  const db = getDb()
  const conditions: any[] = []

  if (filter.from) conditions.push(gte(jurnalHeader.tanggal, filter.from))
  if (filter.to) conditions.push(lte(jurnalHeader.tanggal, filter.to))
  if (filter.noBukti) conditions.push(like(jurnalHeader.noBukti, `%${filter.noBukti}%`))

  return await db.select().from(jurnalHeader)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(jurnalHeader.tanggal))
    .limit(filter.limit ?? 100)
    .offset(filter.offset ?? 0)
}

export async function findJurnalHeaderById(id: number) {
  const db = getDb()
  const [row] = await db.select().from(jurnalHeader).where(eq(jurnalHeader.id, id))
  return row
}

export async function findJurnalDetails(jurnalId: number) {
  const db = getDb()
  return await db.select()
    .from(jurnalDetail)
    .leftJoin(accounts, eq(jurnalDetail.accountId, accounts.id))
    .where(eq(jurnalDetail.jurnalId, jurnalId))
    .orderBy(asc(jurnalDetail.id))
}

export async function createJurnalHeader(data: {
  noBukti: string; tanggal: string; keterangan?: string | null
  totalDebet?: number; totalKredit?: number; source?: string | null
  referenceId?: number | null
}) {
  const db = getDb()
  const [row] = await db.insert(jurnalHeader).values({
    noBukti: data.noBukti,
    tanggal: data.tanggal,
    keterangan: data.keterangan ?? null,
    totalDebet: String(data.totalDebet ?? 0),
    totalKredit: String(data.totalKredit ?? 0),
    source: data.source ?? null,
    referenceId: data.referenceId ?? null,
  }).returning()
  return row
}

export async function createJurnalDetail(data: {
  jurnalId: number; accountId: number; debet?: number; kredit?: number
  keterangan?: string | null; referenceType?: string | null
  referenceId?: number | null
}) {
  const db = getDb()
  const [row] = await db.insert(jurnalDetail).values({
    jurnalId: data.jurnalId,
    accountId: data.accountId,
    debet: String(data.debet ?? 0),
    kredit: String(data.kredit ?? 0),
    keterangan: data.keterangan ?? null,
    referenceType: data.referenceType ?? null,
    referenceId: data.referenceId ?? null,
  }).returning()
  return row
}

export async function findSaldoAkun(accountId: number, from?: string, to?: string) {
  const db = getDb()
  const conditions = [eq(jurnalDetail.accountId, accountId)]
  if (from) conditions.push(gte(jurnalHeader.tanggal, from))
  if (to) conditions.push(lte(jurnalHeader.tanggal, to))

  const [result] = await db.select({
    totalDebet: sql<string>`COALESCE(SUM(CAST(${jurnalDetail.debet} AS DECIMAL(18,2))), 0)`,
    totalKredit: sql<string>`COALESCE(SUM(CAST(${jurnalDetail.kredit} AS DECIMAL(18,2))), 0)`,
  }).from(jurnalDetail)
    .innerJoin(jurnalHeader, eq(jurnalDetail.jurnalId, jurnalHeader.id))
    .where(and(...conditions))
  return result ?? { totalDebet: '0', totalKredit: '0' }
}

export async function findLastNoBukti(prefix: string) {
  const db = getDb()
  const [row] = await db.select({ noBukti: jurnalHeader.noBukti })
    .from(jurnalHeader)
    .where(like(jurnalHeader.noBukti, `${prefix}%`))
    .orderBy(desc(jurnalHeader.id))
  return row ?? null
}

export async function deleteJurnal(id: number) {
  const db = getDb()
  await db.delete(jurnalDetail).where(eq(jurnalDetail.jurnalId, id))
  return await db.delete(jurnalHeader).where(eq(jurnalHeader.id, id))
}
