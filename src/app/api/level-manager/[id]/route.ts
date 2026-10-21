import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    const level = await rawGet<any>('SELECT id, code, name, isdelete, created_at, updated_at FROM master_level_manager WHERE id = $1', [id])
    if (!level) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const tableInfo = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'"
    )
    const hasNewFormat = tableInfo.some((col: any) => col.column_name === 'permission_code')

    let permList: { menu_code: string; permission_code: string; allowed: boolean }[] = []

    if (hasNewFormat) {
      const permissions = await rawAll<any>(
        'SELECT menu_code, permission_code, allowed FROM level_permissions WHERE level_id = $1 ORDER BY menu_code, permission_code',
        [id]
      )
      permList = permissions.map(p => ({
        menu_code: p.menu_code,
        permission_code: p.permission_code,
        allowed: Number(p.allowed) === 1
      }))
    } else {
      const permissions = await rawAll<any>(
        'SELECT menu_code, can_create, can_edit, can_view, can_delete FROM level_permissions WHERE level_id = $1 ORDER BY menu_code',
        [id]
      )
      for (const p of permissions) {
        permList.push({ menu_code: p.menu_code, permission_code: 'VIEW', allowed: Number(p.can_view) === 1 })
        permList.push({ menu_code: p.menu_code, permission_code: 'CREATE', allowed: Number(p.can_create) === 1 })
        permList.push({ menu_code: p.menu_code, permission_code: 'EDIT', allowed: Number(p.can_edit) === 1 })
        permList.push({ menu_code: p.menu_code, permission_code: 'DELETE', allowed: Number(p.can_delete) === 1 })
      }
    }

    return NextResponse.json({ ...level, permissions: permList })
  } catch (e: any) {
    console.error('GET /api/level-manager/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch', details: e.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const id = Number(params.id)
    const body = await request.json()
    const name = String(body.name || '').trim()
    const permissions = Array.isArray(body.permissions) ? body.permissions : []

    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    await rawRun('UPDATE master_level_manager SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [name, id])

    const tableInfo = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'"
    )
    const hasNewFormat = tableInfo.some((col: any) => col.column_name === 'permission_code')

    await pool.query('BEGIN')
    try {
      await pool.query('DELETE FROM level_permissions WHERE level_id = $1', [id])

      if (hasNewFormat) {
        for (const p of permissions) {
          await pool.query(
            'INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed) VALUES ($1, $2, $3, $4)',
            [id, String(p.menu_code || ''), String(p.permission_code || ''), p.allowed ? 1 : 0]
          )
        }
      } else {
        const menuPerms: Record<string, { can_view: number; can_create: number; can_edit: number; can_delete: number }> = {}
        for (const p of permissions) {
          const mc = String(p.menu_code || '')
          if (!mc) continue
          if (!menuPerms[mc]) menuPerms[mc] = { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0 }
          const pc = String(p.permission_code || '').toUpperCase()
          if (pc === 'VIEW') menuPerms[mc].can_view = p.allowed ? 1 : 0
          if (pc === 'CREATE') menuPerms[mc].can_create = p.allowed ? 1 : 0
          if (pc === 'EDIT') menuPerms[mc].can_edit = p.allowed ? 1 : 0
          if (pc === 'DELETE') menuPerms[mc].can_delete = p.allowed ? 1 : 0
        }
        for (const [mc, perms] of Object.entries(menuPerms)) {
          await pool.query(
            'INSERT INTO level_permissions (level_id, menu_code, can_create, can_edit, can_view, can_delete) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, mc, perms.can_create, perms.can_edit, perms.can_view, perms.can_delete]
          )
        }
      }

      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('PUT /api/level-manager/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update', details: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    const userEdit = getUserId(_req)
    await rawRun('UPDATE master_level_manager SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = $1 WHERE id = $2', [userEdit, id])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to delete', details: e.message }, { status: 500 })
  }
}
