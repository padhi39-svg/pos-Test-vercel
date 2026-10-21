import { NextRequest } from 'next/server'
import { Pool } from 'pg'
import { getDb } from '@/db'
import { rawAll } from '@/db/raw'
import { getUserBySessionToken } from '@/lib/auth'

export async function getAllowedJenisByUserId(userId: number): Promise<number[]> {
  try {
    const rows = await rawAll<any>(`SELECT jenis FROM user_barang_jenis WHERE user_id = ?`, [userId])
    if (!rows || rows.length === 0) return [1, 2, 3]
    const set = new Set<number>()
    for (const r of rows) {
      const j = Number(r.jenis)
      if (!Number.isNaN(j)) set.add(j)
    }
    return Array.from(set)
  } catch {
    return [1, 2, 3]
  }
}

export async function getAllowedJenisForRequest(req: NextRequest): Promise<number[]> {
  try {
    const db = getDb()
    const pool = (db as any).$client as Pool
    const token = (req as any)?.cookies?.get?.('session_token')?.value
    if (!token) return [1, 2, 3]
    const user = await getUserBySessionToken(pool, token)
    if (!user?.id) return [1, 2, 3]
    return await getAllowedJenisByUserId(Number(user.id))
  } catch {
    return [1, 2, 3]
  }
}
