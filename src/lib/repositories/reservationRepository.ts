import { getDb } from '@/db'
import { reservations, reservationTables, masterMeja, floors } from '@/db/schema'
import { eq, and, gte, lte, like, asc, desc } from 'drizzle-orm'

export function findAllReservations(filter: {
  status?: string
  from?: string
  to?: string
  q?: string
}) {
  const db = getDb()
  const conditions: any[] = []
  if (filter.status) conditions.push(eq(reservations.status, filter.status))
  if (filter.from) conditions.push(gte(reservations.date, filter.from))
  if (filter.to) conditions.push(lte(reservations.date, filter.to))
  if (filter.q) {
    conditions.push(
      like(reservations.customerName, `%${filter.q}%`),
    )
  }
  return db.select().from(reservations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(reservations.date))
    
}

export function findReservationById(id: number) {
  const db = getDb()
  return db.select().from(reservations).where(eq(reservations.id, id)).then(r => r[0] ?? null)
}

export function findReservationTables(reservationId: number) {
  const db = getDb()
  return db.select().from(reservationTables)
    .where(eq(reservationTables.reservationId, reservationId))
}

export function findAllFloors(activeOnly = true) {
  const db = getDb()
  const conditions = [eq(floors.isdelete, 0)]
  if (activeOnly) conditions.push(eq(floors.isActive, 1))
  return db.select().from(floors).where(and(...conditions)).orderBy(asc(floors.levelNo))
}

export function findAllMeja(activeOnly = true) {
  const db = getDb()
  const conditions: any[] = []
  if (activeOnly) conditions.push(eq(masterMeja.isActive, 1))
  return db.select().from(masterMeja).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(masterMeja.code))
}

export function findMejaById(id: number) {
  const db = getDb()
  return db.select().from(masterMeja).where(eq(masterMeja.id, id)).then(r => r[0] ?? null)
}
