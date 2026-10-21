import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

async function ensurePurchaseCore() {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        purchase_number TEXT,
        supplier_id INTEGER,
        warehouse_id INTEGER DEFAULT 1,
        purchase_date TEXT,
        invoice_number TEXT,
        subtotal REAL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        ppn_percent REAL DEFAULT 0,
        ppn_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        is_return INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'"
      )
      const names = new Set(cols.map(c=>c.column_name))
      if (!names.has('warehouse_id')) await rawRun("ALTER TABLE purchases ADD COLUMN warehouse_id INTEGER DEFAULT 1")
      if (!names.has('discount_percent')) await rawRun("ALTER TABLE purchases ADD COLUMN discount_percent REAL DEFAULT 0")
      if (!names.has('discount_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN discount_amount REAL DEFAULT 0")
      if (!names.has('ppn_percent')) await rawRun("ALTER TABLE purchases ADD COLUMN ppn_percent REAL DEFAULT 0")
      if (!names.has('ppn_amount')) await rawRun("ALTER TABLE purchases ADD COLUMN ppn_amount REAL DEFAULT 0")
      if (!names.has('is_return')) await rawRun("ALTER TABLE purchases ADD COLUMN is_return INTEGER DEFAULT 0")
    } catch {}
    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_items'"
      )
      const names = new Set(cols.map(c=>c.column_name))
      if (!names.has('unit_name')) await rawRun("ALTER TABLE purchase_items ADD COLUMN unit_name TEXT")
      if (!names.has('unit_ratio')) await rawRun("ALTER TABLE purchase_items ADD COLUMN unit_ratio INTEGER DEFAULT 1")
      if (!names.has('discount_percent')) await rawRun("ALTER TABLE purchase_items ADD COLUMN discount_percent REAL DEFAULT 0")
      if (!names.has('discount_amount')) await rawRun("ALTER TABLE purchase_items ADD COLUMN discount_amount REAL DEFAULT 0")
    } catch {}
    try {
      const sbCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_balance'"
      )
      const sbNames = new Set(sbCols.map(c=>c.column_name))
      if (!sbNames.has('avg_cost')) await rawRun("ALTER TABLE stock_balance ADD COLUMN avg_cost REAL DEFAULT 0")
      if (!sbNames.has('total_cost')) await rawRun("ALTER TABLE stock_balance ADD COLUMN total_cost REAL DEFAULT 0")
    } catch {}
    try {
      const smCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements'"
      )
      const smNames = new Set(smCols.map(c=>c.column_name))
      if (!smNames.has('unit_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN unit_cost REAL")
      if (!smNames.has('total_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN total_cost REAL")
      if (!smNames.has('balance_qty')) await rawRun("ALTER TABLE stock_movements ADD COLUMN balance_qty REAL")
      if (!smNames.has('balance_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN balance_cost REAL")
      if (!smNames.has('balance_avg_cost')) await rawRun("ALTER TABLE stock_movements ADD COLUMN balance_avg_cost REAL")
    } catch {}
    await rawRun(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER,
        barang_id INTEGER,
        quantity REAL DEFAULT 0,
        unit_name TEXT,
        unit_ratio INTEGER DEFAULT 1,
        unit_price REAL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_price REAL DEFAULT 0
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER,
        warehouse_id INTEGER DEFAULT 1,
        movement_type TEXT,
        quantity REAL DEFAULT 0,
        unit TEXT,
        reference_type TEXT,
        reference_id INTEGER,
        period_id INTEGER,
        transaction_date TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS stock_balance (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER,
        warehouse_id INTEGER DEFAULT 1,
        quantity REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
  } catch (e) {
    console.log('ensurePurchaseCore error:', e)
  }
}

async function ensureFinanceCoreGlobal() {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS ap_ledger (
        id SERIAL PRIMARY KEY,
        doc_type TEXT,
        doc_id INTEGER,
        supplier_id INTEGER,
        trans_date TEXT,
        description TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ap_ledger_supplier ON ap_ledger(supplier_id)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ap_ledger_doc ON ap_ledger(doc_type, doc_id)') } catch {}

    await rawRun(`
      CREATE TABLE IF NOT EXISTS ap_payments (
        id SERIAL PRIMARY KEY,
        payment_number TEXT UNIQUE,
        payment_date TEXT,
        supplier_id INTEGER,
        method TEXT,
        amount REAL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ap_payments_supplier ON ap_payments(supplier_id)') } catch {}

    await rawRun(`
      CREATE TABLE IF NOT EXISTS ap_payment_items (
        id SERIAL PRIMARY KEY,
        payment_id INTEGER NOT NULL,
        reference_doc_type TEXT,
        reference_id INTEGER,
        applied_amount REAL DEFAULT 0,
        FOREIGN KEY (payment_id) REFERENCES ap_payments(id) ON DELETE CASCADE
      );
    `)
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ap_payment_items_payment ON ap_payment_items(payment_id)') } catch {}

    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'ap_ledger'"
      )
      const names = new Set(cols.map(c=>c.column_name))
      if (!names.has('description')) await rawRun("ALTER TABLE ap_ledger ADD COLUMN description TEXT")
      if (!names.has('balance')) await rawRun("ALTER TABLE ap_ledger ADD COLUMN balance REAL DEFAULT 0")
    } catch {}
  } catch (e) {
    console.log('ensureFinanceCoreGlobal error:', e)
  }
}

async function seedMissingPeriods(from: string, to: string, dryRun: boolean) {
  const messages: string[] = []
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS master_periode (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 0,
        status_buku TEXT DEFAULT 'open',
        isdelete INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_periode'"
    )
    const names = new Set(cols.map(c => c.column_name))
    if (!names.has('is_active')) await rawRun("ALTER TABLE master_periode ADD COLUMN is_active INTEGER DEFAULT 0")
    if (!names.has('status_buku')) await rawRun("ALTER TABLE master_periode ADD COLUMN status_buku TEXT DEFAULT 'open'")
    if (!names.has('isdelete')) await rawRun("ALTER TABLE master_periode ADD COLUMN isdelete INTEGER DEFAULT 0")

    const [fy, fm] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    for (let y = fy; y <= ty; y++) {
      const startM = (y === fy) ? fm : 1
      const endM = (y === ty) ? tm : 12
      for (let m = startM; m <= endM; m++) {
        const mm = String(m).padStart(2, '0')
        const code = `${y}-${mm}`
        const exists = await rawGet<any>('SELECT id FROM master_periode WHERE code = $1', [code])
        if (!exists) {
          if (!dryRun) {
            const startDate = `${y}-${mm}-01`
            const lastDay = new Date(y, m, 0).toISOString().split('T')[0]
            await rawRun(
              `INSERT INTO master_periode (code, name, start_date, end_date, is_active, status_buku, isdelete, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 0, 'open', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [code, `Periode ${code}`, startDate, lastDay]
            )
          }
          messages.push(`+ ${code}`)
        } else {
          messages.push(`- ${code} (exists)`)
        }
      }
    }
  } catch (e: any) {
    messages.push(`Error: ${e.message}`)
  }
  return { seeded: messages.filter(m => m.startsWith('+')).length, details: messages }
}

async function resequencePeriodIds(dryRun: boolean) {
  const messages: string[] = []
  try {
    const rows = await rawAll<any>("SELECT id, code FROM master_periode WHERE COALESCE(isdelete,0)=0 ORDER BY code")
    const mapping = rows.map((r: any, i: number) => ({ oldId: r.id, newId: i + 1, code: r.code }))
    if (dryRun) {
      mapping.forEach(({ oldId, newId, code }) => messages.push(`id ${oldId} → ${newId} (${code})`))
    } else {
      const db = getDb()
      const pool = (db as any).$client
      for (const { oldId } of mapping) {
        await pool.query('UPDATE master_periode SET id = $1 + 10000 WHERE id = $1', [oldId])
      }
      for (const { oldId, newId } of mapping) {
        await pool.query('UPDATE master_periode SET id = $1 WHERE id = $2 + 10000', [newId, oldId])
      }
      mapping.forEach(({ oldId, newId, code }) => messages.push(`id ${oldId} → ${newId} (${code})`))
    }
    return { resequenced: mapping.length, details: messages }
  } catch (e: any) {
    return { resequenced: 0, details: [ `Error: ${e.message}` ] }
  }
}

async function resetAllTransactionalData(dryRun: boolean) {
  const messages: string[] = []
  try {
    const tablesToDelete = [
      'sales_items', 'sales', 'sales_returns', 'sales_return_items', 'sales_orders', 'sales_order_items',
      'purchase_return_items', 'purchase_returns', 'purchase_items', 'purchases', 'purchase_request_items', 'purchase_requests',
      'stock_movements', 'stock_balances', 'stock_adjustments', 'draftopname',
      'ap_payment_items', 'ap_payments', 'ap_ledger',
      'ar_receipt_items', 'ar_receipts', 'ar_ledger',
      'gl_journal_lines', 'gl_journal',
      'cashbank_transaction_lines', 'cashbank_transactions', 'cashbank_accounts',
    ]
    for (const tbl of tablesToDelete) {
      try {
        const row = await rawGet<any>(`SELECT COUNT(*) as cnt FROM ${tbl}`)
        const count = row?.cnt || 0
        if (!dryRun) {
          await rawRun(`DELETE FROM ${tbl}`)
        }
        messages.push(`${tbl}: ${count} rows`)
      } catch {
        messages.push(`${tbl}: skipped (not exists)`)
      }
    }
  } catch (e: any) {
    messages.push(`Error: ${e.message}`)
  }
  return { deleted: messages.filter(m => /^\w+: \d+ rows/.test(m)).length, details: messages }
}

async function ensurePurchaseRequestCore() {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT UNIQUE,
        request_date TEXT,
        expected_date TEXT,
        period_id INTEGER,
        requester_id INTEGER,
        requester_name TEXT,
        notes TEXT,
        status TEXT DEFAULT 'draft',
        void INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS purchase_request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL,
        barang_id INTEGER,
        barang_code TEXT,
        barang_name TEXT,
        quantity REAL DEFAULT 0,
        unit_name TEXT,
        unit_ratio REAL DEFAULT 1,
        notes TEXT,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      );
    `)
  } catch (e) {
    console.log('ensurePurchaseRequestCore error:', e)
  }
}

async function ensureARCoreGlobal() {
  try {
    try { await rawGet('SELECT 1 FROM ar_ledger LIMIT 1') } catch { try { await rawRun('DROP TABLE IF EXISTS ar_ledger') } catch {} }
    await rawRun(`
      CREATE TABLE IF NOT EXISTS ar_ledger (
        id SERIAL PRIMARY KEY,
        doc_type TEXT,
        doc_id INTEGER,
        customer_id INTEGER,
        trans_date TEXT,
        description TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ar_ledger_customer ON ar_ledger(customer_id)') } catch {}
    try { await rawRun('CREATE INDEX IF NOT EXISTS idx_ar_ledger_doc ON ar_ledger(doc_type, doc_id)') } catch {}

    await rawRun(`
      CREATE TABLE IF NOT EXISTS ar_receipts (
        id SERIAL PRIMARY KEY,
        receipt_number TEXT UNIQUE,
        receipt_date TEXT,
        customer_id INTEGER,
        method TEXT,
        amount REAL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await rawRun(`
      CREATE TABLE IF NOT EXISTS ar_receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER NOT NULL,
        reference_doc_type TEXT,
        reference_id INTEGER,
        applied_amount REAL DEFAULT 0,
        FOREIGN KEY (receipt_id) REFERENCES ar_receipts(id) ON DELETE CASCADE
      );
    `)
    try {
      const cols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'ar_ledger'"
      )
      const names = new Set(cols.map(c=>c.column_name))
      if (!names.has('description')) await rawRun("ALTER TABLE ar_ledger ADD COLUMN description TEXT")
      if (!names.has('balance')) await rawRun("ALTER TABLE ar_ledger ADD COLUMN balance REAL DEFAULT 0")
    } catch {}
  } catch (e) {
    console.log('ensureARCoreGlobal error:', e)
  }
}

async function ensureGLCoreGlobal() {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS gl_journal (
        id SERIAL PRIMARY KEY,
        journal_number TEXT UNIQUE,
        journal_date TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS gl_journal_lines (
        id SERIAL PRIMARY KEY,
        journal_id INTEGER NOT NULL,
        account_code TEXT,
        account_name TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (journal_id) REFERENCES gl_journal(id) ON DELETE CASCADE
      );
    `)
  } catch (e) {
    console.log('ensureGLCoreGlobal error:', e)
  }
}

