import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, types } from 'pg'
import * as schema from './schema'

// Force date type (OID 1082) to return as string 'YYYY-MM-DD',
// not as Date object which gets shifted by timezone on JSON serialize
types.setTypeParser(1082, (val: string) => val)

const POOL_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 3000,
  query_timeout: 30000,
  statement_timeout: 30000,
}

export function getDb() {
  const g = globalThis as any
  if (!g.__pgClient) {
    g.__pgPool = new Pool(POOL_CONFIG)
    g.__pgClient = drizzle(g.__pgPool, { schema })

    g.__pgPool.on('error', (err: Error) => {
      console.error('Unexpected error on idle database client', err)
    })

    console.log(`[DB] Pool initialized: max=${POOL_CONFIG.max}, idleTimeout=${POOL_CONFIG.idleTimeoutMillis}ms`)
  }
  return g.__pgClient as ReturnType<typeof drizzle<typeof schema>>
}
