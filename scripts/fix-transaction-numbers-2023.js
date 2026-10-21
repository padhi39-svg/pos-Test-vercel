const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function ensureTglNota(db) {
  const cols = db.prepare("PRAGMA table_info('transactions')").all();
  const has = (n) => cols.some((c) => String(c.name).toLowerCase() === String(n).toLowerCase());
  if (!has('tgl_nota')) {
    try { db.prepare('ALTER TABLE transactions ADD COLUMN tgl_nota TEXT').run(); } catch {}
  }
  // Backfill from legacy or created_at
  try {
    const colsAfter = db.prepare("PRAGMA table_info('transactions')").all();
    const names = new Set(colsAfter.map((c) => c.name));
    if (names.has('Tgl_Nota')) {
      db.prepare('UPDATE transactions SET tgl_nota = COALESCE(tgl_nota, Tgl_Nota)').run();
    }
    if (names.has('transaction_date')) {
      db.prepare('UPDATE transactions SET tgl_nota = COALESCE(tgl_nota, transaction_date)').run();
    }
    // Fallback from created_at date part
    db.prepare("UPDATE transactions SET tgl_nota = COALESCE(tgl_nota, substr(created_at,1,10))").run();
  } catch (e) {
    console.warn('Backfill tgl_nota warn:', e.message || e);
  }
}

function parseNumberParts(str) {
  // Expect <PREFIX>/<YYYY>/<SEQ>
  if (!str) return null;
  const m = String(str).match(/^([^\/]+)\/(\d{4})\/(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], year: m[2], seq: m[3] };
}

function pad6(n) { return String(n).padStart(6, '0'); }

function run({ dryRun = false, dbPath: dbPathOpt, targetYear: yearOpt, prefix: prefixOpt, mode: modeOpt } = {}) {
  // Determine DB path
  let dbPath = dbPathOpt;
  if (!dbPath) {
    const webDb = path.resolve(process.cwd(), 'web', 'data', 'resto-system.db');
    const rootDb = path.resolve(process.cwd(), 'data', 'resto-system.db');
    if (fs.existsSync(webDb)) dbPath = webDb; else dbPath = rootDb;
  }
  // Ensure directory exists only if targeting root data
  const dir = path.dirname(dbPath);
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
  console.log('Using DB:', dbPath);
  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');

    ensureTglNota(db);

    // Determine target year & prefix
    const nowY = new Date().getFullYear();
    const targetYear = Number(yearOpt || 2023) || nowY;
    const defaultPrefix = String(prefixOpt || 'JL');
    const mode = (String(modeOpt || 'by-date')).toLowerCase(); // 'by-date' | 'by-id'

    // Ensure backup column exists
    try {
      const tcols = db.prepare("PRAGMA table_info('transactions')").all();
      const hasBackup = tcols.some((c) => String(c.name).toLowerCase() === 'old_transaction_number');
      if (!hasBackup) {
        db.prepare('ALTER TABLE transactions ADD COLUMN old_transaction_number TEXT').run();
      }
    } catch (e) { console.warn('Backup column warn:', e.message || e); }

    // Build year range and soft-delete awareness
    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31`;
    const tcols = db.prepare("PRAGMA table_info('transactions')").all();
    const hasIsDelete = tcols.some((c) => String(c.name).toLowerCase() === 'isdelete');
    const whereDelete = hasIsDelete ? 'AND COALESCE(isdelete,0)=0' : '';

    // Load transactions for target year (order configurable)
    const orderClause = mode === 'by-id'
      ? 'ORDER BY id ASC'
      : 'ORDER BY COALESCE(tgl_nota, substr(created_at,1,10)) ASC, created_at ASC, id ASC'
    const rows = db.prepare(`
      SELECT id, transaction_number, tgl_nota, created_at
      FROM transactions
      WHERE DATE(COALESCE(tgl_nota, substr(created_at,1,10))) BETWEEN DATE(?) AND DATE(?)
      ${whereDelete}
      ${orderClause}
    `).all(startDate, endDate);

    if (rows.length === 0) {
      console.log(`No transactions found in year ${targetYear}. Nothing to do.`);
      return;
    }

    // Group by prefix
    const groups = new Map(); // prefix -> { rows: [], startSeq }
    for (const r of rows) {
      const parts = parseNumberParts(r.transaction_number);
      const pfx = parts ? parts.prefix : defaultPrefix;
      if (!groups.has(pfx)) groups.set(pfx, { rows: [], startSeq: 0 });
      groups.get(pfx).rows.push({ ...r, parts: parts || { prefix: pfx, year: String(targetYear), seq: '0' } });
    }

    // Reset numbering to 0 for the target year per prefix
    for (const [prefix, grp] of groups.entries()) {
      grp.startSeq = 0;
      groups.set(prefix, grp);
    }

    // Preview mapping
    const mapping = [];
    for (const [prefix, grp] of groups.entries()) {
      let next = grp.startSeq;
      for (const r of grp.rows) {
        next += 1;
        const newNo = `${prefix}/${targetYear}/${pad6(next)}`;
        mapping.push({ id: r.id, old: r.transaction_number, now: newNo, prefix });
      }
    }

    console.log('Planned changes:', mapping.length);
    for (const m of mapping.slice(0, 50)) {
      console.log(`ID ${m.id}: ${m.old} -> ${m.now}`);
    }
    if (mapping.length > 50) {
      console.log(`...and ${mapping.length - 50} more`);
    }

    if (dryRun) {
      console.log('Dry-run mode: no changes applied.');
      return;
    }

    // Apply inside a transaction
    const tx = db.transaction(() => {
      const existsStmt = db.prepare('SELECT 1 FROM transactions WHERE transaction_number = ? LIMIT 1');
      const updateStmt = db.prepare(`
        UPDATE transactions
        SET old_transaction_number = COALESCE(old_transaction_number, transaction_number),
            transaction_number = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const m of mapping) {
        // If collision, bump until unique
        let finalNo = m.now;
        let counter = 0;
        while (existsStmt.get(finalNo)) {
          counter += 1;
          const parts = parseNumberParts(finalNo);
          const seqNum = Number(parts?.seq || '0') + 1;
          finalNo = `${parts?.prefix || m.prefix}/${targetYear}/${pad6(seqNum)}`;
          if (counter > 100000) throw new Error('Too many collisions while generating numbers');
        }
        updateStmt.run(finalNo, m.id);
      }
    });

    tx();
    console.log('Fix applied successfully.');
  } finally {
    try { db.close(); } catch {}
  }
}

// CLI support: node fix-transaction-numbers-2023.js [--dry] [--db <path>] [--year <YYYY>] [--prefix <CODE>]
const argv = process.argv.slice(2);
const dry = argv.includes('--dry') || argv.includes('-n');
let dbPathArg = null;
let yearArg = null;
let prefixArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--db' && argv[i+1]) { dbPathArg = argv[i+1]; }
  else if (a.startsWith('--db=')) { dbPathArg = a.slice(5); }
  else if (a === '--year' && argv[i+1]) { yearArg = argv[i+1]; }
  else if (a.startsWith('--year=')) { yearArg = a.slice(7); }
  else if (a === '--prefix' && argv[i+1]) { prefixArg = argv[i+1]; }
  else if (a.startsWith('--prefix=')) { prefixArg = a.slice(9); }
}
run({ dryRun: dry, dbPath: dbPathArg, targetYear: yearArg, prefix: prefixArg });