async function ensureCashbankCoreGlobal() {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS cashbank_accounts (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT,
        type TEXT,
        currency TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS cashbank_transactions (
        id SERIAL PRIMARY KEY,
        trans_number TEXT UNIQUE,
        trans_date TEXT,
        account_id INTEGER,
        direction TEXT,
        amount REAL DEFAULT 0,
        reference_type TEXT,
        reference_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await rawRun(`
      CREATE TABLE IF NOT EXISTS cashbank_transaction_lines (
        id SERIAL PRIMARY KEY,
        trans_id INTEGER NOT NULL,
        description TEXT,
        amount REAL DEFAULT 0,
        FOREIGN KEY (trans_id) REFERENCES cashbank_transactions(id) ON DELETE CASCADE
      );
    `)
  } catch (e) {
    console.log('ensureCashbankCoreGlobal error:', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dryRun = url.searchParams.get('dryRun') !== 'false'
    const seedPeriodsFrom = url.searchParams.get('seedPeriodsFrom')
    const seedPeriodsTo = url.searchParams.get('seedPeriodsTo')
    const resequencePeriods = url.searchParams.get('resequencePeriods') === 'true'
    const resetTransactions = url.searchParams.get('resetTransactions')

    const results: any = { dryRun, actions: [] }

    await ensurePurchaseCore()
    results.actions.push({ module: 'Purchases', details: 'ok' })

    await ensurePurchaseRequestCore()
    results.actions.push({ module: 'Purchase Requests', details: 'ok' })

    await ensureFinanceCoreGlobal()
    results.actions.push({ module: 'Finance (AP)', details: 'ok' })

    await ensureARCoreGlobal()
    results.actions.push({ module: 'Finance (AR)', details: 'ok' })

    await ensureGLCoreGlobal()
    results.actions.push({ module: 'Finance (GL)', details: 'ok' })

    await ensureCashbankCoreGlobal()
    results.actions.push({ module: 'Finance (Cash/Bank)', details: 'ok' })

    if (seedPeriodsFrom && seedPeriodsTo) {
      const periodResult = await seedMissingPeriods(seedPeriodsFrom, seedPeriodsTo, dryRun)
      results.actions.push({ module: 'Period Seeding', details: periodResult })
    }

    if (resequencePeriods) {
      const reseqResult = await resequencePeriodIds(dryRun)
      results.actions.push({ module: 'Period Resequencing', details: reseqResult })
    }

    if (resetTransactions === 'DELETE_ALL_TX') {
      const resetResult = await resetAllTransactionalData(dryRun)
      results.actions.push({ module: 'Reset Transactions', details: resetResult })
    } else if (resetTransactions) {
      return NextResponse.json({ error: 'Invalid resetTransactions flag' }, { status: 400 })
    }

    return NextResponse.json(results)
  } catch (e: any) {
    console.error('Migrate-all error:', e)
    return NextResponse.json({ error: e?.message || 'Migration failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
