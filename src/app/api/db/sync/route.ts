import { NextResponse } from 'next/server'
import { checkAndSyncDb } from '@/db/auto-sync'

export async function POST() {
  try {
    const result = await checkAndSyncDb({ repair: true, silent: true })
    return NextResponse.json({
      ok: result.check.ok,
      check: {
        ok: result.check.ok,
        missingTables: result.check.missingTables.map(t => ({ tableName: t.tableName })),
        missingColumns: result.check.missingColumns.map(mc => ({ table: mc.table, columns: mc.columns.map(c => ({ name: c.name })) })),
      },
      sync: {
        success: result.sync.success,
        tablesCreated: result.sync.tablesCreated,
        columnsAdded: result.sync.columnsAdded,
        errors: result.sync.errors,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
