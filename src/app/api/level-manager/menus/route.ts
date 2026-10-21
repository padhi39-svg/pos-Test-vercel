import { NextRequest, NextResponse } from 'next/server'
import { SYSTEM_MENUS, DEFAULT_PERMISSIONS, MENU_GROUPS } from '@/lib/menus'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Skip permission check for now to allow initial setup
    // if (!hasPermission(req as any, 'level_manager', 'view')) {
    //   return NextResponse.json({ error: 'Forbidden: tidak punya akses level manager' }, { status: 403 })
    // }
    // Return menus with their available permissions and groups
    return NextResponse.json({
      menus: SYSTEM_MENUS,
      permissions: DEFAULT_PERMISSIONS,
      groups: MENU_GROUPS,
    })
  } catch (e: any) {
    console.error('GET /api/level-manager/menus error:', e)
    return NextResponse.json({ error: 'Failed to load menus', details: e.message }, { status: 500 })
  }
}
