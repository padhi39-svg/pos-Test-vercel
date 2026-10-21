const XLSX = require('xlsx');

// Semua modul API berdasarkan direktori
const modules = [
  // Sudah di-QC
  { dir: 'stock',          qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'stock-balance',  qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'stock-card',     qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'stock-card-hpp', qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'stock-initial',  qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'stock-opname',   qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'stock-recap-period', qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'stock-simple',   qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'stock-transfers', qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'stock-usage',    qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'stock-views',    qc: '✅', session: '1. Stock', catatan: 'Bug CREATE VIEW IF NOT EXISTS' },
  { dir: 'barang',         qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'barang-hpp',     qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'barang-monthly-hpp', qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'barang-simple',  qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'barang-units',   qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'gudang',         qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'harga',          qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'ingredient',     qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'kategori',       qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'merk',           qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'spesifikasi',    qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'recalc',         qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'recalc-barang-hpp', qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'fix-stock',      qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'periode',        qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'db-status',      qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'init-sqlite',    qc: '✅', session: '1. Stock', catatan: '' },
  { dir: 'accounts',       qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'ar-payments',    qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'ar-advances',    qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'ar-opening-balances', qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'ap-payments',    qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'ap-advances',    qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'ap-opening-balances', qc: '✅', session: '2. AR + Accounts', catatan: '' },
  { dir: 'fiscal',         qc: '✅', session: '3. Fiscal/Keuangan', catatan: '' },
  { dir: 'keuangan',       qc: '✅', session: '3. Fiscal/Keuangan', catatan: '' },
  { dir: 'journal-backfill', qc: '✅', session: '3. Fiscal/Keuangan', catatan: '' },
  { dir: 'customer',       qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'customer-simple', qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'supplier',       qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'users',          qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'level-manager',  qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'auth',           qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'settings',       qc: '✅', session: '4. Customer/Users/Auth', catatan: '' },
  { dir: 'banks',          qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'master-paket',   qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'meja',           qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'floors',         qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'reservations',   qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'cashier-closing', qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'purchases',      qc: '✅', session: '5. Banks/Paket/dll', catatan: 'Bug AUTOINCREMENT' },
  { dir: 'purchase-orders', qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'purchase-requests', qc: '✅', session: '5. Banks/Paket/dll', catatan: '' },
  { dir: 'transactions',   qc: '✅', session: '6. Transaksi/Manufaktur', catatan: 'Bug transaction_date' },
  { dir: 'transactions-simple', qc: '✅', session: '6. Transaksi/Manufaktur', catatan: '' },
  { dir: 'manufaktur',     qc: '✅', session: '6. Transaksi/Manufaktur', catatan: '' },
  { dir: 'cash-mutations', qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'memorial-journals', qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'goods-receipts', qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'sales',          qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'sales-orders',   qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'so',             qc: '✅', session: '7. Batch Final', catatan: 'Bug SO tanpa quote' },
  { dir: 'client-settings', qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'recipes',        qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'setup-units',    qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'init-db',        qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'dashboard',      qc: '✅', session: '7. Batch Final', catatan: '' },
  { dir: 'migrate',        qc: '✅', session: '1. Stock', catatan: 'Survey + fix' },
  { dir: 'test-data',      qc: '✅', session: '1. Stock', catatan: 'Utilitas test' },
  { dir: 'test-product',   qc: '✅', session: '1. Stock', catatan: 'Utilitas test' },
  { dir: 'test-transaction', qc: '✅', session: '1. Stock', catatan: 'Utilitas test' },

  // Sesi 8 — Batch 37 modul
  { dir: 'reports',        qc: '✅', session: '8. Batch 37', catatan: 'Report sub-direktori' },
  { dir: 'payment-detail-ar-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'payment-detail-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'payment-recap-ar-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'payment-recap-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'po-detail-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'po-outstanding-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'po-realization-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'po-recap-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'purchase-detail-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'purchase-recap-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'sales-detail-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'sales-ingredient-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'sales-recap-report', qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'usage-report',   qc: '✅', session: '8. Batch 37', catatan: 'Report' },
  { dir: 'invoices',       qc: '✅', session: '8. Batch 37', catatan: 'Hanya import' },
  { dir: 'fix-purchases',  qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'backup',         qc: '✅', session: '8. Batch 37', catatan: 'Filesystem, no SQL' },
  { dir: 'cleanup',        qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'db',             qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'debug',          qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'local-helper',   qc: '✅', session: '8. Batch 37', catatan: 'No SQL (printer)' },
  { dir: 'master',         qc: '✅', session: '8. Batch 37', catatan: 'Hanya master/supplier' },
  { dir: 'me',             qc: '✅', session: '8. Batch 37', catatan: 'Utilitas kecil' },
  { dir: 'migrate-advances', qc: '✅', session: '8. Batch 37', catatan: 'Migrasi' },
  { dir: 'migrate-all',    qc: '✅', session: '8. Batch 37', catatan: 'Migrasi' },
  { dir: 'migrate-permissions', qc: '✅', session: '8. Batch 37', catatan: 'Migrasi' },
  { dir: 'migrations',     qc: '✅', session: '8. Batch 37', catatan: 'Migrasi' },
  { dir: 'print',          qc: '✅', session: '8. Batch 37', catatan: 'No SQL (ESC/POS)' },
  { dir: 'qz',             qc: '✅', session: '8. Batch 37', catatan: 'No SQL (QZ print)' },
  { dir: 'reset',          qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'reset-db',       qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'restore',        qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'schema-diff',    qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'seed-prices',    qc: '✅', session: '8. Batch 37', catatan: 'Utilitas' },
  { dir: 'upload',         qc: '✅', session: '8. Batch 37', catatan: 'No SQL' },

  // Satu-satunya yang belum
  { dir: 'pos',            qc: '❌', session: '-', catatan: 'Tidak di-QC (atas permintaan)' },
];

// Buat worksheet
const rows = [
  ['No', 'Modul API', 'Status QC', 'Sesi QC', 'Catatan'],
];
modules.forEach((m, i) => {
  rows.push([i + 1, m.dir, m.qc, m.session, m.catatan]);
});

// Summary
const total = modules.length;
const done = modules.filter(m => m.qc === '✅').length;
const notDone = modules.filter(m => m.qc === '❌').length;
rows.push([]);
rows.push(['RINGKASAN', '', '', '', '']);
rows.push(['Total Modul', total, '', '', '']);
rows.push(['Sudah QC', done, '', '', '']);
rows.push(['Belum QC', notDone, '', '', '']);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
ws['!cols'] = [
  { wch: 4 }, { wch: 28 }, { wch: 8 }, { wch: 24 }, { wch: 40 }
];

XLSX.utils.book_append_sheet(wb, ws, 'QC Status');
XLSX.writeFile(wb, 'docs/QC-Status-API.xlsx');
console.log('✅ docs/QC-Status-API.xlsx created');
console.log(`   Total: ${total} modul (✅ ${done} selesai, ❌ ${notDone} belum)`);
