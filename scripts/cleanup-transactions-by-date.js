const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function buildDateExpr(alias = 't') {
  return `CASE WHEN ${alias}.tgl_nota IS NOT NULL AND ${alias}.tgl_nota <> '' THEN ${alias}.tgl_nota
               WHEN ${alias}.transaction_date IS NOT NULL AND ${alias}.transaction_date <> '' THEN ${alias}.transaction_date
               ELSE substr(${alias}.created_at,1,10) END`;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { dryRun: true, dbPath: null, from: null, to: null, onlySales: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.dryRun = false;
    if ((a === '--dry') || (a === '-n')) out.dryRun = true;
    if (a === '--db' && argv[i+1]) out.dbPath = argv[++i];
    else if (a.startsWith('--db=')) out.dbPath = a.slice(5);
    else if (a === '--from' && argv[i+1]) out.from = argv[++i];
    else if (a.startsWith('--from=')) out.from = a.slice(7);
    else if (a === '--to' && argv[i+1]) out.to = argv[++i];
    else if (a.startsWith('--to=')) out.to = a.slice(5);
    else if (a === '--only-sales') out.onlySales = true;
  }
  return out;
}

function resolveDbPath(optPath) {
  if (optPath) return optPath;
  const webDb = path.resolve(process.cwd(), 'web', 'data', 'resto-system.db');
  const rootDb = path.resolve(process.cwd(), 'data', 'resto-system.db');
  return fs.existsSync(webDb) ? webDb : rootDb;
}

function run() {
  const { dryRun, dbPath: dbPathOpt, from, to, onlySales } = parseArgs();
  if (!from || !to) {
    console.log('Usage: node cleanup-transactions-by-date.js --from YYYY-MM-DD --to YYYY-MM-DD [--db <path>] [--apply|--dry]');
    process.exit(1);
  }
  const dbPath = resolveDbPath(dbPathOpt);
  console.log('Using DB:', dbPath);
  console.log('Range   :', from, 'to', to, dryRun ? '(DRY-RUN)' : '(APPLY)');
  if (onlySales) console.log('Filter  : ONLY SALES (exclude returns)');

  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    const dateExpr = buildDateExpr('t');
    // Detect optional is_return column
    let hasIsReturn = false;
    try {
      const tcols = db.prepare("PRAGMA table_info('transactions')").all();
      hasIsReturn = tcols.some(c => String(c.name).toLowerCase() === 'is_return');
    } catch {}

    const condSales = (onlySales && hasIsReturn) ? ' AND COALESCE(t.is_return,0)=0 ' : '';
    const ids = db.prepare(`
      SELECT t.id, t.transaction_number, ${dateExpr} AS eff_date
      FROM transactions t
      WHERE ${dateExpr} BETWEEN ? AND ? ${condSales}
      ORDER BY eff_date ASC, t.created_at ASC, t.id ASC
    `).all(from, to);

    const idList = ids.map(r => r.id);
    const txCount = idList.length;
    const itemCount = txCount === 0 ? 0 : (db.prepare(`SELECT COUNT(*) AS c FROM transaction_items WHERE transaction_id IN (${idList.map(()=>'?').join(',')})`).get(...idList).c || 0);
    const payCount = txCount === 0 ? 0 : (db.prepare(`SELECT COUNT(*) AS c FROM transaction_payments WHERE transaction_id IN (${idList.map(()=>'?').join(',')})`).get(...idList).c || 0);

    console.log('Preview counts:');
    console.log('- transactions      :', txCount);
    console.log('- transaction_items :', itemCount);
    console.log('- transaction_payments:', payCount);

    console.log('Sample (up to 30 rows):');
    ids.slice(0, 30).forEach(r => console.log(`  ID ${r.id} | ${r.transaction_number} | ${r.eff_date}`));
    if (ids.length > 30) console.log(`  ... and ${ids.length - 30} more`);

    if (dryRun || txCount === 0) return;

    const doDelete = db.transaction(() => {
      if (idList.length === 0) return;
      const placeholders = idList.map(()=>'?').join(',');
      db.prepare(`DELETE FROM transaction_payments WHERE transaction_id IN (${placeholders})`).run(...idList);
      db.prepare(`DELETE FROM transaction_items WHERE transaction_id IN (${placeholders})`).run(...idList);
      db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...idList);
    });
    doDelete();
    console.log('Deletion completed successfully.');
  } finally {
    try { db.close(); } catch {}
  }
}

run();
