import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '../data/resto-system.db')
const db = new Database(dbPath)

const seed = db.transaction(() => {
  // Helper: get account id by code
  const accId = (code) => {
    const r = db.prepare('SELECT id FROM accounts WHERE code = ?').get(code)
    if (!r) throw new Error(`Account ${code} not found`)
    return r.id
  }

  // Helper: insert memorial journal
  const insJournal = (date, notes, details) => {
    const totalDebit = details.reduce((s, d) => s + d.debit, 0)
    const totalCredit = details.reduce((s, d) => s + d.credit, 0)
    const num = `MEM-${date.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`
    const r = db.prepare(`
      INSERT INTO memorial_journals (journal_number, journal_date, notes, total_debit, total_credit, status, user_create)
      VALUES (?, ?, ?, ?, ?, 'active', 1)
    `).run(num, date, notes, totalDebit, totalCredit)
    const jId = r.lastInsertRowid
    details.forEach((d, i) => {
      db.prepare(`
        INSERT INTO memorial_journal_details (journal_id, line_no, account_id, account_code, account_name, description, debit, credit, user_create)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(jId, i + 1, d.account_id, d.account_code, d.account_name, d.desc || '', d.debit, d.credit)
    })
  }

  // Clear existing data for a clean seed
  db.prepare('DELETE FROM fiscal_corrections').run()
  db.prepare('DELETE FROM fiscal_settings').run()
  db.prepare('DELETE FROM memorial_journals').run()
  db.prepare('DELETE FROM memorial_journal_details').run()

  // === Journal 1: Revenue (Penjualan) ===
  insJournal('2026-04-01', 'Penjualan bulan April 2026', [
    { account_id: accId('111-002-01'), account_code: '111-002-01', account_name: 'Bank BCA', debit: 100_000_000, credit: 0, desc: 'Penerimaan penjualan' },
    { account_id: accId('410-001-01'), account_code: '410-001-01', account_name: 'Penjualan', debit: 0, credit: 100_000_000, desc: 'Penjualan bulan April' },
  ])

  // === Journal 2: HPP (Harga Pokok Penjualan) ===
  insJournal('2026-04-01', 'HPP penjualan bulan April 2026', [
    { account_id: accId('510-001-01'), account_code: '510-001-01', account_name: 'Harga Pokok Penjualan', debit: 60_000_000, credit: 0, desc: 'HPP penjualan April' },
    { account_id: accId('130-001-01'), account_code: '130-001-01', account_name: 'Persediaan Barang', debit: 0, credit: 60_000_000, desc: 'Pengurangan persediaan' },
  ])

  // === Journal 3: Beban Gaji ===
  insJournal('2026-04-01', 'Beban gaji bulan April 2026', [
    { account_id: accId('610-001-01'), account_code: '610-001-01', account_name: 'Beban Gaji', debit: 15_000_000, credit: 0, desc: 'Gaji karyawan April' },
    { account_id: accId('111-002-01'), account_code: '111-002-01', account_name: 'Bank BCA', debit: 0, credit: 15_000_000, desc: 'Pembayaran gaji' },
  ])

  // === Journal 4: Beban Sewa ===
  insJournal('2026-04-01', 'Beban sewa bulan April 2026', [
    { account_id: accId('610-002-01'), account_code: '610-002-01', account_name: 'Beban Sewa', debit: 5_000_000, credit: 0, desc: 'Sewa tempat April' },
    { account_id: accId('111-002-01'), account_code: '111-002-01', account_name: 'Bank BCA', debit: 0, credit: 5_000_000, desc: 'Pembayaran sewa' },
  ])

  // === Journal 5: Beban Listrik & Air ===
  insJournal('2026-04-01', 'Beban listrik dan air bulan April 2026', [
    { account_id: accId('610-003-01'), account_code: '610-003-01', account_name: 'Beban Listrik & Air', debit: 2_000_000, credit: 0, desc: 'Listrik & Air April' },
    { account_id: accId('111-002-01'), account_code: '111-002-01', account_name: 'Bank BCA', debit: 0, credit: 2_000_000, desc: 'Pembayaran listrik' },
  ])

  // === Fiscal Settings ===
  db.prepare(`
    INSERT INTO fiscal_settings (year, omzet, pph25, updated_at) VALUES (2026, 100000000, 500000, datetime('now'))
    ON CONFLICT(year) DO UPDATE SET omzet = excluded.omzet, pph25 = excluded.pph25, updated_at = excluded.updated_at
  `).run()

  // === Fiscal Corrections (Positif) ===
  db.prepare(`
    INSERT INTO fiscal_corrections (year, type, account_code, account_name, amount) VALUES
    (2026, 'positif', '610-003-01', '610-003-01 - Beban Listrik & Air', 2000000),
    (2026, 'positif', '610-001-01', '610-001-01 - Beban Gaji', 500000)
  `).run()

  // === Fiscal Corrections (Negatif) ===
  db.prepare(`
    INSERT INTO fiscal_corrections (year, type, account_code, account_name, amount) VALUES
    (2026, 'negatif', '410-001-01', '410-001-01 - Penjualan', 1000000)
  `).run()

  console.log('Seed fiscal data berhasil!')
  console.log('  - 5 memorial journals (Penjualan, HPP, Gaji, Sewa, Listrik)')
  console.log('  - Laba komersial: Rp 18.000.000 (100jt - 60jt - 15jt - 5jt - 2jt)')
  console.log('  - Omzet: Rp 100.000.000, PPh 25: Rp 500.000')
  console.log('  - Koreksi Positif: Beban Listrik 2jt, Beban Gaji 500rb')
  console.log('  - Koreksi Negatif: Penjualan 1jt')
  console.log('  - Laba fiskal: 18jt + 2jt + 500rb - 1jt = Rp 19.500.000')
})

try {
  seed()
} catch (e) {
  console.error('Seed gagal:', e.message)
} finally {
  db.close()
}
