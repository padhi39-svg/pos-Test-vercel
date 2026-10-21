const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
let client;

function toPg(sql, params) {
  if (!params || params.length === 0) return { text: sql, values: [] };
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  return { text, values: params };
}

async function q(sql, params) {
  const { text, values } = toPg(sql, params);
  return client.query(text, values);
}

async function getColumns(table) {
  try {
    const r = await q(
      "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'",
      [table]
    );
    return new Set(r.rows.map(c => String(c.column_name).toLowerCase()));
  } catch { return new Set(); }
}

function hasCol(cols, name) { return cols.has(name.toLowerCase()); }

function extractTables(sql) {
  const t = new Set();
  const re = /\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_][a-z0-9_]*)/gi;
  let m;
  while ((m = re.exec(sql)) !== null) t.add(m[1]);
  const re2 = /\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_][a-z0-9_]*)\./gi;
  while ((m = re2.exec(sql)) !== null) t.add(m[1]);
  return [...t].sort();
}

async function testRoute(label, queries) {
  console.log(`\n  📁 ${label}`);
  let allOk = true, totalRows = 0, allTables = new Set();
  for (const qDef of queries) {
    let sql = qDef.sql;
    // Build dynamic SQL if a builder is provided
    if (qDef.build) {
      sql = await qDef.build();
    }
    try {
      const { text, values } = toPg(sql, qDef.params || []);
      const result = await client.query(text, values);
      totalRows += result.rowCount || result.rows.length || 0;
      for (const t of extractTables(sql)) allTables.add(t);
    } catch (err) {
      allOk = false;
      console.log(`    ❌ ${qDef.label}: ${err.message}`);
      console.log(`       SQL: ${(sql || '').slice(0, 120)}...`);
    }
  }
  console.log(`    ${allOk ? '✅' : '⚠️'}  ${queries.length} queries, ${totalRows} total rows`);
  if (allTables.size > 0) console.log(`    📊 ${[...allTables].join(', ')}`);
}

