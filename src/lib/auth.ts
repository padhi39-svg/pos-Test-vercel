import { cookies } from 'next/headers'
import { Pool } from 'pg'
import crypto from 'crypto'

export function verifyPasswordHash(stored: string | null | undefined, password: string): boolean {
  if (!stored) return false
  const [algo, salt, hash] = stored.split(':')
  if (algo !== 'sha256' || !salt || !hash) return false
  const test = crypto.createHash('sha256').update(salt + password).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash))
}

export async function ensureSessionTable(pool: Pool) {
  if ((globalThis as any).__sessionTableEnsured) return
  ;(globalThis as any).__sessionTableEnsured = true
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ
    );
  `)
  try { await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`) } catch {}
}

export async function createSession(pool: Pool, userId: number, ttlHours = 24) {
  await ensureSessionTable(pool)
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString()
  await pool.query(`INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`, [userId, token, expires])
  return { token, expires }
}

export async function deleteSessionByToken(pool: Pool, token: string) {
  await ensureSessionTable(pool)
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token])
}

export async function getUserBySessionToken(pool: Pool, token: string) {
  const result = await pool.query(`
    SELECT u.*
    FROM sessions s
    JOIN master_users u ON u.id = s.user_id
    LEFT JOIN settings st ON st.setting_key = 'auth_session_ttl_hours'
    WHERE s.token = $1
      AND u.isdelete = 0
      AND (s.expires_at IS NULL OR s.expires_at::timestamptz > CURRENT_TIMESTAMP)
      AND (
        st.setting_value IS NULL
        OR st.setting_value = ''
        OR CASE
            WHEN st.setting_value ~ '^[0-9]+$' AND st.setting_value::int > 0
            THEN s.created_at::timestamptz + (st.setting_value::int * interval '1 hour') > CURRENT_TIMESTAMP
            ELSE true
          END
      )
    LIMIT 1
  `, [token])
  return result.rows[0] || null
}

export async function getCurrentUserServer() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null
    const { getDb } = await import('@/db')
    const db = getDb()
    const pool = (db as any).$client as Pool
    return await getUserBySessionToken(pool, token)
  } catch {
    return null
  }
}
