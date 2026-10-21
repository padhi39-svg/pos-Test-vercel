import { NextResponse } from 'next/server'
import { checkSchema, formatDiff } from '@/db/check'

export async function GET() {
  try {
    const diff = await checkSchema()
    return NextResponse.json({
      ok: diff.ok,
      check: {
        ok: diff.ok,
        missingTables: diff.missingTables.map(t => ({ tableName: t.tableName, columns: t.columns.map(c => ({ name: c.name, columnType: c.columnType })) })),
        missingColumns: diff.missingColumns.map(mc => ({ table: mc.table, columns: mc.columns.map(c => ({ name: c.name, columnType: c.columnType })) })),
        extraTables: diff.extraTables,
        errors: diff.errors,
        summary: formatDiff(diff),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
