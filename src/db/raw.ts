import { getDb } from './index'
import type { PoolClient } from 'pg'

function toPg(sql: string, params?: any[]): { text: string; values: any[] } {
  if (!params || params.length === 0) return { text: sql, values: [] }
  let idx = 0
  const text = sql.replace(/\?/g, () => `$${++idx}`)
  return { text, values: params }
}

export async function rawAll<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const db = getDb() as any
  const { text, values } = toPg(sql, params)
  const result = await db.$client.query(text, values)
  return result.rows
}

export async function rawGet<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await rawAll<T>(sql, params)
  return rows[0] ?? null
}

export async function rawRun(sql: string, params?: any[]): Promise<{ rowCount: number }> {
  const db = getDb() as any
  const { text, values } = toPg(sql, params)
  const result = await db.$client.query(text, values)
  return { rowCount: result.rowCount ?? 0 }
}

/** Execute a raw query on a dedicated client (for use within transactions) */
async function rawOnClient(client: PoolClient, sql: string, params?: any[]) {
  const { text, values } = toPg(sql, params)
  const result = await client.query(text, values)
  return result.rows
}

/** Execute a transaction with a dedicated client from the pool.
 *  All queries inside `fn` must use the provided `query` helper to stay on the same connection. */
export async function withTransaction<T>(
  fn: (query: (sql: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  const pool = (getDb() as any).$client as import('pg').Pool
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((sql, params) => rawOnClient(client, sql, params))
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