async function main() {
  console.log('='.repeat(90));
  console.log('  REPORT API SQL TEST SUITE');
  console.log('  Target: ' + DB_URL);
  console.log('='.repeat(90));

  client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // ---- JOURNAL HELPERS (Core dependency for many routes) ----
    console.log('\n' + '─'.repeat(90));
    console.log('  JOURNAL HELPERS (getJournalEntries / loadAllEntries / journal_entries table)');
    console.log('─'.repeat(90));

    const jCols = await getColumns('journal_entries');
    console.log(`    journal_entries columns: ${[...jCols].join(', ') || '(none found)'}`);
    const jeCount = await q('SELECT COUNT(*)::int as cnt FROM journal_entries');
    console.log(`    journal_entries rows: ${jeCount.rows[0].cnt}`);

    // ---- ROUTE: /api/reports/buku-besar ----
    await testRoute('/api/reports/buku-besar', [
      {
        sql: "SELECT code, name, normal_balance FROM accounts WHERE posting_allowed = 1 ORDER BY code",
        params: [],
        label: "posting accounts"
      },
      {
        sql: "SELECT MIN(entry_date) as min_d, MAX(entry_date) as max_d FROM journal_entries",
        params: [],
        label: "journal date range"
      },
      {
        sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id",
        params: ['2000-01-01', '2026-06-09'],
        label: "entries before period"
      },
      {
        sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id",
        params: ['2026-06-01', '2026-06-30'],
        label: "entries in period"
      },
      {
        sql: "SELECT code, name, normal_balance FROM accounts WHERE code = ?",
        params: ['1-1000'],
        label: "single account"
      }
    ]);

    // ---- ROUTE: /api/reports/buku-besar/export ----
    await testRoute('/api/reports/buku-besar/export', [
      { sql: "SELECT code, name, normal_balance FROM accounts WHERE posting_allowed = 1 ORDER BY code", params: [], label: "accounts export" },
      { sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id", params: ['2000-01-01', '2026-06-09'], label: "entries export" },
      { sql: "SELECT code, name, normal_balance FROM accounts WHERE code = ?", params: ['1-1000'], label: "single account export" },
    ]);

    // ---- ROUTE: /api/reports/jurnal-harian ----
    await testRoute('/api/reports/jurnal-harian', [
      { sql: "SELECT MIN(entry_date) as min_d, MAX(entry_date) as max_d FROM journal_entries", params: [], label: "journal date range" },
      { sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id", params: ['2000-01-01', '2026-06-09'], label: "before period" },
      { sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id", params: ['2026-06-01', '2026-06-30'], label: "period entries" },
    ]);

    // ---- ROUTE: /api/reports/jurnal-harian/export ----
    await testRoute('/api/reports/jurnal-harian/export', [
      { sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id", params: ['2026-06-01', '2026-06-30'], label: "entries export" },
    ]);

    // ---- ROUTE: /api/reports/neraca ----
    await testRoute('/api/reports/neraca', [
      { sql: "SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "active accounts" },
      { sql: "SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = 12", params: [2025], label: "prev year balances" },
      { sql: "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'", params: [], label: "laba mappings" },
      { sql: "SELECT parent_id FROM accounts WHERE id = $1", params: [1], label: "parent account" },
    ]);

    // ---- ROUTE: /api/reports/neraca/export ----
    await testRoute('/api/reports/neraca/export', [
      { sql: "SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
      { sql: "SELECT name, start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period info" },
    ]);

    // ---- ROUTE: /api/reports/neraca/validate ----
    await testRoute('/api/reports/neraca/validate', [
      { sql: "SELECT start_date, end_date FROM master_periode WHERE id = ? AND isdelete = 0", params: [1], label: "period" },
      { sql: "SELECT code FROM accounts WHERE is_active = 1", params: [], label: "account codes" },
      { sql: "SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id", params: ['2026-01-01', '2026-01-31'], label: "period entries" },
      { sql: "SELECT map_group, map_key, account_id FROM account_mappings", params: [], label: "all mappings" },
    ]);

    // ---- ROUTE: /api/reports/neraca-labarugi ----
    await testRoute('/api/reports/neraca-labarugi', [
      { sql: "SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period" },
      { sql: "SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
    ]);

    // ---- ROUTE: /api/reports/neraca-labarugi/export ----
    await testRoute('/api/reports/neraca-labarugi/export', [
      { sql: "SELECT start_date, end_date, name FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period info" },
    ]);

    // ---- ROUTE: /api/reports/laba-rugi ----
    await testRoute('/api/reports/laba-rugi', [
      { sql: "SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period" },
      { sql: "SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
      { sql: "SELECT id, name, start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "cur period" },
      { sql: "SELECT id, name, start_date, end_date FROM master_periode WHERE end_date < $1 AND isdelete = 0 ORDER BY end_date DESC LIMIT 1", params: ['2026-01-01'], label: "prev period" },
    ]);

    // ---- ROUTE: /api/reports/trial-balance ----
    const tbCols = await getColumns('account_mappings');
    const tbHasAccountCode = hasCol(tbCols, 'account_code');
    await testRoute('/api/reports/trial-balance', [
      { sql: "SELECT COUNT(*) FROM akun_saldo_bulanan LIMIT 1", params: [], label: "check cache table" },
      { sql: "SELECT id, code, name, parent_id, level, is_header, normal_balance, posting_allowed, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
      {
        label: `laba mappings (account_mappings has${tbHasAccountCode ? '' : ' no'} account_code column)`,
        sql: tbHasAccountCode
          ? "SELECT account_id, map_key, account_code FROM account_mappings WHERE map_group = 'laba'"
          : "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'",
        params: []
      },
    ]);

    // ---- ROUTE: /api/reports/trial-balance/calculate-balance ----
    await testRoute('/api/reports/trial-balance/calculate-balance', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'akun_saldo_bulanan' AND table_schema = 'public'", params: [], label: "akun_saldo_bulanan cols" },
      { sql: "SELECT id, code, name, normal_balance FROM accounts WHERE is_active = 1 AND posting_allowed = 1 AND is_header = 0 ORDER BY code", params: [], label: "posting accounts" },
      { sql: "SELECT MIN(CAST(SUBSTRING(entry_date,1,4) AS INTEGER)) AS min_year, MAX(CAST(SUBSTRING(entry_date,1,4) AS INTEGER)) AS max_year FROM journal_entries", params: [], label: "year range" },
    ]);

    // ---- ROUTE: /api/reports/snapshot ----
    await testRoute('/api/reports/snapshot', [
      { sql: "SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period" },
      { sql: "SELECT id, code, name, parent_id, level, is_header, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
      { sql: "SELECT account_code, saldo_akhir FROM akun_saldo_bulanan WHERE year = $1 AND month = 12", params: [2025], label: "prev year" },
      { sql: "SELECT account_id, map_key FROM account_mappings WHERE map_group = 'laba'", params: [], label: "laba mappings" },
    ]);

    // ---- ROUTE: /api/reports/coretax ----
    await testRoute('/api/reports/coretax', [
      { sql: "SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period" },
      { sql: "SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
      { sql: "SELECT account_code, type, amount FROM fiscal_corrections WHERE year = $1", params: [2026], label: "fiscal corrections" },
      { sql: "SELECT name FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period name" },
    ]);

    // ---- ROUTE: /api/reports/coretax/export ----
    await testRoute('/api/reports/coretax/export', [
      { sql: "SELECT start_date, end_date FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period" },
      { sql: "SELECT code, name, normal_balance, golongan FROM accounts WHERE is_active = 1 ORDER BY code", params: [], label: "accounts" },
      { sql: "SELECT account_code, type, amount FROM fiscal_corrections WHERE year = $1", params: [2026], label: "corrections" },
      { sql: "SELECT name FROM master_periode WHERE id = $1 AND isdelete = 0", params: [1], label: "period name" },
    ]);

    // ---- ROUTE: /api/reports/sales-vs-usage (dynamic column discovery) ----
    const tCols = await getColumns('transactions');
    const hasTxDate = hasCol(tCols, 'transaction_date');
    const dateCol = hasTxDate ? 't.transaction_date' : "COALESCE(SUBSTRING(t.created_at::text,1,10), '')";
    const hasVoid = hasCol(tCols, 'void');
    const voidExpr = hasVoid ? "COALESCE(t.void,0)=0" : "t.status IS DISTINCT FROM 'void'";
    await testRoute('/api/reports/sales-vs-usage', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'", params: [], label: "tx columns" },
      {
        label: `sales-vs-usage main query (txDate=${hasTxDate ? 'yes' : 'no'}, void=${hasVoid ? 'yes' : 'no'})`,
        sql: `SELECT t.id as transaction_id, t.transaction_number, ${dateCol} as tdate, ti.id as item_id, ti.barang_id, ti.barang_code, ti.barang_name, ti.quantity as item_qty FROM transactions t JOIN transaction_items ti ON ti.transaction_id = t.id WHERE 1=1 AND ${voidExpr} ORDER BY t.id ASC, ti.id ASC`,
        params: []
      },
      { sql: "SELECT COALESCE(hpp,0) as hpp FROM master_barang WHERE id = ?", params: [1], label: "barang hpp" },
      { sql: "SELECT name FROM master_barang WHERE id = ?", params: [1], label: "barang name" },
    ]);

    // ---- ROUTE: /api/reports/sales-rekap-pertanggal (dynamic) ----
    const tpCols = await getColumns('transaction_payments');
    const txHasTglNota = hasCol(tCols, 'tgl_nota');
    const hasSubtotal = hasCol(tCols, 'subtotal');
    const hasPpnAmt = hasCol(tCols, 'ppn_amount');
    const hasTotal = hasCol(tCols, 'total');
    const hasTxnType = hasCol(tCols, 'transaction_type');
    const hasVoidCol = hasCol(tCols, 'void');
    const hasChangeAmt = hasCol(tpCols, 'change_amount');
    const hasMethod = hasCol(tpCols, 'method');
    const hasAmount = hasCol(tpCols, 'amount');
    await testRoute('/api/reports/sales-rekap-pertanggal', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'", params: [], label: "tx schema" },
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'transaction_payments' AND table_schema = 'public'", params: [], label: "tp schema" },
    ]);

    // ---- ROUTE: /api/reports/sales-jatuh-tempo (dynamic) ----
    const hasDueDate = hasCol(tCols, 'due_date');
    const hasNmCust = hasCol(tCols, 'nm_cust');
    const nmCustCol = hasCol(tCols, 'nm_cust') ? 't."Nm_cust"' : hasCol(tCols, 'nm_cust') ? 't.nm_cust' : null;
    await testRoute('/api/reports/sales-jatuh-tempo', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'", params: [], label: "tx columns" },
      ...(hasDueDate ? [{
        label: `sales jatuh tempo (dueDate=yes)`,
        sql: `SELECT t.id, t.transaction_number as kode_nota, COALESCE(${nmCustCol ? nmCustCol : 'NULL'}, c.name, 'Umum') as customer, COALESCE(${hasCol(tCols, 'tgl_nota') ? 't.tgl_nota' : 'NULL'}, date(t.created_at)::text) as tanggal_nota, t.total, t.due_date as jatuh_tempo FROM transactions t LEFT JOIN master_customer c ON t.customer_id = c.id WHERE t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE AND ${voidExpr} ORDER BY t.due_date ASC, t.transaction_number ASC`,
        params: []
      }] : [{ label: "sales-jatuh-tempo: no due_date column (skipped)", sql: "SELECT 1 WHERE 1=0", params: [] }]),
    ]);

    // ---- ROUTE: /api/reports/sales-gross-profit (dynamic) ----
    await testRoute('/api/reports/sales-gross-profit', [
      { sql: "SELECT id, name FROM master_barang WHERE COALESCE(isdelete,0)=0 ORDER BY name", params: [], label: "barang list" },
      { sql: "SELECT id, name FROM master_customer WHERE COALESCE(isdelete,0)=0 ORDER BY name", params: [], label: "customer list" },
    ]);

    // ---- ROUTE: /api/reports/pos-sales (dynamic) ----
    const hasServiceCharge = hasCol(tCols, 'service_charge_amount');
    const hasChangeAmountTx = hasCol(tCols, 'change_amount');
    await testRoute('/api/reports/pos-sales', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'", params: [], label: "tx columns" },
    ]);

    // ---- ROUTE: /api/reports/piutang-jatuh-tempo (dynamic) ----
    await testRoute('/api/reports/piutang-jatuh-tempo', [
      { sql: "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions' AND table_schema = 'public'", params: [], label: "tx columns" },
    ]);

    // ---- ROUTE: /api/reports/hutang-jatuh-tempo (dynamic) ----
    const pCols = await getColumns('purchases');
    const pHasDueDate = hasCol(pCols, 'due_date');
    const dueDateCol = pHasDueDate ? 'due_date' : (hasCol(pCols, 'expected_date') ? 'expected_date' : null);
    const pHasVoid = hasCol(pCols, 'void');
    const pVoidExpr = pHasVoid ? "COALESCE(p.void,0)=0" : "p.status IS DISTINCT FROM 'void'";
    await testRoute('/api/reports/hutang-jatuh-tempo', [
      { sql: "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'purchases' AND table_schema = 'public'", params: [], label: "purchases columns" },
      ...(dueDateCol ? [{
        label: `hutang jatuh tempo (dueDate=${dueDateCol})`,
        sql: `SELECT p.id, p.purchase_number as kode_nota, COALESCE(s.name, 'Umum') as supplier, p.purchase_date as tanggal_nota, p.${dueDateCol} as jatuh_tempo, p.total, p.total - COALESCE((SELECT SUM(pi.pay_amount) FROM ap_payment_items pi JOIN ap_payments app ON app.id = pi.payment_id WHERE pi.purchase_id = p.id AND app.status = 'active' AND COALESCE(app.void, 0) = 0), 0) as sisa FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id WHERE p.${dueDateCol} IS NOT NULL AND p.${dueDateCol} != '' AND ${pVoidExpr} AND p.status = 'active' ORDER BY p.${dueDateCol} ASC, p.purchase_number ASC`,
        params: []
      }] : [{ label: "hutang: no due_date (skipped)", sql: "SELECT 1 WHERE 1=0", params: [] }]),
    ]);

    // ---- ROUTE: /api/reports/purchase-jatuh-tempo (dynamic) ----
    await testRoute('/api/reports/purchase-jatuh-tempo', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases' AND table_schema = 'public'", params: [], label: "purchases columns" },
      ...(dueDateCol ? [{
        label: `purchase jatuh tempo (dueDate=${dueDateCol})`,
        sql: `SELECT p.id, p.purchase_number as kode_nota, COALESCE(s.name, 'Umum') as supplier, p.purchase_date as tanggal_nota, p.total, p.${dueDateCol} as jatuh_tempo FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id WHERE p.${dueDateCol} IS NOT NULL AND p.${dueDateCol}::date <= CURRENT_DATE AND ${pVoidExpr} AND p.status = 'active' AND COALESCE(p.payment_status, '') NOT IN ('Lunas', 'paid', 'Paid') ORDER BY p.${dueDateCol} ASC, p.purchase_number ASC`,
        params: []
      }] : [{ label: "purchase-jatuh-tempo: no dueDate (skipped)", sql: "SELECT 1 WHERE 1=0", params: [] }]),
    ]);

    // ---- ROUTE: /api/reports/payment-detail-ap-report ----
    await testRoute('/api/reports/payment-detail-ap-report', [
      { sql: "SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.notes, p.status, p.total AS payment_amount, COALESCE(p.customer_name, c.name, 'Umum') AS customer_name, pi.sale_id, t.transaction_number AS transaction_number, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks, pm.account_id, COALESCE(pm.account_name, a.name) AS account_name, pm.amount AS method_amount FROM ar_payments p LEFT JOIN master_customer c ON p.customer_id = c.id LEFT JOIN ar_payment_items pi ON pi.payment_id = p.id LEFT JOIN transactions t ON pi.sale_id = t.id LEFT JOIN ar_payment_methods pm ON pm.payment_id = p.id LEFT JOIN accounts a ON a.id = pm.account_id WHERE 1=1 ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id", params: [], label: "payment-detail-ap" },
    ]);

    // ---- ROUTE: /api/reports/reservation-recap (dynamic columns) ----
    const resCols = await getColumns('reservations');
    await testRoute('/api/reports/reservation-recap', [
    ]);

    // ---- ROUTE: /api/reports/kartu-piutang (dynamic transaction_date) ----
    const hasTxDateCol = hasCol(tCols, 'transaction_date');
 // skip is_return (not in PG)
    const isReturnExpr = "0";
    const txnStatusFilter = "COALESCE(t.status,'') NOT IN ('void','cancelled')";
    const txDateExpr = 'LEFT(t.created_at::text, 10)';
    await testRoute('/api/reports/kartu-piutang', [
      { sql: "SELECT DISTINCT c.id, c.name FROM master_customer c WHERE c.id IN (SELECT customer_id FROM transactions WHERE customer_id IS NOT NULL UNION SELECT customer_id FROM ar_payments WHERE customer_id IS NOT NULL) ORDER BY c.name", params: [], label: "customer list" },
      { sql: "SELECT id, name FROM master_customer WHERE id = $1", params: [1], label: "single customer" },
      {
        label: `before sales (txDate=${hasTxDateCol ? 'yes' : 'no'})`,
        sql: `SELECT COALESCE(SUM(t.total), 0) as total FROM transactions t WHERE ${txDateExpr} <= $1 AND ${txDateExpr} >= '2000-01-01' AND t.customer_id = $2 AND ${txnStatusFilter} AND ${isReturnExpr} = 0`,
        params: ['2026-06-09', 1]
      },
      {
        label: "before returns",
        sql: `SELECT COALESCE(SUM(ABS(t.total)), 0) as total FROM transactions t WHERE ${txDateExpr} <= $1 AND ${txDateExpr} >= '2000-01-01' AND t.customer_id = $2 AND ${txnStatusFilter} AND ${isReturnExpr} = 1`,
        params: ['2026-06-09', 1]
      },
      { sql: "SELECT COALESCE(SUM(pai.pay_amount), 0) as total FROM ar_payments p JOIN ar_payment_items pai ON pai.payment_id = p.id WHERE p.payment_date <= $1 AND p.payment_date >= '2000-01-01' AND p.customer_id = $2 AND p.status = 'active'", params: ['2026-06-09', 1], label: "before payments" },
      { sql: "SELECT COALESCE(SUM(nominal), 0) as total FROM ar_opening_balances WHERE tanggal <= $1 AND tanggal >= '2000-01-01' AND customer_id = $2 AND (status IS NULL OR status != 'void')", params: ['2026-06-09', 1], label: "before openings" },
      {
        label: "period sales",
        sql: `SELECT ${txDateExpr} as tdate, t.transaction_number as source_number, 'penjualan' as description, 0 as debit, t.total as kredit FROM transactions t WHERE ${txDateExpr} >= $1 AND ${txDateExpr} <= $2 AND t.customer_id = $3 AND ${txnStatusFilter} AND ${isReturnExpr} = 0 AND t.total > 0`,
        params: ['2026-06-01', '2026-06-30', 1]
      },
      {
        label: "period returns",
        sql: `SELECT ${txDateExpr} as tdate, t.transaction_number as source_number, 'retur penjualan' as description, ABS(t.total) as debit, 0 as kredit FROM transactions t WHERE ${txDateExpr} >= $1 AND ${txDateExpr} <= $2 AND t.customer_id = $3 AND ${txnStatusFilter} AND ${isReturnExpr} = 1 AND ABS(t.total) > 0`,
        params: ['2026-06-01', '2026-06-30', 1]
      },
      { sql: "SELECT p.payment_date as tdate, p.payment_number as source_number, 'terima piutang' as description, SUM(pai.pay_amount) as debit, 0 as kredit FROM ar_payments p JOIN ar_payment_items pai ON pai.payment_id = p.id WHERE p.payment_date >= $1 AND p.payment_date <= $2 AND p.customer_id = $3 AND p.status = 'active' GROUP BY p.id", params: ['2026-06-01', '2026-06-30', 1], label: "period payments" },
      { sql: "SELECT tanggal as tdate, kode_nota as source_number, 'saldo awal piutang' as description, 0 as debit, nominal as kredit FROM ar_opening_balances WHERE tanggal >= $1 AND tanggal <= $2 AND customer_id = $3 AND (status IS NULL OR status != 'void') AND nominal > 0", params: ['2026-06-01', '2026-06-30', 1], label: "period openings" },
    ]);

    // ---- ROUTE: /api/reports/kartu-piutang/export ----
    await testRoute('/api/reports/kartu-piutang/export', [
      { sql: "SELECT id, name FROM master_customer WHERE id = $1", params: [1], label: "customer" },
    ]);

    // ---- ROUTE: /api/reports/kartu-hutang ----
    await testRoute('/api/reports/kartu-hutang', [
      { sql: "SELECT DISTINCT s.id, s.name FROM master_supplier s WHERE s.id IN (SELECT supplier_id FROM purchases WHERE supplier_id IS NOT NULL UNION SELECT supplier_id FROM ap_payments WHERE supplier_id IS NOT NULL) ORDER BY s.name", params: [], label: "suppliers" },
      { sql: "SELECT id, name FROM master_supplier WHERE id = $1", params: [1], label: "single supplier" },
      { sql: "SELECT COALESCE(SUM(p.total), 0) as total FROM purchases p WHERE p.purchase_date <= $1 AND p.purchase_date >= '2000-01-01' AND p.supplier_id = $2 AND (p.is_return IS NULL OR p.is_return = 0) AND COALESCE(p.void, 0) = 0", params: ['2026-06-09', 1], label: "before purchases" },
      { sql: "SELECT COALESCE(SUM(ppi.pay_amount), 0) as total FROM ap_payments p JOIN ap_payment_items ppi ON ppi.payment_id = p.id WHERE p.payment_date <= $1 AND p.payment_date >= '2000-01-01' AND p.supplier_id = $2 AND p.status = 'active'", params: ['2026-06-09', 1], label: "before payments" },
      { sql: "SELECT COALESCE(SUM(ABS(p.total)), 0) as total FROM purchases p WHERE p.purchase_date <= $1 AND p.purchase_date >= '2000-01-01' AND p.supplier_id = $2 AND p.is_return = 1 AND COALESCE(p.void, 0) = 0", params: ['2026-06-09', 1], label: "before returns" },
      { sql: "SELECT COALESCE(SUM(nominal), 0) as total FROM ap_opening_balances WHERE tanggal <= $1 AND tanggal >= '2000-01-01' AND supplier_id = $2 AND (status IS NULL OR status != 'void')", params: ['2026-06-09', 1], label: "before openings" },
      { sql: "SELECT p.purchase_date as tdate, p.purchase_number as source_number, 'pembelian' as description, p.total as debit, 0 as kredit FROM purchases p WHERE p.purchase_date >= $1 AND p.purchase_date <= $2 AND p.supplier_id = $3 AND (p.is_return IS NULL OR p.is_return = 0) AND COALESCE(p.void, 0) = 0 AND p.total > 0", params: ['2026-06-01', '2026-06-30', 1], label: "period purchases" },
      { sql: "SELECT p.purchase_date as tdate, p.purchase_number as source_number, 'retur pembelian' as description, 0 as debit, ABS(p.total) as kredit FROM purchases p WHERE p.purchase_date >= $1 AND p.purchase_date <= $2 AND p.supplier_id = $3 AND p.is_return = 1 AND COALESCE(p.void, 0) = 0 AND ABS(p.total) > 0", params: ['2026-06-01', '2026-06-30', 1], label: "period returns" },
      { sql: "SELECT p.payment_date as tdate, p.payment_number as source_number, 'bayar hutang' as description, 0 as debit, SUM(ppi.pay_amount) as kredit FROM ap_payments p JOIN ap_payment_items ppi ON ppi.payment_id = p.id WHERE p.payment_date >= $1 AND p.payment_date <= $2 AND p.supplier_id = $3 AND p.status = 'active' GROUP BY p.id", params: ['2026-06-01', '2026-06-30', 1], label: "period payments" },
      { sql: "SELECT tanggal as tdate, kode_nota as source_number, 'saldo awal hutang' as description, nominal as debit, 0 as kredit FROM ap_opening_balances WHERE tanggal >= $1 AND tanggal <= $2 AND supplier_id = $3 AND (status IS NULL OR status != 'void') AND nominal > 0", params: ['2026-06-01', '2026-06-30', 1], label: "period openings" },
    ]);

    // ---- ROUTE: /api/reports/kartu-hutang/export ----
    await testRoute('/api/reports/kartu-hutang/export', [
      { sql: "SELECT id, name FROM master_supplier WHERE id = $1", params: [1], label: "supplier" },
      { sql: "SELECT COALESCE(SUM(p.total),0) as total FROM purchases p WHERE p.purchase_date <= $1 AND p.purchase_date>='2000-01-01' AND p.supplier_id=$2 AND (p.is_return IS NULL OR p.is_return=0) AND COALESCE(p.void,0)=0", params: ['2026-06-09', 1], label: "before purchases" },
    ]);

    // ---- ROUTE: /api/reports/kartu-kas-bank ----
    await testRoute('/api/reports/kartu-kas-bank', [
      { sql: "SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE (is_cash = 1 OR is_bank_account = 1) AND is_active = 1 ORDER BY code", params: [], label: "cash/bank accounts" },
      { sql: "SELECT m.mutation_date as tgl, m.mutation_number as ref, COALESCE(m.notes, m.mutation_number) as deskripsi, m.mutation_type, m.total_amount as nominal, 'Mutasi Kas' as sumber FROM cash_mutations m WHERE m.cash_account_id = ? AND m.status = 'active' AND m.mutation_date >= ? AND m.mutation_date <= ? ORDER BY m.mutation_date, m.id", params: [1, '2026-06-01', '2026-06-30'], label: "cash mutations" },
      { sql: "SELECT p.payment_date as tgl, p.payment_number as ref, COALESCE(p.notes, p.payment_number) as deskripsi, m.amount as nominal FROM ap_payment_methods m JOIN ap_payments p ON p.id = m.payment_id AND p.status = 'active' WHERE m.account_id = ? AND p.payment_date >= ? AND p.payment_date <= ? ORDER BY p.payment_date, p.id", params: [1, '2026-06-01', '2026-06-30'], label: "ap payments" },
      { sql: "SELECT p.payment_date as tgl, p.payment_number as ref, COALESCE(p.notes, p.payment_number) as deskripsi, m.amount as nominal FROM ar_payment_methods m JOIN ar_payments p ON p.id = m.payment_id AND p.status = 'active' WHERE m.account_id = ? AND p.payment_date >= ? AND p.payment_date <= ? ORDER BY p.payment_date, p.id", params: [1, '2026-06-01', '2026-06-30'], label: "ar payments" },
      { sql: "SELECT a.tanggal as tgl, a.kode_nota as ref, COALESCE(a.notes, a.kode_nota) as deskripsi, COALESCE(l.amount, l.nominal) as nominal FROM ap_advance_lines l JOIN ap_advances a ON a.id = l.ap_advance_id AND (a.status = 'active' OR a.status IS NULL) WHERE l.account_id = ? AND a.tanggal >= ? AND a.tanggal <= ? ORDER BY a.tanggal, a.id", params: [1, '2026-06-01', '2026-06-30'], label: "ap advances" },
      { sql: "SELECT a.tanggal as tgl, a.kode_nota as ref, COALESCE(a.notes, a.kode_nota) as deskripsi, COALESCE(l.amount, l.nominal) as nominal FROM ar_advance_lines l JOIN ar_advances a ON a.id = l.ar_advance_id AND (a.status = 'active' OR a.status IS NULL) WHERE l.account_id = ? AND a.tanggal >= ? AND a.tanggal <= ? ORDER BY a.tanggal, a.id", params: [1, '2026-06-01', '2026-06-30'], label: "ar advances" },
      { sql: "SELECT j.journal_date as tgl, j.journal_number as ref, COALESCE(d.notes, j.notes, j.journal_number) as deskripsi, d.debit, d.credit FROM memorial_journal_details d JOIN memorial_journals j ON j.id = d.memorial_journal_id AND j.status = 'active' WHERE d.account_id = ? AND j.journal_date >= ? AND j.journal_date <= ? ORDER BY j.journal_date, j.id", params: [1, '2026-06-01', '2026-06-30'], label: "memorial journals" },
      { sql: "SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE id = ?", params: [1], label: "single account" },
    ]);

    // ---- ROUTE: /api/reports/kartu-kas-bank/export ----
    console.log(`\n  📁 /api/reports/kartu-kas-bank/export`);
    console.log(`    ⚠️  Delegates to /api/reports/kartu-kas-bank via fetch - no direct SQL`);

    // ---- ROUTE: /api/reports/kartu-uang-muka-supplier ----
    const apAdvCols = await getColumns('ap_advances');
    const totalCol = hasCol(apAdvCols, 'total_amount') ? 'total_amount' : 'total';
    await testRoute('/api/reports/kartu-uang-muka-supplier', [
      { sql: "SELECT DISTINCT s.id, s.name FROM master_supplier s WHERE s.id IN (SELECT supplier_id FROM ap_advances WHERE status = 'active') ORDER BY s.name", params: [], label: "suppliers" },
      { sql: "SELECT id, name FROM master_supplier WHERE id = ?", params: [1], label: "single supplier" },
      { sql: "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'ap_advances' AND table_schema = 'public'", params: [], label: "ap_advances schema" },
      { sql: `SELECT COALESCE(SUM(${totalCol}), 0) as total FROM ap_advances WHERE tanggal <= ? AND tanggal >= '2000-01-01' AND supplier_id = ? AND status = 'active'`, params: ['2026-06-09', 1], label: "before created" },
      { sql: "SELECT COALESCE(SUM(pi.pay_amount), 0) as total FROM ap_payment_items pi JOIN ap_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ap_advance' AND p.payment_date <= ? AND p.payment_date >= '2000-01-01' AND p.supplier_id = ? AND p.status = 'active'", params: ['2026-06-09', 1], label: "before used" },
      { sql: `SELECT tanggal as tdate, kode_nota as source_number, COALESCE(notes, 'uang muka supplier') as description, ${totalCol} as debit, 0 as kredit FROM ap_advances WHERE tanggal >= ? AND tanggal <= ? AND supplier_id = ? AND status = 'active' AND ${totalCol} > 0`, params: ['2026-06-01', '2026-06-30', 1], label: "period advances" },
      { sql: "SELECT p.payment_date as tdate, p.payment_number as source_number, 'pakai uang muka' as description, 0 as debit, pi.pay_amount as kredit FROM ap_payment_items pi JOIN ap_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ap_advance' AND p.payment_date >= ? AND p.payment_date <= ? AND p.supplier_id = ? AND p.status = 'active' AND pi.pay_amount > 0", params: ['2026-06-01', '2026-06-30', 1], label: "period usage" },
    ]);

    // ---- ROUTE: /api/reports/kartu-uang-muka-customer ----
    const arAdvCols = await getColumns('ar_advances');
    const arTotalCol = hasCol(arAdvCols, 'total_amount') ? 'total_amount' : 'total';
    await testRoute('/api/reports/kartu-uang-muka-customer', [
      { sql: "SELECT DISTINCT c.id, c.name FROM master_customer c WHERE c.id IN (SELECT customer_id FROM ar_advances WHERE status = 'active') ORDER BY c.name", params: [], label: "customers" },
      { sql: "SELECT id, name FROM master_customer WHERE id = ?", params: [1], label: "single customer" },
      { sql: "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'ar_advances' AND table_schema = 'public'", params: [], label: "ar_advances schema" },
      { sql: `SELECT COALESCE(SUM(${arTotalCol}), 0) as total FROM ar_advances WHERE tanggal <= ? AND tanggal >= '2000-01-01' AND customer_id = ? AND status = 'active'`, params: ['2026-06-09', 1], label: "before created" },
      { sql: "SELECT COALESCE(SUM(pi.pay_amount), 0) as total FROM ar_payment_items pi JOIN ar_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ar_advance' AND p.payment_date <= ? AND p.payment_date >= '2000-01-01' AND p.customer_id = ? AND p.status = 'active'", params: ['2026-06-09', 1], label: "before used" },
      { sql: `SELECT tanggal as tdate, kode_nota as source_number, COALESCE(notes, 'uang muka customer') as description, 0 as debit, ${arTotalCol} as kredit FROM ar_advances WHERE tanggal >= ? AND tanggal <= ? AND customer_id = ? AND status = 'active' AND ${arTotalCol} > 0`, params: ['2026-06-01', '2026-06-30', 1], label: "period advances" },
      { sql: "SELECT p.payment_date as tdate, p.payment_number as source_number, 'pakai uang muka' as description, pi.pay_amount as debit, 0 as kredit FROM ar_payment_items pi JOIN ar_payments p ON p.id = pi.payment_id WHERE pi.source_type = 'ar_advance' AND p.payment_date >= ? AND p.payment_date <= ? AND p.customer_id = ? AND p.status = 'active' AND pi.pay_amount > 0", params: ['2026-06-01', '2026-06-30', 1], label: "period usage" },
    ]);

    // ---- ROUTE: /api/reports/konversi-stok ----
    await testRoute('/api/reports/konversi-stok', [
      { sql: "SELECT DISTINCT m.barang_id AS id, m.barang_code AS code, m.barang_name AS name FROM manufaktur m ORDER BY m.barang_name ASC", params: [], label: "barang hasil" },
      { sql: "SELECT id, code, name FROM master_gudang WHERE COALESCE(isdelete,0)=0 ORDER BY code ASC", params: [], label: "warehouses" },
      { sql: "SELECT m.id, m.nomor, m.tanggal, m.barang_id, m.barang_code, m.barang_name, m.quantity, m.status, m.notes, m.warehouse_id, g.code AS gudang_code, g.name AS gudang_name, m.hpp_sebelum, m.hpp_sesudah, m.total_biaya_bahan, m.total_biaya_lain, m.total_biaya, m.user_create, u.name AS user_name, m.created_at, m.approved_at, (SELECT COUNT(*) FROM manufaktur_detail md WHERE md.manufaktur_id = m.id) AS jumlah_komponen FROM manufaktur m LEFT JOIN master_gudang g ON g.id = m.warehouse_id LEFT JOIN users u ON u.id = m.user_create ORDER BY m.tanggal DESC, m.nomor DESC", params: [], label: "manufaktur list" },
    ]);

    // ---- ROUTE: /api/reports/inventory-valuation ----
    const smCols = await getColumns('stock_movements');
    console.log(`\n  📁 /api/reports/inventory-valuation`);
    if (hasCol(smCols, 'balance_qty') && hasCol(smCols, 'balance_avg_cost')) {
      const r = await q(`WITH mv AS (SELECT sm.*, COALESCE(sm.transaction_date, sm.created_at::text) AS tx_date FROM stock_movements sm), latest AS (SELECT m.* FROM mv m JOIN (SELECT ingredient_id, warehouse_id, MAX(tx_date) AS max_date FROM mv WHERE DATE(tx_date) <= DATE($1::date) GROUP BY ingredient_id, warehouse_id) t ON t.ingredient_id = m.ingredient_id AND t.warehouse_id = m.warehouse_id AND t.max_date = m.tx_date) SELECT l.ingredient_id AS barang_id, l.warehouse_id, b.code AS barang_code, b.name AS barang_name, b.jenis AS barang_jenis, COALESCE(l.balance_qty, 0) AS quantity, COALESCE(l.balance_avg_cost, 0) AS avg_cost, COALESCE(l.balance_cost, COALESCE(l.balance_qty,0) * COALESCE(l.balance_avg_cost,0)) AS value FROM latest l JOIN master_barang b ON b.id = l.ingredient_id WHERE b.jenis IN (1,2,3) ORDER BY b.name ASC`, ['2026-06-30']);
      console.log(`    ✅ main query: ${r.rows.length} rows`);
    } else if (hasCol(smCols, 'id')) {
      // stock_movements exists but no balance columns - basic count
      const r = await q("SELECT COUNT(*)::int as cnt FROM stock_movements");
      console.log(`    ⚠️  stock_movements has no balance_qty/balance_avg_cost columns (${r.rows[0].cnt} rows)`);
    } else {
      console.log(`    ⚠️  stock_movements table missing or incomplete`);
    }

    // === *-report/ routes ===
    await testRoute('/api/usage-report', [
      { sql: "SELECT br.ingredient_id, ib.code as ingredient_code, ib.name as ingredient_name, br.unit as base_unit, ib.hpp as ingredient_hpp, SUM(br.quantity * ti.quantity) as total_used, (SUM(br.quantity * ti.quantity) * COALESCE(ib.hpp, 0)) as total_hpp_used FROM transactions t JOIN transaction_items ti ON t.id = ti.transaction_id JOIN barang_recipes br ON ti.barang_id = br.barang_id LEFT JOIN master_barang ib ON br.ingredient_id = ib.id WHERE 1=1 AND COALESCE(t.status, '') NOT IN ('void', 'cancelled') GROUP BY br.ingredient_id, ib.code, ib.name, br.unit, ib.hpp ORDER BY total_used DESC", params: [], label: "usage summary" },
    ]);

    await testRoute('/api/purchase-recap-report', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'", params: [], label: "purchases cols" },
      { sql: "SELECT p.id, p.purchase_number AS transaction_number, DATE(COALESCE(p.purchase_date, p.created_at::text)) AS transaction_date, COALESCE(s.name, '-') AS supplier_name, CASE WHEN COALESCE(p.is_return, 0) = 1 THEN 'Retur Pembelian' ELSE 'Pembelian' END AS purchase_type, COALESCE(p.subtotal, 0) AS subtotal, COALESCE(p.discount_percent, 0) AS discount_percent, COALESCE(p.discount_amount, 0) AS discount_amount, COALESCE(p.ppn_amount, 0) AS ppn_amount, COALESCE(p.total, 0) AS total FROM purchases p LEFT JOIN master_supplier s ON p.supplier_id = s.id WHERE COALESCE(p.void, 0) = 0 ORDER BY COALESCE(p.purchase_date, p.created_at::text) DESC, p.purchase_number DESC", params: [], label: "purchase recap" },
    ]);

    await testRoute('/api/purchase-detail-report', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases'", params: [], label: "purchases cols" },
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_items'", params: [], label: "pi cols" },
    ]);

    await testRoute('/api/po-recap-report', [
      { sql: "SELECT po.id, po.po_number AS transaction_number, DATE(po.order_date) AS transaction_date, po.expected_date, COALESCE(s.name, po.supplier_name, '-') AS supplier_name, po.po_status, COALESCE(po.subtotal, 0) AS subtotal, COALESCE(po.discount_percent, 0) AS discount_percent, COALESCE(po.discount_amount, 0) AS discount_amount, COALESCE(po.ppn_amount, 0) AS ppn_amount, COALESCE(po.total, 0) AS total FROM purchase_orders po LEFT JOIN master_supplier s ON po.supplier_id = s.id WHERE COALESCE(po.void, 0) = 0 ORDER BY po.order_date DESC, po.po_number DESC", params: [], label: "po recap" },
    ]);

    await testRoute('/api/po-detail-report', [
      { sql: "SELECT po.id as po_id, po.po_number as po_number, DATE(po.order_date) as po_date, po.expected_date, po.po_status, COALESCE(s.name, po.supplier_name, '-') as supplier_name, COALESCE(mb.name, pi.barang_name, '-') as item_name, COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.unit_name, '') as unit, COALESCE(pi.unit_price, 0) as unit_price, COALESCE(pi.discount_percent, 0) as discount_percent, COALESCE(pi.discount_amount, 0) as discount_total, COALESCE(pi.total_price, 0) as subtotal, COALESCE(pi.received_qty, 0) as received_qty FROM purchase_orders po JOIN purchase_order_items pi ON po.id = pi.po_id LEFT JOIN master_supplier s ON po.supplier_id = s.id LEFT JOIN master_barang mb ON mb.id = pi.barang_id WHERE COALESCE(po.void, 0) = 0 ORDER BY po.order_date DESC, po.po_number DESC, pi.id ASC", params: [], label: "po detail" },
    ]);

    await testRoute('/api/po-realization-report', [
      { sql: "SELECT po.id as po_id, po.po_number as po_number, DATE(po.order_date) as po_date, po.expected_date, po.po_status, COALESCE(s.name, po.supplier_name, '-') as supplier_name, COALESCE(mb.name, pi.barang_name, '-') as item_name, COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.unit_name, '') as unit, COALESCE(pi.received_qty, 0) as received_qty, (COALESCE(pi.quantity, 0) - COALESCE(pi.received_qty, 0)) as outstanding_qty FROM purchase_orders po JOIN purchase_order_items pi ON po.id = pi.po_id LEFT JOIN master_supplier s ON po.supplier_id = s.id LEFT JOIN master_barang mb ON mb.id = pi.barang_id WHERE COALESCE(po.void, 0) = 0 AND COALESCE(pi.received_qty, 0) > 0 ORDER BY po.order_date DESC, po.po_number DESC, pi.id ASC", params: [], label: "po realization" },
    ]);

    await testRoute('/api/po-outstanding-report', [
      { sql: "SELECT po.id as po_id, po.po_number as po_number, DATE(po.order_date) as po_date, po.expected_date, po.po_status, COALESCE(s.name, po.supplier_name, '-') as supplier_name, COALESCE(mb.name, pi.barang_name, '-') as item_name, COALESCE(pi.quantity, 0) as quantity, COALESCE(pi.unit_name, '') as unit, COALESCE(pi.received_qty, 0) as received_qty, (COALESCE(pi.quantity, 0) - COALESCE(pi.received_qty, 0)) as outstanding_qty FROM purchase_orders po JOIN purchase_order_items pi ON po.id = pi.po_id LEFT JOIN master_supplier s ON po.supplier_id = s.id LEFT JOIN master_barang mb ON mb.id = pi.barang_id WHERE COALESCE(po.void, 0) = 0 AND (COALESCE(pi.quantity, 0) - COALESCE(pi.received_qty, 0)) > 0 ORDER BY po.order_date DESC, po.po_number DESC, pi.id ASC", params: [], label: "po outstanding" },
    ]);

    // sales-recap-report with dynamic column discovery
    await testRoute('/api/sales-recap-report', [
      { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'", params: [], label: "tx columns" },
    ]);

    await testRoute('/api/sales-detail-report', [
    ]);

    await testRoute('/api/sales-ingredient-report', [
      { sql: "SELECT t.id as transaction_id, t.transaction_number, DATE(t.created_at) as transaction_date, ti.barang_id, ti.barang_code, ti.barang_name, ti.quantity as product_qty, br.ingredient_id, ib.code as ingredient_code, ib.name as ingredient_name, br.quantity as recipe_qty, br.unit as base_unit, COALESCE(ib.hpp, 0) as ingredient_hpp, (br.quantity * ti.quantity) as ingredient_used, (br.quantity * ti.quantity * COALESCE(ib.hpp, 0)) as total_hpp FROM transactions t JOIN transaction_items ti ON t.id = ti.transaction_id JOIN barang_recipes br ON ti.barang_id = br.barang_id LEFT JOIN master_barang ib ON br.ingredient_id = ib.id WHERE 1=1 AND COALESCE(t.status, '') NOT IN ('void', 'cancelled') ORDER BY t.transaction_number, ti.barang_name, ib.name", params: [], label: "sales ingredient" },
    ]);

    await testRoute('/api/payment-recap-report', [
      { sql: "SELECT p.id, p.payment_number, p.payment_date, p.total, p.status, p.notes, s.name AS supplier_name FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id WHERE 1=1 ORDER BY p.payment_date DESC, p.payment_number DESC", params: [], label: "payment recap" },
    ]);

    await testRoute('/api/payment-recap-ar-report', [
      { sql: "SELECT p.id, p.payment_number, p.payment_date, p.total, p.status, p.notes, s.name AS supplier_name FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id WHERE 1=1 ORDER BY p.payment_date DESC, p.payment_number DESC", params: [], label: "payment recap AR" },
    ]);

    await testRoute('/api/payment-detail-report', [
      { sql: "SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.status, p.notes AS payment_notes, s.name AS supplier_name, pi.purchase_id, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks, pm.account_id, a.name AS account_name, pm.amount AS method_amount FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id LEFT JOIN ap_payment_items pi ON pi.payment_id = p.id LEFT JOIN ap_payment_methods pm ON pm.payment_id = p.id LEFT JOIN accounts a ON a.id = pm.account_id WHERE 1=1 AND p.status = 'active' ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id", params: [], label: "payment detail" },
    ]);

    await testRoute('/api/payment-detail-ar-report', [
      { sql: "SELECT p.id AS payment_id, p.payment_number, p.payment_date, p.notes, p.status, p.total AS payment_amount, s.name AS supplier_name, pi.purchase_id, pi.invoice_number, pi.due_amount, pi.pay_amount, pi.remarks AS item_remarks, pm.account_id, a.name AS account_name, pm.amount AS method_amount FROM ap_payments p LEFT JOIN master_supplier s ON s.id = p.supplier_id LEFT JOIN ap_payment_items pi ON pi.payment_id = p.id LEFT JOIN ap_payment_methods pm ON pm.payment_id = p.id LEFT JOIN accounts a ON a.id = pm.account_id WHERE 1=1 ORDER BY p.payment_date DESC, p.payment_number DESC, pi.id, pm.id", params: [], label: "payment detail AR" },
    ]);

  } finally {
    await client.end();
  }

  console.log('\n' + '='.repeat(90));
  console.log('  TESTING COMPLETE');
  console.log('='.repeat(90));
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
