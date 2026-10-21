import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client

    const tableInfo = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'"
    )
    const hasOldFormat = tableInfo.some((col: any) => col.column_name === 'can_view')

    if (!hasOldFormat) {
      return NextResponse.json({ message: 'Already using new format, no migration needed' })
    }

    const oldPerms = await rawAll<any>(
      'SELECT level_id, menu_code, can_create, can_edit, can_view, can_delete FROM level_permissions'
    )

    await pool.query('BEGIN')
    try {
      await rawRun('ALTER TABLE level_permissions RENAME TO level_permissions_old')

      await rawRun(`
        CREATE TABLE level_permissions (
          id SERIAL PRIMARY KEY,
          level_id INTEGER NOT NULL,
          menu_code TEXT NOT NULL,
          permission_code TEXT NOT NULL,
          allowed INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(level_id, menu_code, permission_code)
        )
      `)

      let migrated = 0
      for (const p of oldPerms) {
        if (p.can_view) { await pool.query('INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed) VALUES ($1,$2,$3,1)', [p.level_id, p.menu_code, 'VIEW']); migrated++ }
        if (p.can_create) { await pool.query('INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed) VALUES ($1,$2,$3,1)', [p.level_id, p.menu_code, 'CREATE']); migrated++ }
        if (p.can_edit) { await pool.query('INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed) VALUES ($1,$2,$3,1)', [p.level_id, p.menu_code, 'EDIT']); migrated++ }
        if (p.can_delete) { await pool.query('INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed) VALUES ($1,$2,$3,1)', [p.level_id, p.menu_code, 'DELETE']); migrated++ }
      }

      await rawRun('DROP TABLE level_permissions_old')
      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Migrated ${oldPerms.length} permission records to ${migrated} new format records`
      })
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Migration failed', details: e.message }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  try {
    const tableInfo = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'level_permissions'"
    )
    const columns = tableInfo.map((col: any) => col.column_name)

    const hasOldFormat = columns.includes('can_view')
    const hasNewFormat = columns.includes('permission_code')

    return NextResponse.json({
      columns,
      format: hasNewFormat ? 'new' : (hasOldFormat ? 'old' : 'unknown'),
      needsMigration: hasOldFormat && !hasNewFormat
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Check failed', details: e.message }, { status: 500 })
  }
}
