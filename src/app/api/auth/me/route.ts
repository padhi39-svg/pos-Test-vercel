import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterUsers, masterLevelManager, levelPermissions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getUserBySessionToken } from '@/lib/auth'
import { SYSTEM_MENUS, DEFAULT_PERMISSIONS } from '@/lib/menus'
import { cookies } from 'next/headers'
import { getAllowBackdate } from '@/lib/settingsHelper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    const token = cookies().get('session_token')?.value
    if (!token) return NextResponse.json({ user: null })
    const user = await getUserBySessionToken(pool, token)
    if (!user) return NextResponse.json({ user: null })
    // Ambil level & permissions
    let level_id: number | null = null
    try {
      const rowArr = await db.select({ id: masterUsers.id, levelId: masterUsers.levelId })
        .from(masterUsers)
        .where(eq(masterUsers.id, user.id))
      const row = rowArr[0] as { id: number; levelId: number | null } | undefined
      level_id = row?.levelId ?? null
    } catch {}
    let permissions: any[] = []
    let dynamicPermissions: any[] = []
    let levelCode: string | null = null
    if (level_id) {
      try {
        // Deteksi struktur tabel level_permissions
        const colResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'`)
        const colNames = new Set(colResult.rows.map((c: any) => String(c.column_name)))
        const hasPermissionCode = colNames.has('permission_code')
        const hasCanView = colNames.has('can_view')

        try {
          const rowArr = await db.select({ code: masterLevelManager.code })
            .from(masterLevelManager)
            .where(eq(masterLevelManager.id, level_id))
          const row = rowArr[0] as { code: string } | undefined
          levelCode = row?.code || null
        } catch {}

        if (hasPermissionCode) {
          dynamicPermissions = await db.select({
            menuCode: levelPermissions.menuCode,
            permissionCode: levelPermissions.permissionCode,
            allowed: levelPermissions.allowed,
          })
            .from(levelPermissions)
            .where(eq(levelPermissions.levelId, level_id)) as any[]
        }

        if (hasCanView) {
          permissions = await db.select({
            menu_code: levelPermissions.menuCode,
            can_view: sql<number>`can_view`,
            can_create: sql<number>`can_create`,
            can_edit: sql<number>`can_edit`,
            can_delete: sql<number>`can_delete`,
          })
            .from(levelPermissions)
            .where(eq(levelPermissions.levelId, level_id)) as any[]
        } else if (hasPermissionCode) {
          const map: Record<string, { menu_code: string; can_create: number; can_edit: number; can_view: number; can_delete: number }> = {}
          for (const row of dynamicPermissions) {
            const mc = String(row.menuCode || '')
            const pc = String(row.permissionCode || '').toUpperCase()
            const allowed = Number(row.allowed) === 1
            if (!mc) continue
            if (!map[mc]) {
              map[mc] = { menu_code: mc, can_create: 0, can_edit: 0, can_view: 0, can_delete: 0 }
            }
            if (!allowed) continue
            if (pc === 'VIEW') map[mc].can_view = 1
            if (pc === 'CREATE') map[mc].can_create = 1
            if (pc === 'EDIT') map[mc].can_edit = 1
            if (pc === 'DELETE') map[mc].can_delete = 1
          }
          permissions = Object.values(map)
        }
      } catch {}
    }

    // Build allowed paths dari permissions(can_view) dengan normalisasi kode menu
    const allowedMenuCodes = new Set(
      (permissions || [])
        .filter(p => Number(p.can_view) === 1)
        .map(p => String(p.menu_code || '').toLowerCase().trim())
    )
    const fromRegistryPaths = SYSTEM_MENUS
      .filter(m => allowedMenuCodes.has(String(m.code).toLowerCase().trim()))
      .map(m => m.path)
    // Fallback untuk kode legacy parent yang tidak ada di SYSTEM_MENUS
    const legacyMap: Record<string, string[]> = {
      reservasi: ['/reservasi/booking', '/lantai', '/meja'],
      stock: [
        '/stock',
        '/stock/transfer',
        '/stock/usage',
        '/stock/draftopname',
        '/stock/opname',
        '/gudang',
        '/ingredient',
        '/reports/usage',
        '/reports/sales-vs-usage',
      ],
      pos_resto: ['/pos/resto'],
      pos_resto_table: ['/pos/resto'],
      uang_muka_customer: ['/keuangan/uang-muka-customer'],
      uang_muka_supplier: ['/keuangan/uang-muka-supplier'],
      rekalkulasi: ['/rekalkulasi'],
      test_menu: ['/keuangan/test-menu'],
      payment_recap_ar: ['/reports/payment-recap-ar'],
      payment_detail_ar: ['/reports/payment-detail-ar'],
      payment_recap_ap: ['/reports/payment-recap-ap'],
      payment_detail_ap: ['/reports/payment-detail-ap'],
    }
    const legacyPaths: string[] = []
    for (const code of allowedMenuCodes) {
      const extras = legacyMap[code]
      if (extras) legacyPaths.push(...extras)
    }
    const safetyPaths = String(levelCode || '').toUpperCase() === 'ADMIN'
      ? ['/level-manager', '/users', '/settings']
      : []
    const allowedPaths = Array.from(new Set([...fromRegistryPaths, ...legacyPaths, ...safetyPaths]))
    const allowBackdate = await getAllowBackdate(pool)
    const backdatePermissions: Record<string, boolean> = {}
    for (const row of dynamicPermissions) {
      const pc = String(row.permissionCode ?? row.permission_code ?? '').toUpperCase()
      const mc = String(row.menuCode ?? row.menu_code ?? '')
      if (pc === 'BACKDATE') {
        backdatePermissions[mc] = Number(row.allowed) === 1
      }
    }
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, level_id, permissions, dynamicPermissions, allowedPaths }, allow_backdate: allowBackdate, backdate_permissions: backdatePermissions })
  } catch (e: any) {
    return NextResponse.json({ user: null, error: e?.message }, { status: 200 })
  }
}
