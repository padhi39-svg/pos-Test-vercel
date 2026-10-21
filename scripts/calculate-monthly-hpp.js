const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'resto-system.db')
const db = new Database(dbPath)

console.log('🔧 Script: Menghitung HPP Bulanan untuk Barang (Pembelian - Penjualan)')

try {
  // Drop dan buat ulang tabel barang_monthly_hpp dengan struktur baru
  console.log('📊 Re-create tabel barang_monthly_hpp dengan struktur baru...')
  db.exec(`DROP TABLE IF EXISTS barang_monthly_hpp`)
  db.exec(`
    CREATE TABLE barang_monthly_hpp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barang_id INTEGER NOT NULL,
      bulan INTEGER NOT NULL,
      tahun INTEGER NOT NULL,
      pembelian_qty REAL DEFAULT 0,
      pembelian_total REAL DEFAULT 0,
      penjualan_qty REAL DEFAULT 0,
      penjualan_total REAL DEFAULT 0,
      persediaan_awal_qty REAL DEFAULT 0,
      persediaan_awal_value REAL DEFAULT 0,
      persediaan_akhir_qty REAL DEFAULT 0,
      persediaan_akhir_value REAL DEFAULT 0,
      hpp_unit REAL DEFAULT 0,
      hpp_total REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(barang_id, bulan, tahun)
    )
  `)

  // Ambil data barang
  const barangs = db.prepare(`
    SELECT id, name, code
    FROM master_barang
    WHERE id IN (
      SELECT DISTINCT barang_id FROM barang_recipes
    )
  `).all()

  console.log(`📦 Ditemukan ${barangs.length} barang dengan bahan baku`)

  // Ambil semua periode pembelian dan penjualan
  const periodes = db.prepare(`
    SELECT DISTINCT
      strftime('%m', tanggal) as bulan,
      strftime('%Y', tanggal) as tahun
    FROM (
      SELECT purchase_date as tanggal FROM purchases WHERE purchase_date IS NOT NULL
      UNION
      SELECT transaction_date as tanggal FROM transactions WHERE transaction_date IS NOT NULL
    )
    ORDER BY tahun, bulan
  `).all()

  console.log(`📅 Ditemukan ${periodes.length} periode bulan`)

  // Untuk setiap periode
  for (const periode of periodes) {
    const bulan = parseInt(periode.bulan)
    const tahun = parseInt(periode.tahun)

    console.log(`\n🔄 Memproses bulan ${bulan}/${tahun}...`)

    // Ambil persediaan awal (stock awal bulan ini)
    const stockAwalMap = new Map()

    // Cek stock_opname data jika ada (gunakan tabel stock_opname_items)
    const stockOpname = db.prepare(`
      SELECT soi.barang_id, soi.system_qty as stock_qty
      FROM stock_opname_items soi
      JOIN stock_opname so ON soi.opname_id = so.id
      WHERE strftime('%m', so.tdate) = ? AND strftime('%Y', so.tdate) = ?
    `).all(bulan.toString().padStart(2, '0'), tahun.toString())

    for (const row of stockOpname) {
      stockAwalMap.set(row.barang_id, {
        qty: row.stock_qty || 0,
        value: 0 // Hitung HPP berdasarkan rata-rata
      })
    }

    // Hitung persediaan awal dari stock movements jika tidak ada stock opname
    const firstOfMonth = `${tahun}-${bulan.toString().padStart(2, '0')}-01`
    const prevMonth = bulan === 1 ? 12 : bulan - 1
    const prevYear = bulan === 1 ? tahun - 1 : tahun

    for (const barang of barangs) {
      if (stockAwalMap.has(barang.id)) continue

      // Hitung HPP rata-rata barang (berdasarkan recipe/bahan baku)
      const bahanList = db.prepare(`
        SELECT br.ingredient_id, br.qty, mi.harga
        FROM barang_recipes br
        JOIN master_ingredient mi ON br.ingredient_id = mi.id
        WHERE br.barang_id = ?
      `).all(barang.id)

      let hppUnit = 0
      if (bahanList.length > 0) {
        const totalBahanCost = bahanList.reduce((sum, b) => {
          return sum + (b.qty || 0) * (b.harga || 0)
        }, 0)
        hppUnit = totalBahanCost
      }

      // Ambil stock awal dari movements
      const stockAwalRow = db.prepare(`
        SELECT SUM(CASE
          WHEN type = 'IN' THEN qty
          ELSE -qty
        END) as stock_qty
        FROM stock_movements
        WHERE barang_id = ? AND tanggal < ?
      `).get(barang.id, firstOfMonth)

      stockAwalMap.set(barang.id, {
        qty: (stockAwalRow?.stock_qty || 0),
        value: (stockAwalRow?.stock_qty || 0) * hppUnit
      })
    }

    // Hitung pembelian bulanan
    const pembelianMap = new Map()

    const pembelianData = db.prepare(`
      SELECT pi.barang_id, pi.quantity as qty, pi.total_price as total
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE strftime('%m', p.purchase_date) = ? AND strftime('%Y', p.purchase_date) = ?
    `).all(bulan.toString().padStart(2, '0'), tahun.toString())

    for (const row of pembelianData) {
      const barangId = row.barang_id
      if (!pembelianMap.has(barangId)) {
        pembelianMap.set(barangId, { qty: 0, total: 0 })
      }
      const current = pembelianMap.get(barangId)
      current.qty += row.qty || 0
      current.total += row.total || 0
      pembelianMap.set(barangId, current)
    }

    // Hitung penjualan bulanan (dari detail_transaksi)
    const penjualanMap = new Map()

    const penjualanData = db.prepare(`
      SELECT ti.barang_id, SUM(ti.quantity) as total_qty, SUM(ti.total_price) as total_subtotal
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE strftime('%m', t.transaction_date) = ? AND strftime('%Y', t.transaction_date) = ?
      GROUP BY ti.barang_id
    `).all(bulan.toString().padStart(2, '0'), tahun.toString())

    for (const row of penjualanData) {
      const barangId = row.barang_id
      penjualanMap.set(barangId, {
        qty: row.total_qty || 0,
        total: row.total_subtotal || 0
      })
    }

    // Insert data untuk setiap barang
    const insert = db.prepare(`
      INSERT OR REPLACE INTO barang_monthly_hpp (
        barang_id, bulan, tahun,
        pembelian_qty, pembelian_total,
        penjualan_qty, penjualan_total,
        persediaan_awal_qty, persediaan_awal_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const barang of barangs) {
      const pembelian = pembelianMap.get(barang.id) || { qty: 0, total: 0 }
      const penjualan = penjualanMap.get(barang.id) || { qty: 0, total: 0 }
      const persediaanAwal = stockAwalMap.get(barang.id) || { qty: 0, value: 0 }

      // Hitung persediaan akhir
      const persediaanAkhirQty = persediaanAwal.qty + pembelian.qty - penjualan.qty

      // Hitung HPP menggunakan metode rata-rata tertimbang
      let hppUnit = 0
      let hppTotal = 0
      let persediaanAkhirValue = 0

      if (persediaanAwal.qty + pembelian.qty > 0) {
        // Nilai barang yang tersedia = persediaan awal + pembelian
        const totalValue = persediaanAwal.value + pembelian.total
        const totalQty = persediaanAwal.qty + pembelian.qty

        hppUnit = totalValue / totalQty

        // HPP total = HPP unit × qty terjual
        hppTotal = hppUnit * penjualan.qty

        // Nilai persediaan akhir
        persediaanAkhirValue = hppUnit * persediaanAkhirQty
      }

      insert.run(
        barang.id,
        bulan,
        tahun,
        pembelian.qty,
        pembelian.total,
        penjualan.qty,
        penjualan.total,
        persediaanAwal.qty,
        persediaanAwal.value
      )

      // Update persediaan akhir dan HPP
      db.prepare(`
        UPDATE barang_monthly_hpp
        SET persediaan_akhir_qty = ?,
            persediaan_akhir_value = ?,
            hpp_unit = ?,
            hpp_total = ?,
            created_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE barang_id = ? AND bulan = ? AND tahun = ?
      `).run(persediaanAkhirQty, persediaanAkhirValue, hppUnit, hppTotal, barang.id, bulan, tahun)
    }

    console.log(`✅ Bulan ${bulan}/${tahun} selesai`)
  }

  // Summary
  const summary = db.prepare(`
    SELECT bulan, tahun,
           SUM(pembelian_qty) as total_pembelian_qty,
           SUM(pembelian_total) as total_pembelian_value,
           SUM(penjualan_qty) as total_penjualan_qty,
           SUM(penjualan_total) as total_penjualan_value,
           SUM(hpp_total) as total_hpp
    FROM barang_monthly_hpp
    GROUP BY bulan, tahun
    ORDER BY tahun, bulan
  `).all()

  console.log('\n📊 SUMMARY HPP BULANAN:')
  console.log('─'.repeat(100))
  console.log('Bulan    | Pembelian (Qty) | Pembelian (Rp) | Penjualan (Qty) | Penjualan (Rp) | HPP (Rp)')
  console.log('─'.repeat(100))

  for (const row of summary) {
    const bln = row.bulan.toString().padStart(2, '0')
    const thn = row.tahun.toString().slice(-2)
    console.log(`${bln}/${thn}      | ${formatNumber(row.total_pembelian_qty).padStart(15)} | ${formatRupiah(row.total_pembelian_value).padStart(14)} | ${formatNumber(row.total_penjualan_qty).padStart(15)} | ${formatRupiah(row.total_penjualan_value).padStart(14)} | ${formatRupiah(row.total_hpp).padStart(9)}`)
  }

  console.log('─'.repeat(100))

  console.log('\n✅ Selesai! Data HPP bulanan telah disimpan di tabel barang_monthly_hpp')

} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
} finally {
  db.close()
}

function formatNumber(num) {
  return num ? num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'
}

function formatRupiah(num) {
  if (!num) return 'Rp 0'
  return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
