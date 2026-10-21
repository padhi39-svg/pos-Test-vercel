import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function runMigration() {
  const db = getDb()
  const messages: string[] = []

  const hasCol = (cols:any[], name:string)=> cols.some((c:any)=> String(c.name).toLowerCase()===name)
  const ensurePeriodCol = async (table: string) => {
    try {
      const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?`, [table])
      if (!hasCol(cols, 'period_id')) {
        await rawRun(`ALTER TABLE ${table} ADD COLUMN period_id INTEGER`)
        messages.push(`✓ Added ${table}.period_id`)
      } else {
        messages.push(`• ${table}.period_id already exists`)
      }
    } catch (e:any) {
      messages.push(`! Failed ensuring ${table}.period_id: ${e?.message}`)
    }
  }

  try {
    // Ensure period_id columns
    for (const t of ['stock_opname','stock_usage','stock_transfers','stock_movements']) {
      await ensurePeriodCol(t)
    }

    // Ensure user_void columns on transaction tables
    const addUserVoid = async (table:string)=>{
      try{
        const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?`, [table])
        if (!hasCol(cols,'user_void')){
          await rawRun(`ALTER TABLE ${table} ADD COLUMN user_void INTEGER`)
          messages.push(`✓ Added ${table}.user_void`)
        } else {
          messages.push(`• ${table}.user_void already exists`)
        }
      }catch(e:any){ messages.push(`! Failed ensuring ${table}.user_void: ${e?.message}`) }
    }
    for (const t of ['transactions','stock_opname','stock_transfers','stock_usage']) {
      await addUserVoid(t)
    }

    // Backfill headers by tdate
    const headerTables: Array<{table:string, dateCol:string}> = [
      { table: 'stock_opname', dateCol: 'tdate' },
      { table: 'stock_usage', dateCol: 'tdate' },
      { table: 'stock_transfers', dateCol: 'tdate' },
    ]
    for (const { table, dateCol } of headerTables) {
      try {
        const rows = await rawAll<any[]>(`SELECT id, ${dateCol} as tdate FROM ${table} WHERE period_id IS NULL OR period_id = 0`)
        let cnt = 0
        for (const r of rows) {
          const dt = String(r.tdate||'').slice(0,10)
          if (!dt) continue
          const p = await rawGet<{id: number}>('SELECT id FROM master_periode WHERE date(?) BETWEEN date(COALESCE(start_date,\'0001-01-01\')) AND date(COALESCE(end_date,\'9999-12-31\')) AND (isdelete IS NULL OR COALESCE(isdelete, 0) = 0) ORDER BY id DESC LIMIT 1', [dt])
          const pid = p?.id ? Number(p.id) : null
          await rawRun(`UPDATE ${table} SET period_id=? WHERE id=?`, [pid, r.id])
          cnt++
        }
        messages.push(`✓ Backfilled ${table}.period_id for ${cnt} rows`)
      } catch (e:any) {
        messages.push(`! Failed backfilling ${table}.period_id: ${e?.message}`)
      }
    }

    // Backfill stock_movements by movement_date
    try {
      const rows = await rawAll<any[]>('SELECT id, movement_date FROM stock_movements WHERE period_id IS NULL OR period_id = 0')
      let cnt = 0
      for (const r of rows) {
        const dt = String(r.movement_date||'').slice(0,10)
        if (!dt) continue
        const p = await rawGet<{id: number}>('SELECT id FROM master_periode WHERE date(?) BETWEEN date(COALESCE(start_date,\'0001-01-01\')) AND date(COALESCE(end_date,\'9999-12-31\')) AND (isdelete IS NULL OR COALESCE(isdelete, 0) = 0) ORDER BY id DESC LIMIT 1', [dt])
        const pid = p?.id ? Number(p.id) : null
        await rawRun('UPDATE stock_movements SET period_id=? WHERE id=?', [pid, r.id])
        cnt++
      }
      messages.push(`✓ Backfilled stock_movements.period_id for ${cnt} rows`)
    } catch (e:any) {
      messages.push(`! Failed backfilling stock_movements.period_id: ${e?.message}`)
    }

    // Indexes (optional)
    try {
      await rawRun(`
        CREATE INDEX IF NOT EXISTS idx_stock_opname_period ON stock_opname(period_id);
        CREATE INDEX IF NOT EXISTS idx_stock_usage_period ON stock_usage(period_id);
        CREATE INDEX IF NOT EXISTS idx_stock_transfers_period ON stock_transfers(period_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_period ON stock_movements(period_id);
      `)
      messages.push('✓ Created period_id indexes (if not exist)')
    } catch (e:any) {
      messages.push(`! Failed creating indexes: ${e?.message}`)
    }

    return { ok: true, messages }
  } catch (e:any) {
    return { ok: false, error: e?.message||'Migration failed', messages }
  }
}

export async function POST(_req: NextRequest) {
  const result = await runMigration()
  const status = result.ok ? 200 : 500
  return NextResponse.json(result, { status })
}

export async function GET(_req: NextRequest) {
  const result = await runMigration()
  const status = result.ok ? 200 : 500
  return NextResponse.json(result, { status })
}
