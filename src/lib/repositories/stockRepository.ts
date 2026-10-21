import { getDb } from '@/db'
import { stockMovements, stockBalance, masterBarang, masterIngredient } from '@/db/schema'
import { eq, and, gte, lte, asc, desc, sql } from 'drizzle-orm'

export function findStockMovements(filter: {
  ingredientId?: number
  from?: string
  to?: string
  limit?: number
}) {
  const db = getDb()
  const conditions: any[] = []
  if (filter.ingredientId) conditions.push(eq(stockMovements.ingredientId, filter.ingredientId))
  if (filter.from) conditions.push(gte(stockMovements.createdAt, filter.from))
  if (filter.to) conditions.push(lte(stockMovements.createdAt, filter.to + ' 23:59:59'))
  
  return db.select().from(stockMovements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(stockMovements.createdAt))
    .limit(filter.limit ?? 50)
    
}

export function findStockBalance(ingredientId?: number, warehouseId?: number) {
  const db = getDb()
  const conditions: any[] = []
  if (ingredientId) conditions.push(eq(stockBalance.ingredientId, ingredientId))
  if (warehouseId) conditions.push(eq(stockBalance.warehouseId, warehouseId))
  
  return db.select().from(stockBalance)
    .where(conditions.length ? and(...conditions) : undefined)
    
}

export function createStockMovement(data: {
  ingredientId: number; movementType: string; quantity: number; unit: string
  referenceType?: string; referenceId?: number; notes?: string; warehouseId?: number
}) {
  const db = getDb()
  return db.insert(stockMovements).values({
    ingredientId: data.ingredientId,
    movementType: data.movementType,
    quantity: String(data.quantity),
    unit: data.unit,
    referenceType: data.referenceType ?? null,
    referenceId: data.referenceId ?? null,
    notes: data.notes ?? null,
    warehouseId: data.warehouseId ?? null,
  }).returning().then(r => r[0] ?? null)
}

export function findAllIngredients(q?: string) {
  const db = getDb()
  const conditions = [eq(masterIngredient.isdelete, 0)]
  if (q) {
    conditions.push(sql`(LOWER(${masterIngredient.name}) LIKE ${`%${q}%`} OR LOWER(${masterIngredient.code}) LIKE ${`%${q}%`})`)
  }
  return db.select().from(masterIngredient).where(and(...conditions)).orderBy(asc(masterIngredient.name))
}
