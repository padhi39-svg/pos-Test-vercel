const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'resto-system.db')
const db = new Database(dbPath)

console.log('🔧 Memulai perbaikan kolom total di tabel transactions...')

try {
  // Cek struktur tabel
  const cols = db.prepare(`PRAGMA table_info(transactions)`).all()
  const colNames = new Set(cols.map(c => c.name))
  
  if (!colNames.has('total')) {
    console.error('❌ Kolom "total" tidak ditemukan di tabel transactions')
    process.exit(1)
  }

  // Pastikan kolom-kolom yang dibutuhkan ada (non-destruktif)
  const ensureColumn = (name, sql) => {
    try {
      if (!colNames.has(name)) {
        db.exec(sql)
        console.log('✅ Tambah kolom:', name)
        colNames.add(name)
      }
    } catch (e) {
      console.warn('⚠️  Gagal tambah kolom', name, ':', e && e.message ? e.message : e)
    }
  }

  ensureColumn('discount_amount', `ALTER TABLE transactions ADD COLUMN discount_amount REAL DEFAULT 0`)
  ensureColumn('ppn_amount', `ALTER TABLE transactions ADD COLUMN ppn_amount REAL DEFAULT 0`)
  // service_charge_* opsional, tapi kita siapkan agar POS tidak error
  ensureColumn('service_charge_percent', `ALTER TABLE transactions ADD COLUMN service_charge_percent REAL NOT NULL DEFAULT 0`)
  ensureColumn('service_charge_amount', `ALTER TABLE transactions ADD COLUMN service_charge_amount REAL NOT NULL DEFAULT 0`)

  // Hitung jumlah transaksi
  const countResult = db.prepare(`SELECT COUNT(*) as count FROM transactions`).get()
  const totalRows = countResult.count
  console.log(`📊 Total transaksi: ${totalRows}`)

  // Backup data (opsional, uncomment jika ingin backup)
  // console.log('💾 Membuat backup...')
  // db.exec(`DROP TABLE IF EXISTS transactions_backup_${Date.now()}`)
  // db.exec(`CREATE TABLE transactions_backup_${Date.now()} AS SELECT * FROM transactions`)

  // Cek apakah kolom service_charge_amount ada
  const hasServiceCharge = colNames.has('service_charge_amount')

  // Update total sesuai permintaan:
  // total = subtotal - discount_amount + ppn_amount
  // (service_charge_amount TIDAK dimasukkan di formula; hanya disiapkan agar POS tidak error)
  console.log('⚙️  Menghitung ulang kolom total...')
  
  const updateQuery = `UPDATE transactions 
    SET total = ROUND(
      COALESCE(subtotal, 0) 
      - COALESCE(discount_amount, 0) 
      + COALESCE(ppn_amount, 0)
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE 1=1`
  
  const result = db.prepare(updateQuery).run()
  
  console.log(` Berhasil update ${result.changes} transaksi`)

  // Tampilkan sample hasil
  console.log('\n Sample 5 transaksi terakhir setelah update:')
  const sampleQuery = hasServiceCharge
    ? `SELECT 
        id,
        transaction_number,
        subtotal,
        discount_amount,
        ppn_amount,
        service_charge_amount,
        total,
        (subtotal - COALESCE(discount_amount,0) + COALESCE(ppn_amount,0)) as calculated_total
      FROM transactions 
      ORDER BY id DESC 
      LIMIT 5`
    : `SELECT 
        id,
        transaction_number,
        subtotal,
        discount_amount,
        ppn_amount,
        total,
        (subtotal - COALESCE(discount_amount,0) + COALESCE(ppn_amount,0)) as calculated_total
      FROM transactions 
      ORDER BY id DESC 
      LIMIT 5`
  const sample = db.prepare(sampleQuery).all()
  console.table(sample)

  // Verifikasi: cek apakah ada yang tidak match
  const mismatch = db.prepare(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE ROUND(total) != ROUND(subtotal - COALESCE(discount_amount,0) + COALESCE(ppn_amount,0))
  `).get()

  if (mismatch.count > 0) {
    console.warn(`  Masih ada ${mismatch.count} transaksi dengan total tidak sesuai formula`)
  } else {
    console.log(' Semua transaksi sudah konsisten!')
  }

} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
} finally {
  db.close()
}

console.log('\n✨ Selesai!')
