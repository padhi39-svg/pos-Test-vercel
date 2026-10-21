import { getDb } from '@/db'
import { masterUsers, sessions, levelPermissions, menuPermissions } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export function findUserById(id: number) {
  const db = getDb()
  return db.select().from(masterUsers).where(eq(masterUsers.id, id)).then(r => r[0] ?? null)
}

export function findUserByEmail(email: string) {
  const db = getDb()
  return db.select().from(masterUsers).where(eq(masterUsers.email, email)).then(r => r[0] ?? null)
}

export function findUserByCode(code: string) {
  const db = getDb()
  return db.select().from(masterUsers).where(eq(masterUsers.code, code)).then(r => r[0] ?? null)
}

export function findSessionByToken(token: string) {
  const db = getDb()
  return db.select().from(sessions)
    .where(and(
      eq(sessions.token, token),
      sql`${sessions.expiresAt} > CURRENT_TIMESTAMP`,
    )).then(r => r[0] ?? null)
}

export function createSession(data: { userId: number; token: string; expiresAt: string }) {
  const db = getDb()
  return db.insert(sessions).values(data).returning().then(r => r[0] ?? null)
}

export function deleteSession(token: string) {
  const db = getDb()
  return db.delete(sessions).where(eq(sessions.token, token))
}

export function cleanupSessions() {
  const db = getDb()
  return db.delete(sessions).where(sql`${sessions.expiresAt} < CURRENT_TIMESTAMP`)
}

export function findLevelPermissions(levelId: number) {
  const db = getDb()
  return db.select().from(levelPermissions).where(eq(levelPermissions.levelId, levelId))
}

export function findAllMenuPermissions() {
  const db = getDb()
  return db.select().from(menuPermissions)
}
