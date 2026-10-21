import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const rows = await rawAll<any>(
      `SELECT lm.id, lm.code, lm.name,
              (SELECT COUNT(*) FROM level_permissions lp WHERE lp.level_id = lm.id) as permissions_count,
              lm.created_at, lm.updated_at
       FROM master_level_manager lm
       WHERE lm.isdelete = 0
       ORDER BY lm.name`
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/level-manager error:', e)
    return NextResponse.json({ error: 'Failed to list levels', details: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const body = await request.json()
    const code = String(body.code || '').trim().toUpperCase()
    const name = String(body.name || '').trim()
    const permissions = Array.isArray(body.permissions) ? body.permissions : []

    if (!code || !name) {
      return NextResponse.json({ error: 'Kode dan Nama wajib diisi' }, { status: 400 })
    }

    const existing = await rawGet<any>('SELECT id FROM master_level_manager WHERE code = $1 AND isdelete = 0', [code])
    if (existing) {
      return NextResponse.json({ error: `Kode ${code} sudah digunakan` }, { status: 400 })
    }

    const tableInfo = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'"
    )
    const hasNewFormat = tableInfo.some((col: any) => col.column_name === 'permission_code')

    await pool.query('BEGIN')
    try {
      const r = await pool.query('INSERT INTO master_level_manager (code, name, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id', [code, name])
      const levelId = Number(r.rows[0].id)

      if (hasNewFormat) {
        for (const p of permissions) {
          await pool.query(
            `INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (level_id, menu_code, permission_code) DO UPDATE SET
               allowed = excluded.allowed, updated_at = CURRENT_TIMESTAMP`,
            [levelId, String(p.menu_code || ''), String(p.permission_code || ''), p.allowed ? 1 : 0]
          )
        }
      } else {
        const menuPerms: Record<string, { can_view: number; can_create: number; can_edit: number; can_delete: number }> = {}
        for (const p of permissions) {
          const mc = String(p.menu_code || '')
          if (!menuPerms[mc]) menuPerms[mc] = { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0 }
          const pc = String(p.permission_code || '').toUpperCase()
          if (pc === 'VIEW' && p.allowed) menuPerms[mc].can_view = 1
          if (pc === 'CREATE' && p.allowed) menuPerms[mc].can_create = 1
          if (pc === 'EDIT' && p.allowed) menuPerms[mc].can_edit = 1
          if (pc === 'DELETE' && p.allowed) menuPerms[mc].can_delete = 1
        }
        for (const [mc, perms] of Object.entries(menuPerms)) {
          await pool.query(
            `INSERT INTO level_permissions (level_id, menu_code, can_create, can_edit, can_view, can_delete)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (level_id, menu_code) DO UPDATE SET
               can_create = excluded.can_create, can_edit = excluded.can_edit,
               can_view = excluded.can_view, can_delete = excluded.can_delete,
               updated_at = CURRENT_TIMESTAMP`,
            [levelId, mc, perms.can_create, perms.can_edit, perms.can_view, perms.can_delete]
          )
        }
      }
      await pool.query('COMMIT')
      return NextResponse.json({ success: true, id: levelId })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e: any) {
    console.error('POST /api/level-manager error:', e)
    return NextResponse.json({ error: 'Failed to create level', details: e.message }, { status: 500 })
  }
}
