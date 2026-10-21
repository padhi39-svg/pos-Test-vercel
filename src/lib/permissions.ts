import { NextRequest } from 'next/server'
import { Pool } from 'pg'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { getUserBySessionToken } from '@/lib/auth'

export type PermAction = 'create' | 'edit' | 'view' | 'delete' | 'export' | 'import' | 'approve' | 'print' | 'edit_price' | 'backdate' | 'qty_minus'

const PERM_TTL_MS = 60_000
const permCache = new Map<string, { v: boolean; exp: number }>()
let levelPermFormat: boolean | null = null

function cacheGet(key: string): boolean | undefined {
  const hit = permCache.get(key)
  if (!hit) return undefined
  if (hit.exp < Date.now()) {
    permCache.delete(key)
    return undefined
  }
  return hit.v
}

function cacheSet(key: string, v: boolean) {
  if (permCache.size > 1000) permCache.clear()
  permCache.set(key, { v, exp: Date.now() + PERM_TTL_MS })
}

export async function hasPermission(req: NextRequest, menuCode: string, action: PermAction): Promise<boolean> {
  // Promo/media landing & settings diakses publik (tanpa login), sejajar dengan halaman /promo
  if (menuCode === 'promo_settings') return true
  try {
    const db = getDb()
    const pool = (db as any).$client as Pool
    const token = (req as any)?.cookies?.get?.('session_token')?.value
    if (!token) return false

    const cacheKey = `${token}|${menuCode}|${action}`
    const cached = cacheGet(cacheKey)
    if (cached !== undefined) return cached

    const user = await getUserBySessionToken(pool, token)
    if (!user) {
      cacheSet(cacheKey, false)
      return false
    }

    const levelId = Number((user as any).level_id || 0)
    if (!levelId) {
      cacheSet(cacheKey, false)
      return false
    }

    try {
      const levelRow = await rawGet<any>(`SELECT code FROM master_level_manager WHERE id = ?`, [levelId])
      if (String(levelRow?.code || '').toUpperCase() === 'ADMIN') {
        cacheSet(cacheKey, true)
        return true
      }
    } catch {}

    if (levelPermFormat === null) {
      const tableInfo = await rawAll<any>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'level_permissions'`
      )
      const colNames = tableInfo.map(c => String(c.column_name).toLowerCase())
      levelPermFormat = colNames.includes('permission_code')
    }

    let allowed = false
    if (levelPermFormat) {
      const permCode = action.toUpperCase()
      const p = await rawGet<any>(`
        SELECT allowed
        FROM level_permissions
        WHERE level_id = ? AND menu_code = ? AND permission_code = ?
        LIMIT 1
      `, [levelId, String(menuCode), permCode])
      allowed = p ? Number(p.allowed) === 1 : false
    } else {
      const p = await rawGet<any>(`
        SELECT can_create, can_edit, can_view, can_delete
        FROM level_permissions
        WHERE level_id = ? AND menu_code = ?
        LIMIT 1
      `, [levelId, String(menuCode)])
      if (!p) allowed = false
      else if (action === 'create') allowed = Number(p.can_create) === 1
      else if (action === 'edit') allowed = Number(p.can_edit) === 1
      else if (action === 'delete') allowed = Number(p.can_delete) === 1
      else allowed = Number(p.can_view) === 1
    }

    cacheSet(cacheKey, allowed)
    return allowed
  } catch {
    return false
  }
}
