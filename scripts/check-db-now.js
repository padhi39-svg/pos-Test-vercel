const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');
console.log('DB exists:', require('fs').existsSync('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db'));
console.log('snapshot_cache:', db.prepare('SELECT COUNT(*) as c FROM report_snapshot_cache').get().c, 'rows');
console.log('memorial_journals:', db.prepare('SELECT COUNT(*) as c FROM memorial_journals').get().c, 'rows');
console.log('purchases:', db.prepare('SELECT COUNT(*) as c FROM purchases').get().c, 'rows');
console.log('stock_balance:', db.prepare('SELECT COUNT(*) as c FROM stock_balance').get().c, 'rows');

// Direct balance calculation for 130-001-01 from journals
const bal = db.prepare(`
  SELECT COALESCE(SUM(
    CASE WHEN a.normal_balance = 'D' THEN d.debit - d.credit ELSE d.credit - d.debit END
  ), 0) as bal
  FROM memorial_journals j
  JOIN memorial_journal_details d ON d.memorial_journal_id = j.id
  LEFT JOIN accounts a ON a.code = d.account_code
  WHERE j.status = 'active' AND d.account_code = '130-001-01'
`).get();
console.log('130-001-01 from memorial journals:', bal.bal);

// Also check purchase entries
const purchases = db.prepare("SELECT id, subtotal FROM purchases WHERE void = 0").all();
console.log('Purchases:', JSON.stringify(purchases));

// Check report_snapshot_cache content
const snap = db.prepare("SELECT * FROM report_snapshot_cache").all();
console.log('Snapshot content:', snap.length > 0 ? JSON.stringify(snap[0]).slice(0, 200) : 'empty');

db.close();
