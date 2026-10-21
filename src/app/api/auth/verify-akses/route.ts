import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterUsers, levelPermissions, masterLevelManager } from '@/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { verifyPasswordHash } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const body = await req.json().catch(() => ({})) as any
    const email = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '')
    const menuCode = String(body.menuCode || '').trim()
    const action = String(body.action || '').trim()

    if (!email || !password || !menuCode || !action) {
      return NextResponse.json({ success: false, message: 'Semua field wajib diisi' }, { status: 400 })
    }

    const validActions = ['edit', 'void', 'print']
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 })
    }

    const actionMap: Record<string, string> = {
      edit: 'can_edit',
      void: 'can_delete',
      print: 'can_print',
    }
    const permissionField = actionMap[action]

    const users = await db.select().from(masterUsers)
      .where(and(
        eq(masterUsers.email, email),
        eq(masterUsers.isdelete, 0),
        eq(masterUsers.aktif, 1),
      ))
      .limit(1)

    const supervisor = users[0] as any
    if (!supervisor) {
      return NextResponse.json({ success: false, message: 'User tidak terdaftar' }, { status: 200 })
    }

    const ok = verifyPasswordHash(supervisor.passwordHash, password)
    if (!ok) {
      return NextResponse.json({ success: false, message: 'Password salah' }, { status: 200 })
    }

    let hasPermission = false
    const levelId = supervisor.levelId
    if (levelId) {
      try {
        const colResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'`)
        const colNames = new Set(colResult.rows.map((c: any) => String(c.column_name)))
        const hasPermissionCode = colNames.has('permission_code')
        const hasCanView = colNames.has('can_view')

        if (hasCanView) {
          const perms = await db.select({
            value: sql<number>`${sql.raw(permissionField)}`,
          })
            .from(levelPermissions)
            .where(and(
              eq(levelPermissions.levelId, levelId),
              eq(levelPermissions.menuCode, menuCode),
            )) as any[]
          hasPermission = perms.length > 0 && Number(perms[0]?.value) === 1
        } else if (hasPermissionCode) {
          const pcMap: Record<string, string> = {
            edit: 'EDIT',
            void: 'DELETE',
            print: 'EDIT',
          }
          const dynPerms = await db.select({
            allowed: levelPermissions.allowed,
          })
            .from(levelPermissions)
            .where(and(
              eq(levelPermissions.levelId, levelId),
              eq(levelPermissions.menuCode, menuCode),
              eq(levelPermissions.permissionCode, pcMap[action]),
            )) as any[]
          hasPermission = dynPerms.length > 0 && Number(dynPerms[0]?.allowed) === 1
        }
      } catch {}
    }

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: `User tidak memiliki akses ${action} untuk menu ini` }, { status: 200 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Terjadi kesalahan' }, { status: 500 })
  }
}
