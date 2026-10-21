import { rawAll, rawGet, rawRun } from '@/db/raw'

let _schemaEnsured = false

export async function ensureTransactionSchema(pool?: any) {
  if (_schemaEnsured) return
  _schemaEnsured = true
  try {
    const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'")
    const names = new Set(cols.map(c => c.name))
    const mig: string[] = []
    if (!names.has('tgl_nota') && !names.has('Tgl_Nota')) mig.push('ALTER TABLE transactions ADD COLUMN tgl_nota TEXT')
    if (!names.has('price_include_tax')) mig.push('ALTER TABLE transactions ADD COLUMN price_include_tax INTEGER NOT NULL DEFAULT 0')
    if (!names.has('tax_rate_percent')) mig.push('ALTER TABLE transactions ADD COLUMN tax_rate_percent REAL NOT NULL DEFAULT 11')
    if (!names.has('ppn_percent')) mig.push('ALTER TABLE transactions ADD COLUMN ppn_percent REAL NOT NULL DEFAULT 0')
    if (!names.has('ppn_amount')) mig.push('ALTER TABLE transactions ADD COLUMN ppn_amount REAL NOT NULL DEFAULT 0')
    if (!names.has('transaction_type')) mig.push('ALTER TABLE transactions ADD COLUMN transaction_type INTEGER NOT NULL DEFAULT 1')
    if (!names.has('period_id')) mig.push('ALTER TABLE transactions ADD COLUMN period_id INTEGER')
    if (!names.has('bank_id')) mig.push('ALTER TABLE transactions ADD COLUMN bank_id INTEGER')
    if (!names.has('due_date')) mig.push('ALTER TABLE transactions ADD COLUMN due_date TEXT')
    if (!names.has('payment_terms')) mig.push('ALTER TABLE transactions ADD COLUMN payment_terms TEXT')
    if (!names.has('total_discount')) mig.push('ALTER TABLE transactions ADD COLUMN total_discount REAL DEFAULT 0')
    if (!names.has('notes')) mig.push('ALTER TABLE transactions ADD COLUMN notes TEXT')
    if (!names.has('service_charge_percent')) mig.push('ALTER TABLE transactions ADD COLUMN service_charge_percent REAL NOT NULL DEFAULT 0')
    if (!names.has('service_charge_amount')) mig.push('ALTER TABLE transactions ADD COLUMN service_charge_amount REAL NOT NULL DEFAULT 0')
    if (!names.has('warehouse_id')) mig.push('ALTER TABLE transactions ADD COLUMN warehouse_id INTEGER NOT NULL DEFAULT 1')
    if (!names.has('table_id')) mig.push('ALTER TABLE transactions ADD COLUMN table_id INTEGER')
    if (!names.has('resto_temp_id')) mig.push('ALTER TABLE transactions ADD COLUMN resto_temp_id INTEGER')
    if (!names.has('Nm_cust') && !names.has('nm_cust')) mig.push('ALTER TABLE transactions ADD COLUMN Nm_cust TEXT')
    if (!names.has('sales_id')) mig.push('ALTER TABLE transactions ADD COLUMN sales_id INTEGER')
    for (const sql of mig) { try { await rawRun(sql) } catch {} }
  } catch {}
  try {
    const colsIt = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transaction_items'")
    const namesIt = new Set(colsIt.map(c => String(c.name)))
    const migIt: string[] = []
    const colDefs: [string, string][] = [
      ['discount_percent', 'REAL DEFAULT 0'],
      ['discount_amount', 'REAL DEFAULT 0'],
      ['discon_total', 'REAL DEFAULT 0'],
      ['disc1_percent', 'REAL DEFAULT 0'],
      ['disc1_amount', 'REAL DEFAULT 0'],
      ['disc2_percent', 'REAL DEFAULT 0'],
      ['disc2_amount', 'REAL DEFAULT 0'],
      ['disc3_percent', 'REAL DEFAULT 0'],
      ['disc3_amount', 'REAL DEFAULT 0'],
      ['gross_amount', 'REAL DEFAULT 0'],
      ['net_amount', 'REAL DEFAULT 0'],
      ['unit_name', "TEXT DEFAULT 'PCS'"],
      ['unit_ratio', 'REAL DEFAULT 1'],
      ['unit_price', 'REAL DEFAULT 0'],
      ['total_price', 'REAL DEFAULT 0'],
      ['modifier', 'TEXT'],
      ['cogs_unit', 'REAL DEFAULT 0'],
      ['cogs_total', 'REAL DEFAULT 0'],
      ['disc_nominal', 'REAL DEFAULT 0'],
      ['bonus_barang_id', 'INTEGER'],
      ['bonus_name', 'TEXT'],
      ['bonus_qty', 'REAL DEFAULT 0'],
      ['bonus_unit', 'TEXT'],
      ['bonus_unit_ratio', 'REAL DEFAULT 1'],
    ]
    for (const [col, type] of colDefs) {
      if (!namesIt.has(col)) migIt.push(`ALTER TABLE transaction_items ADD COLUMN ${col} ${type}`)
    }
    for (const sql of migIt) { try { await rawRun(sql) } catch {} }
  } catch {}
  try {
    const sbCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'stock_balance'")
    const sbNames = new Set(sbCols.map(c => String(c.name)))
    const migSb: string[] = []
    if (!sbNames.has('avg_cost')) migSb.push('ALTER TABLE stock_balance ADD COLUMN avg_cost REAL DEFAULT 0')
    if (!sbNames.has('total_cost')) migSb.push('ALTER TABLE stock_balance ADD COLUMN total_cost REAL DEFAULT 0')
    for (const sql of migSb) { try { await rawRun(sql) } catch {} }
  } catch {}
  try {
    const smCols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'stock_movements'")
    const smNames = new Set(smCols.map(c => String(c.name)))
    const migSm: string[] = []
    if (!smNames.has('unit_cost')) migSm.push('ALTER TABLE stock_movements ADD COLUMN unit_cost REAL')
    if (!smNames.has('total_cost')) migSm.push('ALTER TABLE stock_movements ADD COLUMN total_cost REAL')
    if (!smNames.has('balance_qty')) migSm.push('ALTER TABLE stock_movements ADD COLUMN balance_qty REAL')
    if (!smNames.has('balance_cost')) migSm.push('ALTER TABLE stock_movements ADD COLUMN balance_cost REAL')
    if (!smNames.has('balance_avg_cost')) migSm.push('ALTER TABLE stock_movements ADD COLUMN balance_avg_cost REAL')
    if (!smNames.has('unit')) migSm.push('ALTER TABLE stock_movements ADD COLUMN unit TEXT')
    for (const sql of migSm) { try { await rawRun(sql) } catch {} }
  } catch {}
  try { await rawRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_sb_item_wh ON stock_balance (ingredient_id, warehouse_id)') } catch {}
  try { await rawRun("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS faktur_pajak TEXT") } catch {}
  try { await rawRun("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_return INTEGER NOT NULL DEFAULT 0") } catch {}
  try { await rawRun("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_transaction_id INTEGER") } catch {}
  try { await rawRun("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS so_id INTEGER") } catch {}
  try { await rawRun("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS invoice_id INTEGER") } catch {}
  try { await rawRun("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS return_reason TEXT") } catch {}
  try {
    const payExists = await rawGet<any>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_payments'")
    if (payExists) {
      const pcols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transaction_payments'")
      const pnames = new Set(pcols.map((c: any) => String(c.name).toLowerCase()))
      if (!pnames.has('change_amount')) try { await rawRun("ALTER TABLE transaction_payments ADD COLUMN change_amount REAL DEFAULT 0") } catch {}
      if (pnames.has('is_change')) try { await rawRun("ALTER TABLE transaction_payments DROP COLUMN is_change") } catch {}
    }
  } catch {}
  try { await rawRun("CREATE TABLE IF NOT EXISTS transaction_sequences (prefix TEXT NOT NULL, year TEXT NOT NULL, last_number INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (prefix, year))") } catch {}
  try { await rawRun(`INSERT INTO transaction_sequences (prefix, year, last_number)
    SELECT SPLIT_PART(transaction_number, '/', 1), SPLIT_PART(transaction_number, '/', 2),
      MAX(CAST(SPLIT_PART(transaction_number, '/', 3) AS INTEGER))
    FROM transactions WHERE transaction_number LIKE '%/%/%'
    GROUP BY 1, 2
    ON CONFLICT (prefix, year) DO UPDATE SET last_number = GREATEST(transaction_sequences.last_number, EXCLUDED.last_number)`) } catch {}
}
