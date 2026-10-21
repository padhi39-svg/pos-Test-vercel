import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { settings as settingsTable } from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'
import { hasPermission } from '@/lib/permissions'

const GROUP = 'faktur_pajak'

const DEFAULTS = {
  faktur_pajak_prefix: '010.000-24.',
  faktur_pajak_next_number: '1',
  faktur_pajak_padding: '5',
}

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'setting_nomor_faktur', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getDb()
    const rows = await db.select({
      settingKey: settingsTable.settingKey,
      settingValue: settingsTable.settingValue,
    })
      .from(settingsTable)
      .where(eq(settingsTable.settingGroup, GROUP))
      .orderBy(asc(settingsTable.settingKey))

    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.settingKey] = r.settingValue || ''
    }
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (!(k in map)) map[k] = v
    }
    return NextResponse.json(map)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'setting_nomor_faktur', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const { settings } = body
    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ error: 'Settings array required' }, { status: 400 })
    }
    const db = getDb()
    let updated = 0
    let inserted = 0
    await db.transaction(async (tx) => {
      for (const s of settings) {
        const r = await tx.update(settingsTable)
          .set({ settingValue: String(s.value), updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(settingsTable.settingKey, s.key))
        if (r.rowCount === 0) {
          await tx.insert(settingsTable).values({
            settingKey: s.key,
            settingValue: String(s.value),
            settingGroup: GROUP,
            createdAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          inserted += 1
        } else {
          updated += 1
        }
      }
    })
    return NextResponse.json({ success: true, message: `Updated ${updated}, inserted ${inserted}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
