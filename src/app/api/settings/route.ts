import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { settings as settingsTable, transactions } from '@/db/schema'
import { eq, or, like, asc, sql } from 'drizzle-orm'
import { hasPermission } from '@/lib/permissions'

/**
 * GET /api/settings?group=company
 * Get settings by group
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const group = searchParams.get('group')
    // Ijinkan GET group=company tanpa izin ketat agar data header nota bisa tampil di semua halaman
    const canSettings = hasPermission(request as any, 'settings', 'view')
    const canPosResto = hasPermission(request as any, 'pos_resto', 'view')
    const canPosRestoTable = hasPermission(request as any, 'pos_resto_table', 'view')
    const canSalesList = hasPermission(request as any, 'sales_list', 'view')
    const canTransaksi = hasPermission(request as any, 'transaksi', 'view')
    const hasAnyView = !!(canSettings || canPosResto || canPosRestoTable || canSalesList || canTransaksi)

    // Special case: allow limited design settings read for login page (unauthenticated)
    const limitedDesign = group === 'design' && !hasAnyView

    if (group !== 'company' && !limitedDesign) {
      if (!hasAnyView) {
        return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat pengaturan' }, { status: 403 })
      }
    }
    
    const db = getDb()
    
    let result
    if (group) {
      if (group === 'company') {
        result = await db.select({
          settingKey: settingsTable.settingKey,
          settingValue: settingsTable.settingValue,
          settingGroup: settingsTable.settingGroup,
          description: settingsTable.description,
        })
          .from(settingsTable)
          .where(
            or(
              eq(settingsTable.settingGroup, 'company'),
              like(settingsTable.settingKey, 'company_%')
            )
          )
          .orderBy(asc(settingsTable.settingKey))
      } else {
        result = await db.select({
          settingKey: settingsTable.settingKey,
          settingValue: settingsTable.settingValue,
          settingGroup: settingsTable.settingGroup,
          description: settingsTable.description,
        })
          .from(settingsTable)
          .where(eq(settingsTable.settingGroup, group))
          .orderBy(asc(settingsTable.settingKey))
      }
    } else {
      result = await db.select({
        settingKey: settingsTable.settingKey,
        settingValue: settingsTable.settingValue,
        settingGroup: settingsTable.settingGroup,
        description: settingsTable.description,
      })
        .from(settingsTable)
        .orderBy(asc(settingsTable.settingGroup), asc(settingsTable.settingKey))
    }

    if (Array.isArray(result)) {
      // Map camelCase Drizzle result → snake_case for frontend compatibility
      result = result.map((r: any) => ({
        setting_key: r.settingKey,
        setting_value: r.settingValue,
        setting_group: r.settingGroup,
        description: r.description,
      }))
      if (limitedDesign) {
        result = result.filter((r: any) => {
          const k = String(r?.setting_key || '')
          return k.startsWith('design_login_')
        })
      }
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Settings API] Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings
 * Update multiple settings at once
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings: settingsData } = body
    
    if (!settingsData || !Array.isArray(settingsData)) {
      return NextResponse.json(
        { error: 'Settings array is required' },
        { status: 400 }
      )
    }
    
    const db = getDb()

    // Permission: izinkan update khusus group 'company' tanpa hak 'settings:edit'. Group lain tetap butuh izin.
    const groupsInPayload = new Set<string>((settingsData || []).map((s: any) => s.group).filter(Boolean))
    const onlyCompany = groupsInPayload.size > 0 && [...groupsInPayload].every(g => g === 'company')
    if (!onlyCompany) {
      if (!hasPermission(request as any, 'settings', 'edit') && !hasPermission(request as any, 'transaksi', 'edit')) {
        return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah pengaturan' }, { status: 403 })
      }
    }

    // One-time lock: penjualan settings cannot change after first transaction exists
    if (groupsInPayload.has('penjualan')) {
      const cntArr = await db.select({ n: sql<number>`COUNT(1)::int` }).from(transactions)
      const cnt = cntArr[0]
      if (Number(cnt?.n || 0) > 0) {
        return NextResponse.json({
          error: 'Pengaturan penjualan terkunci karena sudah ada transaksi. Reset data diperlukan untuk mengubahnya.',
          code: 'SETTINGS_LOCKED'
        }, { status: 400 })
      }
    }

    let updated = 0
    let inserted = 0
    await db.transaction(async (tx) => {
      for (const setting of settingsData) {
        const r = await tx.update(settingsTable)
          .set({ settingValue: setting.value, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(settingsTable.settingKey, setting.key))
        if (r.rowCount === 0) {
          const group = setting.group || 'general'
          await tx.insert(settingsTable).values({
            settingKey: setting.key,
            settingValue: setting.value,
            settingGroup: group,
            createdAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          inserted += 1
        } else {
          if (setting.group) {
            await tx.update(settingsTable)
              .set({ settingGroup: setting.group, updatedAt: sql`CURRENT_TIMESTAMP` })
              .where(eq(settingsTable.settingKey, setting.key))
          }
          updated += 1
        }
      }
    })

    console.log(`[Settings API] Updated ${updated}, Inserted ${inserted}`)

    return NextResponse.json({
      success: true,
      message: `Updated ${updated}, inserted ${inserted}`
    })
  } catch (error: any) {
    console.error('[Settings API] Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    )
  }
}
