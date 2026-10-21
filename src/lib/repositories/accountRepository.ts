import { getDb } from '@/db'
import { accounts, accountMappings, masterBanks } from '@/db/schema'
import { eq, and, like, asc, or } from 'drizzle-orm'

export function findAllAccounts(q?: string) {
  const db = getDb()
  const conditions = [eq(accounts.isActive, 1)]
  if (q) {
    conditions.push(
      or(
        like(accounts.code, `%${q}%`),
        like(accounts.name, `%${q}%`),
      )!,
    )
  }
  return db.select().from(accounts).where(and(...conditions)).orderBy(asc(accounts.code))
}

export function findAccountById(id: number) {
  const db = getDb()
  return db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0] ?? null)
}

export function findAccountByCode(code: string) {
  const db = getDb()
  return db.select().from(accounts).where(eq(accounts.code, code)).then(r => r[0] ?? null)
}

export function createAccount(data: {
  code: string; name: string; parentId?: number | null; level?: number
  isHeader?: number; normalBalance: string; isActive?: number
  isCash?: number; isBankAccount?: number; postingAllowed?: number
  golongan?: string | null; userCreate?: number | null
}) {
  const db = getDb()
  return db.insert(accounts).values({
    code: data.code,
    name: data.name,
    parentId: data.parentId ?? null,
    level: data.level ?? 1,
    isHeader: data.isHeader ?? 0,
    normalBalance: data.normalBalance,
    isActive: data.isActive ?? 1,
    isCash: data.isCash ?? 0,
    isBankAccount: data.isBankAccount ?? 0,
    postingAllowed: data.postingAllowed ?? 1,
    golongan: data.golongan ?? null,
    userCreate: data.userCreate ?? null,
  }).returning().then(r => r[0] ?? null)
}

export function findAccountMappings(group?: string) {
  const db = getDb()
  if (group) {
    return db.select().from(accountMappings).where(eq(accountMappings.mapGroup, group))
  }
  return db.select().from(accountMappings)
}

export function findAllBanks() {
  const db = getDb()
  return db.select().from(masterBanks).where(eq(masterBanks.isdelete, 0))
}
