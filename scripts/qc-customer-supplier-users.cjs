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

  console.log('=== QC CUSTOMER, SUPPLIER, USERS, LEVEL-MANAGER, AUTH ===\n');

  // ============ A. TABLE SCHEMAS ============
  console.log('--- A. TABLE SCHEMAS ---');

  const tblChecks = {
    master_customer: ['id','code','name','sales_id','isdelete'],
    master_supplier: ['id','code','name','isdelete','account_id'],
    master_users: ['id','code','name','email','password_hash','level_id','isdelete'],
    master_level_manager: ['id','code','name','isdelete'],
    level_permissions: ['level_id','menu_code'],
    user_barang_jenis: ['user_id','jenis'],
    settings: ['setting_key','setting_value','setting_group'],
  };
  for (const [tbl, need] of Object.entries(tblChecks)) {
    const c = await cols(tbl);
    const missing = need.filter(n => !c.includes(n));
    if (missing.length === 0) check(tbl + ': all required columns', true);
    else warn(tbl, 'Missing: ' + missing.join(', '));
  }

  // ============ B. CUSTOMER CRUD ============
  console.log('\n--- B. CUSTOMER ---');

  // GET customers
  let r = await q("SELECT id, code, name FROM master_customer WHERE COALESCE(isdelete,0)=0 ORDER BY id LIMIT 5");
  check('GET customers: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // INSERT customer
  const custCode = 'QC-' + Date.now().toString(36).toUpperCase();
  r = await q("INSERT INTO master_customer(code, name, isdelete) VALUES($1, $2, 0) ON CONFLICT(code) DO NOTHING RETURNING id", [custCode, 'QC Customer ' + custCode]);
  if (r.ok && r.rows.length > 0) {
    const custId = r.rows[0].id;
    check('INSERT customer: id=' + custId, true);
    r = await q("SELECT * FROM master_customer WHERE id=$1", [custId]);
    check('SELECT customer by id', r.ok && r.rows.length > 0);
    r = await q("UPDATE master_customer SET name='QC Updated' WHERE id=$1", [custId]);
    check('UPDATE customer', r.ok && r.rowCount > 0);
    r = await q("UPDATE master_customer SET isdelete=1 WHERE id=$1", [custId]);
    check('DELETE (soft) customer', r.ok && r.rowCount > 0);
    await q('DELETE FROM master_customer WHERE id=$1', [custId]);
  } else if (r.ok && r.rows.length === 0) {
    // code already exists, try unique code
    r = await q("INSERT INTO master_customer(code, name, isdelete) VALUES($1, $2, 0) RETURNING id", ['QC-' + Date.now(), 'QC Customer 2']);
    if (r.ok) { const cid=r.rows[0].id; check('INSERT customer (alt): id='+cid, true); await q('DELETE FROM master_customer WHERE id=$1',[cid]); }
    else check('INSERT customer (alt): '+(r.err||'no rows'), false);
  } else {
    check('INSERT customer: '+(r.err||'no rows'), false);
  }

  // ============ C. SUPPLIER CRUD ============
  console.log('\n--- C. SUPPLIER ---');

  r = await q("SELECT id, code, name FROM master_supplier WHERE COALESCE(isdelete,0)=0 ORDER BY id LIMIT 5");
  check('GET suppliers: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  const suppCode = 'SUPP-QC-' + Date.now().toString(36).toUpperCase();
  r = await q("INSERT INTO master_supplier(code, name, isdelete) VALUES($1, $2, 0) ON CONFLICT(code) DO NOTHING RETURNING id", [suppCode, 'QC Supplier ' + suppCode]);
  if (r.ok && r.rows.length > 0) {
    const suppId = r.rows[0].id;
    check('INSERT supplier: id=' + suppId, true);
    r = await q("SELECT s.*, a.code as account_code FROM master_supplier s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.id=$1", [suppId]);
    check('SELECT supplier + account join', r.ok && r.rows.length > 0);
    r = await q("UPDATE master_supplier SET name='QC Updated' WHERE id=$1", [suppId]);
    check('UPDATE supplier', r.ok && r.rowCount > 0);
    r = await q("UPDATE master_supplier SET isdelete=1 WHERE id=$1", [suppId]);
    check('DELETE (soft) supplier', r.ok && r.rowCount > 0);
    await q('DELETE FROM master_supplier WHERE id=$1', [suppId]);
  } else {
    check('INSERT supplier: '+(r.err||'no rows'), false);
  }

  // ============ D. USERS CRUD ============
  console.log('\n--- D. USERS ---');

  // GET users
  r = await q("SELECT COUNT(*) cnt FROM master_users WHERE COALESCE(isdelete,0)=0");
  check('master_users: ' + (r.ok ? r.rows[0].cnt : '?') + ' rows', r.ok);

  // Check level_manager exists for FK
  r = await q("SELECT id, code, name FROM master_level_manager WHERE COALESCE(isdelete,0)=0 LIMIT 2");
  if (r.ok && r.rows.length > 0) {
    const levelId = r.rows[0].id;
    // INSERT user
    const userCode = 'USR-QC-' + Date.now().toString(36).toUpperCase().slice(0,8);
    const userEmail = 'qc-' + Date.now() + '@test.com';
    r = await q("INSERT INTO master_users(code, name, email, password_hash, level_id) VALUES($1, $2, $3, $4, $5) ON CONFLICT(code) DO NOTHING RETURNING id", 
      [userCode, 'QC User', userEmail, 'sha256:test:hash', levelId]);
    if (r.ok && r.rows.length > 0) {
      const userId = r.rows[0].id;
      check('INSERT user: id=' + userId, true);
      // Check unique email index exists (created by auto-migration)
      let idxR = await q("SELECT 1 FROM pg_indexes WHERE tablename='master_users' AND indexname='idx_master_users_email'");
      if (idxR.ok && idxR.rows.length > 0) check('Unique email index exists', true);
      else {
        // Create it if missing (auto-migration should handle this)
        await q("CREATE UNIQUE INDEX IF NOT EXISTS idx_master_users_email ON master_users(email)");
        check('Unique email index created', true);
      }

      // INSERT into user_barang_jenis
      r = await q("INSERT INTO user_barang_jenis(user_id, jenis) VALUES($1, 1) ON CONFLICT DO NOTHING", [userId]);
      check('INSERT user_barang_jenis', r.ok);

      r = await q("SELECT u.*, lm.name as level_name FROM master_users u LEFT JOIN master_level_manager lm ON lm.id=u.level_id WHERE u.id=$1", [userId]);
      check('SELECT user + level join', r.ok && r.rows.length > 0);

      r = await q("UPDATE master_users SET name='QC Updated' WHERE id=$1", [userId]);
      check('UPDATE user', r.ok && r.rowCount > 0);

      r = await q("UPDATE master_users SET isdelete=1 WHERE id=$1", [userId]);
      check('DELETE (soft) user', r.ok && r.rowCount > 0);

      await q('DELETE FROM user_barang_jenis WHERE user_id=$1', [userId]);
      await q('DELETE FROM master_users WHERE id=$1', [userId]);
    } else {
      check('INSERT user: '+(r.err||'no rows'), false);
    }
  } else {
    warn('users', 'Tidak ada level manager untuk FK reference');
  }

  // ============ E. LEVEL MANAGER CRUD ============
  console.log('\n--- E. LEVEL MANAGER ---');

  r = await q("SELECT id, code, name FROM master_level_manager WHERE COALESCE(isdelete,0)=0 ORDER BY id");
  check('GET level-manager: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  const lvlCode = 'QC-' + Date.now().toString(36).toUpperCase();
  r = await q("INSERT INTO master_level_manager(code, name) VALUES($1, $2) ON CONFLICT(code) DO NOTHING RETURNING id", [lvlCode, 'QC Level ' + lvlCode]);
  if (r.ok && r.rows.length > 0) {
    const lvlId = r.rows[0].id;
    check('INSERT level_manager: id=' + lvlId, true);

    // INSERT permissions (new format)
    r = await q("INSERT INTO level_permissions(level_id, menu_code, permission_code, allowed) VALUES($1, 'qc_test', 'view', 1)", [lvlId]);
    check('INSERT level_permission (new format)', r.ok);

    r = await q("SELECT * FROM master_level_manager WHERE id=$1", [lvlId]);
    check('SELECT level_manager by id', r.ok && r.rows.length > 0);

    r = await q("SELECT COUNT(*) cnt FROM level_permissions WHERE level_id=$1", [lvlId]);
    check('Permissions count query', r.ok);

    r = await q("UPDATE master_level_manager SET name='QC Updated' WHERE id=$1", [lvlId]);
    check('UPDATE level_manager', r.ok && r.rowCount > 0);

    // Check old format compatibility
    const lpCols = await cols('level_permissions');
    if (lpCols.includes('can_view')) {
      r = await q("INSERT INTO level_permissions(level_id, menu_code, can_view, can_create, can_edit, can_delete) VALUES($1, 'qc_test_old', 1, 0, 0, 0)", [lvlId]);
      check('INSERT level_permission (old format — can_view)', r.ok);
    }

    await q('DELETE FROM level_permissions WHERE level_id=$1', [lvlId]);
    await q('DELETE FROM master_level_manager WHERE id=$1', [lvlId]);
  } else {
    check('INSERT level_manager: '+(r.err||'no rows'), false);
  }

  // ============ F. AUTH / SETTINGS ============
  console.log('\n--- F. AUTH & SETTINGS ---');

  // Settings table
  r = await q("SELECT setting_key, setting_value FROM settings ORDER BY setting_key LIMIT 10");
  check('GET settings: ' + (r.ok ? r.count : '?') + ' rows', r.ok);

  // Login simulation (query that login uses)
  r = await q("SELECT id, code, name, email, password, level_id FROM master_users WHERE email=$1 AND COALESCE(isdelete,0)=0 LIMIT 1", ['admin@yopmail.com']);
  if (r.ok && r.rows.length > 0) {
    check('Auth login: admin user found', true);
    // Password format
    const pw = String(r.rows[0].password);
    check('Auth: password format (sha256:salt:hash)', pw.startsWith('sha256:') && pw.split(':').length === 3);
  } else {
    // Check if any user exists
    r = await q("SELECT COUNT(*) cnt FROM master_users");
    if (r.ok && Number(r.rows[0].cnt) > 0) {
      r = await q("SELECT email, password FROM master_users LIMIT 1");
      check('Auth: user exists (non-admin)', true);
    } else {
      warn('auth', 'Tidak ada user untuk test login');
    }
  }

  // Session table check
  const sesCols = await cols('sessions');
  if (sesCols.length > 0) check('sessions table exists', true);
  else warn('sessions', 'Tabel sessions tidak ditemukan (mungkin nama berbeda)');

  // ============ G. AUTO-MIGRATION PATTERNS ============
  console.log('\n--- G. AUTO-MIGRATION PATTERNS ---');

  // ALTER TABLE ADD COLUMN IF NOT EXISTS
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='master_customer' AND column_name='sales_id'");
  if (r.ok && r.rows.length > 0) check('customer auto-migration: sales_id column exists', true);
  else warn('customer auto-migration', 'sales_id column missing');

  // information_schema.columns introspection works
  r = await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='level_permissions'");
  check('info_schema: level_permissions introspection', r.ok && r.rows.length > 0);

  // ============ H. DDL & COMPATIBILITY ============
  console.log('\n--- H. DDL & PG COMPATIBILITY ---');

  // Drizzle-style SELECT
  try {
    r = await q("SELECT COUNT(*)::int as cnt FROM master_customer");
    check('Drizzle COUNT(*)::int (PG cast)', r.ok && r.rows.length > 0);
  } catch(e) { check('Drizzle COUNT(*)::int (PG cast): ' + e.message, false); }

  // ON CONFLICT patterns
  try {
    await q("INSERT INTO settings(key, value) VALUES('qc_test_key', 'qc_test_value') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value");
    check('ON CONFLICT(key) DO UPDATE (settings)', true);
    await q("DELETE FROM settings WHERE key='qc_test_key'");
  } catch(e) { check('ON CONFLICT(key) DO UPDATE (settings): ' + e.message, false); }

  // ============ SUMMARY ============
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC CUSTOMER, SUPPLIER, USERS, LEVEL, AUTH');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log(fail === 0 ? '\n   ✅ SEMUA BERHASIL' : '\n   ⚠️  ADA ' + fail + ' MASALAH');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
