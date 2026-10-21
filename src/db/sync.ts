import { rawRun } from './raw'
import { checkSchema, generateCreateTable, generateAlterColumn, type SchemaDiff, type ColumnInfo, type TableSchema } from './check'

export interface SyncResult {
  success: boolean
  tablesCreated: number
  columnsAdded: number
  errors: string[]
  sqlExecuted: string[]
}

async function executeSql(sql: string): Promise<void> {
  await rawRun(sql)
}

export async function syncSchema(repair: boolean = true): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    tablesCreated: 0,
    columnsAdded: 0,
    errors: [],
    sqlExecuted: [],
  }

  let diff: SchemaDiff
  try {
    diff = await checkSchema()
    if (diff.errors.length > 0) {
      result.errors.push(...diff.errors)
    }
  } catch (e: any) {
    result.errors.push(`Gagal check schema: ${e.message}`)
    result.success = false
    return result
  }

  if (diff.ok) {
    return result
  }

  if (!repair) {
    result.success = false
    result.errors.push('repair=false, tidak ada perubahan yang diterapkan')
    return result
  }

  for (const table of diff.missingTables) {
    try {
      const sql = generateCreateTable(table)
      await executeSql(sql)
      result.sqlExecuted.push(sql)
      result.tablesCreated++
    } catch (e: any) {
      result.errors.push(`Gagal create table "${table.tableName}": ${e.message}`)
      result.success = false
    }
  }

  for (const mc of diff.missingColumns) {
    for (const col of mc.columns) {
      try {
        const sql = generateAlterColumn(mc.table, col)
        await executeSql(sql)
        result.sqlExecuted.push(sql)
        result.columnsAdded++
      } catch (e: any) {
        result.errors.push(`Gagal add column "${mc.table}"."${col.name}": ${e.message}`)
        result.success = false
      }
    }
  }

  return result
}

export async function checkAndSync(): Promise<{ check: SchemaDiff; sync: SyncResult }> {
  let diff: SchemaDiff

  try {
    diff = await checkSchema()
  } catch (e: any) {
    throw new Error(`Check schema gagal: ${e.message}`)
  }

  if (diff.ok) {
    return { check: diff, sync: { success: true, tablesCreated: 0, columnsAdded: 0, errors: [], sqlExecuted: [] } }
  }

  const syncResult = await syncSchema(true)
  return { check: diff, sync: syncResult }
}
