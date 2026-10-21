import { NextRequest } from 'next/server'
import { Pool } from 'pg'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { getUserBySessionToken } from '@/lib/auth'

export type PermAction = 'create' | 'edit' | 'view' | 'delete' | 'export' | 'import' | 'approve' | 'print' | 'edit_price' | 'backdate' | 'qty_minus'

export async function hasPermission(req: NextRequest, menuCode: string, action: PermAction): Promise<boolean> {
  // Promo/media landing & settings diakses publik (tanpa login), sejajar dengan halaman /promo
  if (menuCode === 'promo_settings') return true
  try {
    const db = getDb()
    const pool = (db as any).$client as Pool
    const token = (req as any)?.cookies?.get?.('session_token')?.value
    if (!token) return false
    const user = await getUserBySessionToken(pool, token)
    if (!user) return false
    const row = await rawGet<any>(`SELECT level_id FROM master_users WHERE id = ?`, [user.id])
    const levelId = Number(row?.level_id || 0)
    if (!levelId) return false

    try {
      const levelRow = await rawGet<any>(`SELECT code FROM master_level_manager WHERE id = ?`, [levelId])
      if (String(levelRow?.code || '').toUpperCase() === 'ADMIN') return true
    } catch {}

    const tableInfo = await rawAll<any>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'level_permissions'`
    )
    const colNames = tableInfo.map(c => String(c.column_name).toLowerCase())
    const hasNewFormat = colNames.includes('permission_code')

    if (hasNewFormat) {
      const permCode = action.toUpperCase()
      const p = await rawGet<any>(`
        SELECT allowed
        FROM level_permissions
        WHERE level_id = ? AND menu_code = ? AND permission_code = ?
        LIMIT 1
      `, [levelId, String(menuCode), permCode])
      return p ? Number(p.allowed) === 1 : false
    } else {
      const p = await rawGet<any>(`
        SELECT can_create, can_edit, can_view, can_delete
        FROM level_permissions
        WHERE level_id = ? AND menu_code = ?
        LIMIT 1
      `, [levelId, String(menuCode)])
      if (!p) return false
      if (action === 'create') return Number(p.can_create) === 1
      if (action === 'edit') return Number(p.can_edit) === 1
      if (action === 'delete') return Number(p.can_delete) === 1
      return Number(p.can_view) === 1
    }
  } catch {
    return false
  }
}
