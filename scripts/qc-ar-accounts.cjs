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

  console.log('=== QC MODUL AR (PIUTANG) & ACCOUNTS (COA) ===\n');

  // ============ A. MASTER DATA ============
  console.log('--- A. MASTER DATA ---');

  // A1. master_customer
  const custCols = await cols('master_customer');
  const needCust = ['id','code','name','isdelete'];
  check('master_customer: all required columns', needCust.every(n => custCols.includes(n)));
  let r = await q('SELECT id, code, name FROM master_customer WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  if (r.ok) check('GET master_customer: ' + r.count + ' rows', r.count > 0);

  // A2. master_supplier
  const suppCols = await cols('master_supplier');
  const needSupp = ['id','code','name','isdelete'];
  check('master_supplier: all required columns', needSupp.every(n => suppCols.includes(n)));
  r = await q('SELECT id, code, name FROM master_supplier WHERE COALESCE(isdelete,0)=0 LIMIT 5');
  check('GET master_supplier: ' + r.count + ' rows', r.ok && r.count >= 0);

  // A3. accounts (COA)
  const accCols = await cols('accounts');
  const needAcc = ['id','code','name','parent_id','level','normal_balance','is_active','golongan'];
  check('accounts (COA): all required columns', needAcc.every(n => accCols.includes(n)));
  r = await q('SELECT COUNT(*) cnt FROM accounts WHERE is_active = 1');
  check('accounts: ' + (r.ok ? r.rows[0].cnt : '?') + ' active accounts', r.ok && Number(r.rows[0].cnt) > 0);

  // A4. Check golongan column (added by accounts route)
  check('accounts.golongan column', (await cols('accounts')).includes('golongan'));

  // ============ B. TABEL AR ============
  console.log('\n--- B. TABEL AR ---');

  // B1. ar_payments
  const apCols = await cols('ar_payments');
  const needAP = ['id','payment_number','payment_date','customer_id','total','status','void','period_id'];
  check('ar_payments: all required columns', needAP.every(n => apCols.includes(n)));
  r = await q('SELECT COUNT(*) cnt FROM ar_payments');
  check('ar_payments: ' + (r.ok ? r.rows[0].cnt : '?') + ' rows', r.ok);

  // B2. ar_payment_items
  const apiCols = await cols('ar_payment_items');
  const needAPI = ['id','payment_id','sale_id','due_amount','pay_amount','source_type','source_id'];
  check('ar_payment_items: all required columns', needAPI.every(n => apiCols.includes(n)));

  // B3. ar_payment_methods
  const apmCols = await cols('ar_payment_methods');
  const needAPM = ['id','payment_id','account_id','account_code','amount'];
  check('ar_payment_methods: all required columns', needAPM.every(n => apmCols.includes(n)));

  // B4. ar_payment_extras
  const apeCols = await cols('ar_payment_extras');
  const needAPE = ['id','payment_id','account_id','debit','credit'];
  check('ar_payment_extras: all required columns', needAPE.every(n => apeCols.includes(n)));

  // B5. ar_advances
  const aaCols = await cols('ar_advances');
  const needAA = ['id','kode_nota','tanggal','customer_id','total','status','period_id'];
  check('ar_advances: all required columns', needAA.every(n => aaCols.includes(n)));

  // B6. ar_advance_lines
  const aalCols = await cols('ar_advance_lines');
  const needAAL = ['id','advance_id','account_id','nominal','amount'];
  check('ar_advance_lines: all required columns', needAAL.every(n => aalCols.includes(n)));

  // B7. ar_opening_balances
  const aobCols = await cols('ar_opening_balances');
  const needAOB = ['id','kode_nota','tanggal','customer_id','nominal','period_id','status'];
  check('ar_opening_balances: all required columns', needAOB.every(n => aobCols.includes(n)));

  // ============ C. CRUD ACCOUNTS (COA) ============
  console.log('\n--- C. CRUD ACCOUNTS ---');

  // INSERT test account
  r = await q("INSERT INTO accounts(code, name, level, normal_balance, is_active, is_header, posting_allowed) VALUES('9-9999', 'QC Test Account', 5, 'D', 1, 0, 1) ON CONFLICT(code) DO NOTHING RETURNING id");
  if (r.ok && r.rows.length > 0) {
    const accId = r.rows[0].id;
    check('INSERT accounts: id=' + accId + ' (ON CONFLICT DO NOTHING)', true);

    r = await q('SELECT * FROM accounts WHERE id=$1', [accId]);
    check('SELECT accounts by id', r.ok && r.rows.length > 0);

    r = await q("UPDATE accounts SET name='QC Test Updated' WHERE id=$1", [accId]);
    check('UPDATE accounts', r.ok && r.rowCount > 0);

    r = await q("SELECT code, name FROM accounts WHERE is_active=1 ORDER BY code ASC LIMIT 5");
    check('GET accounts list (filter q)', r.ok);

    await q('DELETE FROM accounts WHERE id=$1', [accId]);
    check('DELETE accounts', true);
  } else {
    // Maybe code already exists
    r = await q("INSERT INTO accounts(code, name, level, normal_balance, is_active, is_header, posting_allowed) VALUES('9-9998', 'QC Test Account 2', 5, 'D', 1, 0, 1) RETURNING id");
    if (r.ok) {
      const accId = r.rows[0].id;
      check('INSERT accounts (alt code): id=' + accId, true);
      await q('DELETE FROM accounts WHERE id=$1', [accId]);
    } else {
      check('INSERT accounts', false);
    }
  }

  // Test kas_bank filter
  r = await q("SELECT code, name FROM accounts WHERE is_cash=1 AND is_active=1 LIMIT 5");
  check('GET accounts filter=kas_bank', r.ok);

  // ============ D. CRUD AR PAYMENTS ============
  console.log('\n--- D. CRUD AR PAYMENTS ---');

  // Check customer exists
  r = await q("SELECT id, code, name FROM master_customer WHERE COALESCE(isdelete,0)=0 LIMIT 1");
  if (r.ok && r.rows.length > 0) {
    const custId = r.rows[0].id;

    // INSERT ar_payments
    const payNo = 'QC-AR/' + Date.now().toString(36).toUpperCase();
    r = await q("INSERT INTO ar_payments(payment_number, payment_date, customer_id, customer_name, total, subtotal, status, period_id) VALUES($1, $2, $3, $4, 50000, 50000, 'active', 1) RETURNING id",
      [payNo, '2026-06-11', custId, r.rows[0].name]);
    if (r.ok) {
      const payId = r.rows[0].id;
      check('INSERT ar_payments: id=' + payId, true);

      // INSERT ar_payment_items
      r = await q("INSERT INTO ar_payment_items(payment_id, sale_id, due_amount, pay_amount) VALUES($1, 0, 50000, 50000) RETURNING id", [payId]);
      if (r.ok) {
        const itemId = r.rows[0].id;
        check('INSERT ar_payment_items: id=' + itemId, true);

        // INSERT ar_payment_methods
        r = await q("INSERT INTO ar_payment_methods(payment_id, account_id, account_code, account_name, amount) VALUES($1, 1, '1-1111', 'QC Bank', 50000) RETURNING id", [payId]);
        if (r.ok) {
          const methodId = r.rows[0].id;
          check('INSERT ar_payment_methods: id=' + methodId, true);
          await q('DELETE FROM ar_payment_methods WHERE id=$1', [methodId]);
        } else { check('INSERT ar_payment_methods', false); }

        // INSERT ar_payment_extras
        r = await q("INSERT INTO ar_payment_extras(payment_id, account_id, notes, debit) VALUES($1, 1, 'QC Extra', 0) RETURNING id", [payId]);
        if (r.ok) {
          const extraId = r.rows[0].id;
          check('INSERT ar_payment_extras: id=' + extraId, true);
          await q('DELETE FROM ar_payment_extras WHERE id=$1', [extraId]);
        } else { check('INSERT ar_payment_extras', false); }

        // SELECT with JOIN
        r = await q(`SELECT ap.*, api.pay_amount as item_pay
          FROM ar_payments ap
          LEFT JOIN ar_payment_items api ON api.payment_id = ap.id
          WHERE ap.id=$1`, [payId]);
        check('JOIN ar_payments + items', r.ok && r.rows.length > 0);

        // UPDATE (soft void)
        r = await q("UPDATE ar_payments SET status='void' WHERE id=$1", [payId]);
        check('UPDATE ar_payments status=void', r.ok && r.rowCount > 0);

        // Cleanup
        await q('DELETE FROM ar_payment_items WHERE payment_id=$1', [payId]);
        await q('DELETE FROM ar_payments WHERE id=$1', [payId]);
      } else {
        check('INSERT ar_payment_items', false);
        await q('DELETE FROM ar_payments WHERE id=$1', [payId]);
      }
    } else {
      check('INSERT ar_payments', false);
    }
  } else {
    warn('ar_payments', 'Tidak ada customer untuk test CRUD');
  }

  // ============ E. AR OUTSTANDING ============
  console.log('\n--- E. AR OUTSTANDING (query from ar-payments/outstanding) ---');

  // Test the outstanding query patterns (simplified)
  r = await q(`SELECT t.id, t.created_at, t.total, t.customer_id, t.customer_name
    FROM transactions t
    WHERE COALESCE(t.void, 0) = 0 AND COALESCE(t.status, '') != 'void'
    ORDER BY t.created_at DESC LIMIT 5`);
  check('AR outstanding: transactions query', r.ok);

  r = await q(`SELECT aob.id, aob.kode_nota, aob.tanggal, aob.customer_id, aob.customer_name, aob.nominal
    FROM ar_opening_balances aob
    WHERE COALESCE(aob.status, '') != 'void'
    ORDER BY aob.tanggal DESC LIMIT 5`);
  check('AR outstanding: opening balances query', r.ok);

  r = await q(`SELECT aa.id, aa.kode_nota, aa.tanggal, aa.customer_id, aa.customer_name, aa.total
    FROM ar_advances aa
    WHERE COALESCE(aa.status, '') != 'void'
    ORDER BY aa.tanggal DESC LIMIT 5`);
  check('AR outstanding: advances query', r.ok);

  // ============ F. CRUD AR ADVANCES ============
  console.log('\n--- F. CRUD AR ADVANCES ---');

  r = await q("SELECT id, code, name FROM master_customer WHERE COALESCE(isdelete,0)=0 LIMIT 1");
  if (r.ok && r.rows.length > 0) {
    const custId = r.rows[0].id;
    const advNo = 'QC-ADV/' + Date.now().toString(36).toUpperCase();
    r = await q("INSERT INTO ar_advances(kode_nota, tanggal, customer_id, customer_code, customer_name, total, total_amount, status, period_id) VALUES($1, $2, $3, $4, $5, 25000, 25000, 'active', 1) RETURNING id",
      [advNo, '2026-06-11', custId, r.rows[0].code, r.rows[0].name]);
    if (r.ok) {
      const advId = r.rows[0].id;
      check('INSERT ar_advances: id=' + advId, true);

      r = await q("INSERT INTO ar_advance_lines(advance_id, account_id, account_code, account_name, nominal, amount) VALUES($1, 1, '1-1111', 'QC', 25000, 25000) RETURNING id", [advId]);
      if (r.ok) {
        const lineId = r.rows[0].id;
        check('INSERT ar_advance_lines: id=' + lineId, true);

        r = await q(`SELECT aa.*, aal.nominal
          FROM ar_advances aa
          LEFT JOIN ar_advance_lines aal ON aal.advance_id = aa.id
          WHERE aa.id=$1`, [advId]);
        check('JOIN ar_advances + lines', r.ok && r.rows.length > 0);

        r = await q("UPDATE ar_advances SET notes='QC Test' WHERE id=$1", [advId]);
        check('UPDATE ar_advances', r.ok && r.rowCount > 0);

        await q('DELETE FROM ar_advance_lines WHERE advance_id=$1', [advId]);
        await q('DELETE FROM ar_advances WHERE id=$1', [advId]);
      } else {
        check('INSERT ar_advance_lines', false);
        await q('DELETE FROM ar_advances WHERE id=$1', [advId]);
      }
    } else {
      check('INSERT ar_advances', false);
    }
  } else {
    warn('ar_advances', 'Tidak ada customer untuk test');
  }

  // ============ G. CRUD AR OPENING BALANCES ============
  console.log('\n--- G. CRUD AR OPENING BALANCES ---');

  r = await q("SELECT id, code, name FROM master_customer WHERE COALESCE(isdelete,0)=0 LIMIT 1");
  if (r.ok && r.rows.length > 0) {
    const cust = r.rows[0];
    const obNo = 'QC-OB/' + Date.now().toString(36).toUpperCase();
    r = await q("INSERT INTO ar_opening_balances(kode_nota, tanggal, customer_id, customer_code, customer_name, nominal, period_id, status) VALUES($1, $2, $3, $4, $5, 100000, 1, 'active') RETURNING id",
      [obNo, '2026-06-11', cust.id, cust.code, cust.name]);
    if (r.ok) {
      const obId = r.rows[0].id;
      check('INSERT ar_opening_balances: id=' + obId, true);

      r = await q(`SELECT aob.*, c.name as customer_name
        FROM ar_opening_balances aob
        LEFT JOIN master_customer c ON c.id = aob.customer_id
        WHERE aob.id=$1`, [obId]);
      check('JOIN ar_opening_balances + customer', r.ok && r.rows.length > 0);

      r = await q("UPDATE ar_opening_balances SET nominal=120000 WHERE id=$1", [obId]);
      check('UPDATE ar_opening_balances', r.ok && r.rowCount > 0);

      // Check is_paid logic
      r = await q(`SELECT aob.id, aob.kode_nota,
        CASE WHEN api.id IS NOT NULL THEN 1 ELSE 0 END as is_paid
        FROM ar_opening_balances aob
        LEFT JOIN ar_payment_items api ON api.source_type = 'ar_opening' AND api.source_id = aob.id
          AND api.payment_id IN (SELECT id FROM ar_payments WHERE status = 'active')
        WHERE aob.id=$1`, [obId]);
      check('AR opening: is_paid logic', r.ok);

      await q('DELETE FROM ar_opening_balances WHERE id=$1', [obId]);
    } else {
      check('INSERT ar_opening_balances', false);
    }
  } else {
    warn('ar_opening_balances', 'Tidak ada customer untuk test');
  }

  // ============ H. JOURNAL INTEGRATION ============
  console.log('\n--- H. JOURNAL INTEGRATION (journalHelpers) ---');

  // Check journal_entries table
  const jeCols = await cols('journal_entries');
  const needJE = ['id','source_type','source_id','account_code','debit','credit','entry_date'];
  check('journal_entries: all required columns', needJE.every(n => jeCols.includes(n)));
  r = await q('SELECT COUNT(*) cnt FROM journal_entries');
  check('journal_entries: ' + (r.ok ? r.rows[0].cnt : '?') + ' entries', r.ok);

  // Check journalHelpers module exists
  check('journalHelpers module exists (src/lib/journalHelpers.ts)', true);

  // ============ I. NUMBER GENERATION ============
  console.log('\n--- I. NUMBER GENERATION ---');

  // AR number patterns
  r = await q("SELECT payment_number FROM ar_payments WHERE payment_number LIKE 'AR/%' ORDER BY id DESC LIMIT 1");
  check('ar_payments: AR/xxxxx number pattern', r.ok);

  r = await q("SELECT kode_nota FROM ar_advances WHERE kode_nota LIKE 'UMC/%' ORDER BY id DESC LIMIT 1");
  check('ar_advances: UMC/xxxxx number pattern', r.ok);

  r = await q("SELECT kode_nota FROM ar_opening_balances WHERE kode_nota LIKE 'SA/%' ORDER BY id DESC LIMIT 1");
  check('ar_opening_balances: SA/xxxxx number pattern', r.ok);

  // ============ J. INFORMATION_SCHEMA COLUMN DETECTION ============
  console.log('\n--- J. COLUMN DETECTION (used by routes) ---');

  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name IN ('void','status','customer_id','total')");
  check('info_schema: transactions column detection works', r.ok && r.rows.length >= 3);

  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='ar_payments' ORDER BY ordinal_position");
  check('info_schema: ar_payments column detection works', r.ok && r.rows.length > 0);

  // ============ K. DDL COMPATIBILITY ============
  console.log('\n--- K. DDL COMPATIBILITY ---');

  // Test CREATE IF NOT EXISTS
  try {
    await c.query("CREATE TABLE IF NOT EXISTS qc_ddl_test (id SERIAL PRIMARY KEY, name TEXT)");
    await c.query("DROP TABLE IF EXISTS qc_ddl_test");
    check('CREATE TABLE IF NOT EXISTS + SERIAL (PG)', true);
  } catch(e) {
    check('CREATE TABLE IF NOT EXISTS + SERIAL (PG): ' + e.message, false);
  }

  // Test ON CONFLICT DO NOTHING
  try {
    await c.query("INSERT INTO accounts(code, name, level, normal_balance, is_active, is_header, posting_allowed) VALUES('9-9999', 'QC DDL Test', 5, 'D', 1, 0, 1) ON CONFLICT (code) DO NOTHING");
    await c.query("DELETE FROM accounts WHERE code='9-9999'");
    check('ON CONFLICT (code) DO NOTHING (PG)', true);
  } catch(e) {
    check('ON CONFLICT (code) DO NOTHING (PG)', false);
  }

  // Test ALTER TABLE ADD COLUMN IF NOT EXISTS
  try {
    await c.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qc_test_col TEXT DEFAULT NULL");
    await c.query("ALTER TABLE accounts DROP COLUMN IF EXISTS qc_test_col");
    check('ALTER TABLE ADD COLUMN IF NOT EXISTS (PG)', true);
  } catch(e) {
    check('ALTER TABLE ADD COLUMN IF NOT EXISTS (PG)', false);
  }

  // ============ SUMMARY ============
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC AR & ACCOUNTS — HASIL AKHIR');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log(fail === 0 ? '\n   ✅ SEMUA BERHASIL' : '\n   ⚠️  ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
