import { NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'

async function ensureHeaderColumns(table: string, colsToEnsure: { name: string; ddl: string }[]) {
  const cols = (await rawAll<any>(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`)).map((c:any) => String(c.column_name).toLowerCase())
  for (const c of colsToEnsure) {
    const name = c.name.toLowerCase()
    if (!cols.includes(name)) {
      await rawRun(`ALTER TABLE ${table} ADD COLUMN ${c.ddl}`)
    }
  }
}

async function backfillDetailFk(detailTable: string, standardCol: string, candidates: string[]) {
  const cols = (await rawAll<any>(`SELECT column_name FROM information_schema.columns WHERE table_name = '${detailTable}'`)).map((c:any) => String(c.column_name).toLowerCase())
  if (!cols.includes(standardCol.toLowerCase())) {
    await rawRun(`ALTER TABLE ${detailTable} ADD COLUMN ${standardCol} INTEGER`)
  }
  const source = candidates.find(c => cols.includes(c.toLowerCase()))
  if (source && source.toLowerCase() !== standardCol.toLowerCase()) {
    await rawRun(`UPDATE ${detailTable} SET ${standardCol} = ${source} WHERE ${standardCol} IS NULL`)
  }
  try { await rawRun(`CREATE INDEX IF NOT EXISTS idx_${detailTable}_hdr ON ${detailTable}(${standardCol})`) } catch {}
}

export async function POST() {
  try {
    await rawRun(`CREATE TABLE IF NOT EXISTS ar_advances (
      id SERIAL PRIMARY KEY,
      kode_nota TEXT,
      tanggal TEXT,
      customer_id INTEGER
    )`)
    await rawRun(`CREATE TABLE IF NOT EXISTS ar_advance_lines (
      id SERIAL PRIMARY KEY
    )`)
    await rawRun(`CREATE TABLE IF NOT EXISTS ap_advances (
      id SERIAL PRIMARY KEY,
      kode_nota TEXT,
      tanggal TEXT,
      supplier_id INTEGER
    )`)
    await rawRun(`CREATE TABLE IF NOT EXISTS ap_advance_lines (
      id SERIAL PRIMARY KEY
    )`)

    await ensureHeaderColumns('ar_advances', [
      { name: 'notes', ddl: "notes TEXT DEFAULT ''" },
      { name: 'total_amount', ddl: 'total_amount REAL NOT NULL DEFAULT 0' },
      { name: 'period_id', ddl: 'period_id INTEGER NOT NULL DEFAULT 1' },
      { name: 'status', ddl: "status TEXT NOT NULL DEFAULT 'active'" },
      { name: 'created_at', ddl: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', ddl: 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
      { name: 'kode_nota', ddl: 'kode_nota TEXT' },
    ])
    await ensureHeaderColumns('ap_advances', [
      { name: 'notes', ddl: "notes TEXT DEFAULT ''" },
      { name: 'total_amount', ddl: 'total_amount REAL NOT NULL DEFAULT 0' },
      { name: 'period_id', ddl: 'period_id INTEGER NOT NULL DEFAULT 1' },
      { name: 'status', ddl: "status TEXT NOT NULL DEFAULT 'active'" },
      { name: 'created_at', ddl: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', ddl: 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' },
      { name: 'kode_nota', ddl: 'kode_nota TEXT' },
    ])

    await backfillDetailFk('ar_advance_lines', 'ar_advance_id', ['ar_advance_id','advance_id','header_id','parent_id','arid'])
    await backfillDetailFk('ap_advance_lines', 'ap_advance_id', ['ap_advance_id','advance_id','header_id','parent_id','apid'])

    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ar_adv_tanggal ON ar_advances(tanggal)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ar_adv_customer ON ar_advances(customer_id)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ap_adv_tanggal ON ap_advances(tanggal)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ap_adv_supplier ON ap_advances(supplier_id)') } catch {}

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Migration failed' }, { status: 500 })
  }
}
