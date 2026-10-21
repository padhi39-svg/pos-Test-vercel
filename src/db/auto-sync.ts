import { getDb } from './index'
import { checkSchema, formatDiff, type SchemaDiff } from './check'
import { syncSchema, type SyncResult } from './sync'

let syncRan = false

export async function checkAndSyncDb(options?: { repair?: boolean; silent?: boolean }): Promise<{
  check: SchemaDiff
  sync: SyncResult
}> {
  const repair = options?.repair ?? true
  const silent = options?.silent ?? false

  getDb()

  const diff = await checkSchema()

  if (!silent) {
    console.log(formatDiff(diff))
  }

  let sync: SyncResult = {
    success: true, tablesCreated: 0, columnsAdded: 0, errors: [], sqlExecuted: [],
  }

  if (!diff.ok && repair) {
    sync = await syncSchema(true)

    if (sync.tablesCreated > 0 || sync.columnsAdded > 0) {
      if (!silent) {
        console.log(`\nAuto-sync: ${sync.tablesCreated} table(s) created, ${sync.columnsAdded} column(s) added`)
        if (sync.errors.length > 0) {
          console.log(`Sync errors: ${sync.errors.join(', ')}`)
        }
      }
    }

    if (sync.tablesCreated > 0 || sync.columnsAdded > 0) {
      const recheck = await checkSchema()
      if (!silent) {
        console.log(`\nRe-check setelah sync: ${recheck.ok ? 'OK' : 'Masih ada perbedaan'}`)
        if (!recheck.ok) {
          console.log(formatDiff(recheck))
        }
      }
    }
  }

  syncRan = true
  return { check: diff, sync }
}

export function isSyncRan(): boolean {
  return syncRan
}
