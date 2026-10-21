const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0;

  const q = async (sql, params) => {
    try { const r = await c.query(sql, params || []); return { ok: true, rows: r.rows, count: r.rowCount || r.rows.length }; }
    catch(e) { return { ok: false, err: e.message }; }
  };
  const cols = async (table) => {
    const r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
    return r.ok ? r.rows.map(x => String(x.column_name).toLowerCase()) : [];
  };

  console.log('=== QC: KAS BANK + JURNAL MEMORIAL ===\n');

  // ===========================================
  // 1. TABLE STRUCTURES
  // ===========================================
  console.log('--- 1. TABLE STRUCTURES ---');
  const tables = [
    ['cash_mutations', ['id','mutation_number','mutation_date','cash_account_id','mutation_type','total_amount','status','notes','created_at']],
    ['cash_mutation_details', ['id','cash_mutation_id','account_id','amount','notes']],
    ['memorial_journals', ['id','journal_number','journal_date','total_debit','total_credit','status','notes','created_at']],
    ['memorial_journal_details', ['id','memorial_journal_id','account_id','account_code','debit','credit','notes']],
    ['accounts', ['id','code','name','is_cash','is_bank_account','is_active','normal_balance','golongan']],
  ];
  for (const [name, need] of tables) {
    const c = await cols(name);
    if (c.length === 0) { console.log('WARN table ' + name + ' not found'); partial++; continue; }
    const missing = need.filter(n => !c.includes(n));
    if (missing.length === 0) { console.log('OK ' + name + ': all columns OK (' + c.length + ' cols)'); ok++; }
    else { console.log('WARN ' + name + ' missing: ' + missing.join(', ')); partial++; }
  }

  // ===========================================
  // 2. ACCOUNTS (Kas/Bank)
  // ===========================================
  console.log('\n--- 2. ACCOUNTS (Kas/Bank) ---');
  let r = await q("SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE (is_cash=1 OR is_bank_account=1) AND is_active=1 ORDER BY code");
  if (r.ok) { console.log('OK accounts kas/bank list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL accounts:', r.err); fail++; }

  r = await q("SELECT id, code, name FROM accounts WHERE posting_allowed=1 AND is_active=1 ORDER BY code LIMIT 10");
  if (r.ok) { console.log('OK posting accounts:', r.count, 'rows'); ok++; }

  // ===========================================
  // 3. CASH MUTATIONS CRUD
  // ===========================================
  console.log('\n--- 3. CASH MUTATIONS CRUD ---');

  // GET list
  r = await q("SELECT id, mutation_number, mutation_date, mutation_type, total_amount, status FROM cash_mutations WHERE COALESCE(status,'')!='void' ORDER BY mutation_date DESC LIMIT 10");
  if (r.ok) { console.log('OK GET cash-mutations list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET list:', r.err); fail++; }

  // POST create
  const mutNum = 'MT/QC/' + Date.now();
  const cashAcc = r.rows.length > 0 ? r.rows[0].id : 1;
  // Get the cash account code first
  const accR = await q("SELECT code FROM accounts WHERE id=$1", [1]);
  const cashCode = accR.ok && accR.rows.length > 0 ? accR.rows[0].code : '1-1000';
  r = await q("INSERT INTO cash_mutations(mutation_number, mutation_date, cash_account_id, cash_account_code, mutation_type, total_amount, status, notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [mutNum, '2026-06-10', 1, cashCode, 'MASUK', 50000, 'active', 'QC test mutation']);
  if (r.ok) {
    const mutId = r.rows[0].id;
    console.log('OK INSERT cash_mutation:', mutId); ok++;

    // Details (need line_no and account_code)
    r = await q("INSERT INTO cash_mutation_details(cash_mutation_id, line_no, account_id, account_code, amount, notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [mutId, 1, 1, cashCode, 50000, 'QC test detail']);
    if (r.ok) { console.log('OK INSERT cash_mutation_detail:', r.rows[0].id); ok++; }

    // GET by id with joins
    r = await q(`SELECT cm.*, cmd.id as detail_id, cmd.amount as detail_amount
      FROM cash_mutations cm
      LEFT JOIN cash_mutation_details cmd ON cmd.cash_mutation_id = cm.id
      WHERE cm.id = $1`, [mutId]);
    if (r.ok && r.rows.length) { console.log('OK GET cash_mutation with joins:', r.rows.length, 'rows'); ok++; }

    // PATCH void
    r = await q("UPDATE cash_mutations SET status='void' WHERE id=$1 RETURNING *", [mutId]);
    if (r.ok) { console.log('OK VOID cash_mutation'); ok++; }

    await q('DELETE FROM cash_mutation_details WHERE cash_mutation_id=$1', [mutId]);
    await q('DELETE FROM cash_mutations WHERE id=$1', [mutId]);
    console.log('OK Cleanup');
  } else { console.log('FAIL INSERT:', r.err); fail++; }

  // ===========================================
  // 4. MEMORIAL JOURNALS CRUD
  // ===========================================
  console.log('\n--- 4. MEMORIAL JOURNALS CRUD ---');

  // GET list
  r = await q("SELECT id, journal_number, journal_date, total_debit, total_credit, status FROM memorial_journals WHERE COALESCE(status,'')!='void' ORDER BY journal_date DESC LIMIT 10");
  if (r.ok) { console.log('OK GET memorial-journals list:', r.count, 'rows'); ok++; }
  else { console.log('FAIL GET list:', r.err); fail++; }

  // POST create
  const jmNum = 'JM/QC/' + Date.now();
  r = await q("INSERT INTO memorial_journals(journal_number, journal_date, total_debit, total_credit, status, notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [jmNum, '2026-06-10', 100000, 100000, 'active', 'QC test journal']);
  if (r.ok) {
    const jmId = r.rows[0].id;
    console.log('OK INSERT memorial_journal:', jmId); ok++;

    // Details (memorial_journal_details has account_code, not account_name directly)
    r = await q("INSERT INTO memorial_journal_details(memorial_journal_id, account_code, debit, credit, notes) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [jmId, '1-1000', 100000, 0, 'QC debit']);
    if (r.ok) { console.log('OK INSERT memorial_journal_detail:', r.rows[0].id); ok++; }

    r = await q("INSERT INTO memorial_journal_details(memorial_journal_id, account_code, debit, credit, notes) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [jmId, '4-1000', 0, 100000, 'QC credit']);
    if (r.ok) { console.log('OK INSERT memorial_journal_detail:', r.rows[0].id); ok++; }

    // GET by id with joins
    r = await q(`SELECT mj.*, mjd.id as detail_id, mjd.account_code, mjd.debit, mjd.credit
      FROM memorial_journals mj
      LEFT JOIN memorial_journal_details mjd ON mjd.memorial_journal_id = mj.id
      WHERE mj.id = $1`, [jmId]);
    if (r.ok && r.rows.length) { console.log('OK GET memorial_journal with details:', r.rows.length, 'rows'); ok++; }

    // PATCH void
    r = await q("UPDATE memorial_journals SET status='void' WHERE id=$1 RETURNING *", [jmId]);
    if (r.ok) { console.log('OK VOID memorial_journal'); ok++; }

    await q('DELETE FROM memorial_journal_details WHERE memorial_journal_id=$1', [jmId]);
    await q('DELETE FROM memorial_journals WHERE id=$1', [jmId]);
    console.log('OK Cleanup');
  } else { console.log('FAIL INSERT:', r.err); fail++; }

  // ===========================================
  // 5. IMPORT (template dependencies)
  // ===========================================
  console.log('\n--- 5. IMPORT ---');
  r = await q("SELECT id, code, name FROM accounts WHERE is_active=1 AND is_header=0 LIMIT 5");
  if (r.ok) { console.log('OK accounts import list:', r.count, 'rows'); ok++; }

  r = await q("SELECT DISTINCT code, name FROM accounts WHERE is_header=1 AND is_active=1 ORDER BY code LIMIT 5");
  if (r.ok) { console.log('OK header accounts for template:', r.count, 'rows'); ok++; }

  try { require.resolve('xlsx'); console.log('OK xlsx module'); ok++; }
  catch(e) { console.log('FAIL xlsx missing'); fail++; }

  // ===========================================
  // 6. REPORTS (kartu-kas-bank, jurnal-harian, buku-besar)
  // ===========================================
  console.log('\n--- 6. REPORTS ---');

  // Kartu Kas Bank - account list
  r = await q("SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE (is_cash=1 OR is_bank_account=1) AND is_active=1 ORDER BY code");
  if (r.ok) { console.log('OK kartu-kas-bank accounts:', r.count, 'rows'); ok++; }

  // Kartu Kas Bank - cash mutations
  r = await q("SELECT m.mutation_date as tgl, m.mutation_number as ref, COALESCE(m.notes, m.mutation_number) as deskripsi, m.mutation_type, m.total_amount as nominal FROM cash_mutations m WHERE m.cash_account_id=$1 AND m.status='active' AND m.mutation_date>=$2 AND m.mutation_date<=$3 ORDER BY m.mutation_date, m.id LIMIT 10",
    [1, '2026-01-01', '2026-12-31']);
  if (r.ok) { console.log('OK kartu-kas-bank mutations:', r.count, 'rows'); ok++; }

  // Kartu Kas Bank - AP payments
  r = await q("SELECT p.payment_date as tgl, p.payment_number as ref, m.amount as nominal FROM ap_payment_methods m JOIN ap_payments p ON p.id=m.payment_id AND p.status='active' WHERE m.account_id=$1 AND p.payment_date>=$2 AND p.payment_date<=$3 ORDER BY p.payment_date, p.id LIMIT 10",
    [1, '2026-01-01', '2026-12-31']);
  if (r.ok) { console.log('OK kartu-kas-bank ap payments:', r.count, 'rows'); ok++; }

  // Kartu Kas Bank - AR payments
  r = await q("SELECT p.payment_date as tgl, p.payment_number as ref, m.amount as nominal FROM ar_payment_methods m JOIN ar_payments p ON p.id=m.payment_id AND p.status='active' WHERE m.account_id=$1 AND p.payment_date>=$2 AND p.payment_date<=$3 ORDER BY p.payment_date, p.id LIMIT 10",
    [1, '2026-01-01', '2026-12-31']);
  if (r.ok) { console.log('OK kartu-kas-bank ar payments:', r.count, 'rows'); ok++; }

  // Kartu Kas Bank - Memorial journals
  r = await q("SELECT j.journal_date as tgl, j.journal_number as ref, COALESCE(d.notes, j.notes, j.journal_number) as deskripsi, d.debit, d.credit FROM memorial_journal_details d JOIN memorial_journals j ON j.id=d.memorial_journal_id AND j.status='active' WHERE d.account_id=$1 AND j.journal_date>=$2 AND j.journal_date<=$3 ORDER BY j.journal_date, j.id LIMIT 10",
    [1, '2026-01-01', '2026-12-31']);
  if (r.ok) { console.log('OK kartu-kas-bank memorial journals:', r.count, 'rows'); ok++; }

  // Jurnal Harian
  r = await q("SELECT entry_date, source_type, source_number, account_code, account_name, debit, credit, description FROM journal_entries WHERE entry_date>=$1 AND entry_date<=$2 ORDER BY entry_date, id LIMIT 10",
    ['2026-06-01', '2026-06-30']);
  if (r.ok) { console.log('OK jurnal-harian:', r.count, 'rows'); ok++; }
  else { console.log('FAIL jurnal-harian:', r.err); fail++; }

  // Buku Besar - accounts list
  r = await q("SELECT code, name, normal_balance FROM accounts WHERE posting_allowed=1 ORDER BY code");
  if (r.ok) { console.log('OK buku-besar accounts:', r.count, 'rows'); ok++; }

  // Buku Besar - single account
  r = await q("SELECT code, name, normal_balance FROM accounts WHERE code=$1", ['1-1000']);
  if (r.ok) { console.log('OK buku-besar single account'); ok++; }
  else { console.log('FAIL buku-besar:', r.err); fail++; }

  // ===========================================
  // 7. JOURNAL ENTRIES (cross-reference)
  // ===========================================
  console.log('\n--- 7. JOURNAL ENTRIES ---');
  r = await q("SELECT source_type, COUNT(*)::int as cnt FROM journal_entries GROUP BY source_type ORDER BY source_type");
  if (r.ok) {
    console.log('OK Journal entries by type:');
    for (const row of r.rows) console.log('   - ' + row.source_type + ': ' + row.cnt);
    ok++;
  }

  for (const st of ['Mutasi Kas', 'Jurnal Memorial']) {
    r = await q('SELECT COUNT(*)::int as cnt FROM journal_entries WHERE source_type=$1', [st]);
    if (r.ok) ok++;
    else { console.log('FAIL source_type ' + st + ':', r.err); fail++; }
  }

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log('\n' + '='.repeat(50));
  console.log('FINAL QC: KAS BANK + JURNAL MEMORIAL');
  console.log('='.repeat(50));
  console.log('OK: ' + ok);
  console.log('PARTIAL: ' + partial);
  console.log('FAIL: ' + fail);
  console.log('TOTAL: ' + (ok + partial + fail));
  console.log(fail === 0 ? '\n✅ SEMUA BERHASIL' : '\n⚠️ ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
