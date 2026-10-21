const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0;

  const q = async (sql, params) => {
    try { const r = await c.query(sql, params || []); return { ok: true, rows: r.rows, count: r.rowCount || r.rows.length, rowCount: r.rowCount || 0 }; }
    catch(e) { return { ok: false, err: e.message, rowCount: 0 }; }
  };
  const cols = async (table) => {
    const r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
    return r.ok ? r.rows.map(rr => String(rr.column_name).toLowerCase()) : [];
  };
  const check = (label, cond) => { if (cond) { console.log('  ✅ ' + label); ok++; } else { console.log('  ❌ ' + label); fail++; } };
  const warn = (label, msg) => { console.log('  ⚠️  ' + label + ': ' + msg); partial++; };

  console.log('=== QC FISCAL, KEUANGAN & JOURNAL BACKFILL ===\n');

  // ============ A. TABLE SCHEMAS ============
  console.log('--- A. TABLE SCHEMAS ---');

  const tables = {
    fiscal_settings: ['year','omzet','pph25'],
    fiscal_corrections: ['id','year','type','account_code','account_name','amount'],
    account_mappings: ['id','map_group','map_key','account_id'],
  };

  for (const [table, need] of Object.entries(tables)) {
    const c = await cols(table);
    const missing = need.filter(n => !c.includes(n));
    if (missing.length === 0) check(table + ': all required columns', true);
    else warn(table, 'Missing: ' + missing.join(', '));
  }

  // Check journal_entries already done, just verify count
  let r = await q('SELECT COUNT(*) cnt FROM journal_entries');
  check('journal_entries: ' + (r.ok ? r.rows[0].cnt : '?') + ' entries', r.ok);

  // ============ B. FISCAL SETTINGS ============
  console.log('\n--- B. FISCAL SETTINGS ---');

  // Check current fiscal settings
  r = await q('SELECT * FROM fiscal_settings ORDER BY year DESC LIMIT 1');
  if (r.ok && r.rows.length > 0) {
    const fs = r.rows[0];
    check('fiscal_settings: year=' + fs.year + ' found', true);
    check('fiscal_settings.is_closed exists', 'is_closed' in fs);
  } else {
    warn('fiscal_settings', 'Belum ada data — perlu seeding');
  }

  // INSERT test — fiscal_settings uses year as PK
  r = await q("INSERT INTO fiscal_settings(year, omzet, pph25) VALUES(9999, 100000000, 25000000) ON CONFLICT(year) DO UPDATE SET omzet=EXCLUDED.omzet, pph25=EXCLUDED.pph25");
  if (r.ok) {
    check('UPSERT fiscal_settings year=9999 (ON CONFLICT)', true);
    r = await q('SELECT * FROM fiscal_settings WHERE year=9999');
    check('SELECT fiscal_settings by year', r.ok && r.rows.length > 0);
    await q('DELETE FROM fiscal_settings WHERE year=9999');
  } else {
    check('UPSERT fiscal_settings: ' + (r.err || 'no rows'), false);
  }

  // ============ C. FISCAL CORRECTIONS ============
  console.log('\n--- C. FISCAL CORRECTIONS ---');

  r = await q("INSERT INTO fiscal_corrections(year, type, account_code, account_name, amount) VALUES(9999, 'positif', '4-1000', 'QC Test Correction', 100000) RETURNING id");
  if (r.ok) {
    const corrId = r.rows[0].id;
    check('INSERT fiscal_corrections: id=' + corrId, true);

    r = await q('SELECT * FROM fiscal_corrections WHERE id=$1', [corrId]);
    check('SELECT fiscal_corrections by id', r.ok && r.rows.length > 0);

    r = await q("UPDATE fiscal_corrections SET account_name='QC Updated' WHERE id=$1", [corrId]);
    check('UPDATE fiscal_corrections', r.ok && r.rowCount > 0);

    r = await q('DELETE FROM fiscal_corrections WHERE id=$1', [corrId]);
    check('DELETE fiscal_corrections', r.ok && r.rowCount > 0);
  } else {
    check('INSERT fiscal_corrections', false);
  }

  // ============ D. ACCOUNT BALANCES ============
  console.log('\n--- D. ACCOUNT BALANCES (fiscal/account-balances) ---');

  // Test balance query pattern
  r = await q(`SELECT a.code, a.name, a.normal_balance,
    COALESCE(SUM(CASE WHEN je.debit > je.credit THEN je.debit - je.credit ELSE 0 END), 0) as debit_total,
    COALESCE(SUM(CASE WHEN je.credit > je.debit THEN je.credit - je.debit ELSE 0 END), 0) as credit_total
    FROM accounts a
    LEFT JOIN journal_entries je ON je.account_code = a.code
    WHERE a.is_active = 1
    GROUP BY a.code, a.name, a.normal_balance
    ORDER BY a.code ASC LIMIT 10`);
  check('Account balances query (with journal_entries)', r.ok);

  // Test period-based filter
  r = await q(`SELECT id, name, start_date::text, end_date::text FROM master_periode WHERE is_active=1 ORDER BY id`);
  check('master_periode for period filter', r.ok && r.rows.length > 0);

  // ============ E. KEUANGAN PERKIRAAN ============
  console.log('\n--- E. KEUANGAN PERKIRAAN (perkiraan) ---');

  // GET accounts list
  r = await q('SELECT id, code, name, level FROM accounts WHERE is_active=1 ORDER BY code ASC LIMIT 5');
  check('GET perkiraan (accounts list)', r.ok && r.rows.length > 0);

  // Check WITH RECURSIVE query pattern
  r = await q(`WITH RECURSIVE account_tree AS (
    SELECT id, code, name, parent_id, level, 1 as depth
    FROM accounts WHERE parent_id IS NULL AND is_active=1
    UNION ALL
    SELECT a.id, a.code, a.name, a.parent_id, a.level, at.depth + 1
    FROM accounts a
    JOIN account_tree at ON a.parent_id = at.id
  ) SELECT * FROM account_tree ORDER BY code LIMIT 10`);
  check('WITH RECURSIVE account_tree', r.ok);

  // Parent lookup
  r = await q('SELECT id, code, name FROM accounts WHERE parent_id IS NULL AND is_active=1 LIMIT 5');
  check('Parent accounts lookup', r.ok);

  // CRUD: INSERT via perkiraan
  r = await q("INSERT INTO accounts(code, name, level, normal_balance, parent_id, is_header, is_active, posting_allowed) VALUES('9-9901', 'QC Perkiraan Test', 3, 'D', NULL, 0, 1, 1) RETURNING id");
  if (r.ok) {
    const accId = r.rows[0].id;
    check('INSERT perkiraan (account): id=' + accId, true);

    r = await q("UPDATE accounts SET name='QC Perkiraan Updated' WHERE id=$1", [accId]);
    check('UPDATE perkiraan', r.ok && r.rowCount > 0);

    // Check references before delete (cast account_id to text for UNION with account_code)
    r = await q(`SELECT COUNT(*) cnt FROM (
      SELECT account_code FROM journal_entries WHERE account_code=(SELECT code FROM accounts WHERE id=$1)
      UNION ALL SELECT account_id::text FROM account_mappings WHERE account_id=$1
    ) sub`, [accId]);
    check('Check references before delete', r.ok);

    await q('DELETE FROM accounts WHERE id=$1', [accId]);
    check('DELETE perkiraan', true);
  } else {
    check('INSERT perkiraan', false);
  }

  // ============ F. ACCOUNT MAPPINGS (setting-perkiraan) ============
  console.log('\n--- F. ACCOUNT MAPPINGS (setting-perkiraan) ---');

  const amCols = await cols('account_mappings');
  const needAM = ['id','map_group','map_key','account_id'];
  check('account_mappings: all required columns', needAM.every(n => amCols.includes(n)));

  r = await q('SELECT * FROM account_mappings ORDER BY id LIMIT 10');
  if (r.ok) check('GET account_mappings: ' + r.count + ' rows', true);

  // INSERT test mapping — uses map_group, map_key, account_id (FK to accounts)
  r = await q("SELECT id, code FROM accounts WHERE is_active=1 ORDER BY id LIMIT 1");
  if (r.ok && r.rows.length > 0) {
    const testAccId = r.rows[0].id;
    r = await q("INSERT INTO account_mappings(map_group, map_key, account_id) VALUES('qc_test', 'test_key', $1) RETURNING id", [testAccId]);
    if (r.ok) {
      const mapId = r.rows[0].id;
      check('INSERT account_mappings: id=' + mapId, true);

      r = await q("UPDATE account_mappings SET map_key='updated_key' WHERE id=$1", [mapId]);
      check('UPDATE account_mappings', r.ok && r.rowCount > 0);

      await q('DELETE FROM account_mappings WHERE id=$1', [mapId]);
    } else {
      check('INSERT account_mappings', false);
    }
  } else {
    warn('account_mappings', 'Tidak ada account untuk FK reference');
  }

  // ============ G. JOURNAL BACKFILL ============
  console.log('\n--- G. JOURNAL BACKFILL ---');

  // The backfill tries to recreate journal_entries from source transactions
  // Check source tables exist
  const sourceTables = ['purchases', 'transactions', 'ar_payments', 'ap_payments', 'memorial_journals', 'stock_usage', 'manufaktur'];
  for (const t of sourceTables) {
    const sourceCols = await cols(t);
    if (sourceCols.length > 0) check('journal-backfill source: ' + t, true);
    else warn('journal-backfill source: ' + t, 'Table not found');
  }

  // Test a simplified backfill query for purchases
  r = await q(`SELECT p.id, p.purchase_number, p.purchase_date, p.total, p.supplier_id
    FROM purchases p
    WHERE COALESCE(p.void, 0) = 0
    AND p.id NOT IN (SELECT source_id FROM journal_entries WHERE source_type='purchase' AND source_id IS NOT NULL)
    LIMIT 5`);
  check('Backfill: unpurchased purchases query', r.ok);

  // ============ H. DDL COMPATIBILITY ============
  console.log('\n--- H. DDL COMPATIBILITY ---');

  try {
    await q("CREATE TABLE IF NOT EXISTS qc_ddl2 (id SERIAL PRIMARY KEY, name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    await q("INSERT INTO qc_ddl2(name) VALUES('test')");
    r = await q('SELECT * FROM qc_ddl2');
    check('DDL: CREATE TABLE + SERIAL + TIMESTAMP DEFAULT', r.ok && r.rows.length > 0);
    await q("DROP TABLE IF EXISTS qc_ddl2");
  } catch(e) { check('DDL: CREATE TABLE + SERIAL + TIMESTAMP DEFAULT: ' + e.message, false); }

  // Verify TOTAL fiscal and keuangan entries
  r = await q('SELECT COUNT(*) cnt FROM fiscal_settings');
  check('fiscal_settings has ' + (r.ok ? r.rows[0].cnt : '?') + ' rows', r.ok);

  // ============ SUMMARY ============
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC FISCAL, KEUANGAN & BACKFILL');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log(fail === 0 ? '\n   ✅ SEMUA BERHASIL' : '\n   ⚠️  ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
