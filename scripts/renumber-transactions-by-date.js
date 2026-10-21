const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'resto-system.db')
const db = new Database(dbPath)

console.log('🔧 Renumber transaction_number berdasarkan tgl_nota (tahun mengikuti tanggal nota)...')
console.log('DB:', dbPath)

const roundInt = (n) => Math.round(Number(n || 0))

const safeYearFromDate = (s) => {
  if (!s) return null
  const str = String(s)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 4)
  if (/^\d{4}/.test(str)) return str.slice(0, 4)
  return null
}

const parsePrefix = (tn) => {
  const s = String(tn || '')
  const parts = s.split('/')
  return parts[0] ? parts[0].trim() : 'JL'
}

const pad6 = (n) => String(n).padStart(6, '0')

try {
  const cols = db.prepare(`PRAGMA table_info(transactions)`).all()
  const colNames = new Set(cols.map(c => c.name))

  if (!colNames.has('transaction_number')) {
    console.error('❌ Kolom transaction_number tidak ditemukan')
    process.exit(1)
  }

  // Ensure tgl_nota exists (best-effort)
  if (!colNames.has('tgl_nota')) {
    console.warn('⚠️  Kolom tgl_nota tidak ada. Script akan fallback ke created_at untuk tahun.')
  }

  // Ambil semua transaksi
  const txs = db.prepare(`SELECT id, transaction_number, tgl_nota, created_at FROM transactions ORDER BY id ASC`).all()
  console.log('📊 Total transaksi:', txs.length)

  // Buat mapping per group prefix+year
  const groups = new Map() // key -> array tx
  for (const t of txs) {
    const prefix = parsePrefix(t.transaction_number)
    const year = safeYearFromDate(colNames.has('tgl_nota') ? t.tgl_nota : null) || safeYearFromDate(t.created_at) || String(new Date().getFullYear())
    const key = `${prefix}/${year}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...t, prefix, year })
  }

  // Sort setiap group by tgl_nota/created_at lalu id
  for (const [key, arr] of groups.entries()) {
    arr.sort((a, b) => {
      const da = String(a.tgl_nota || a.created_at || '')
      const dbb = String(b.tgl_nota || b.created_at || '')
      if (da < dbb) return -1
      if (da > dbb) return 1
      return Number(a.id) - Number(b.id)
    })
  }

  // Rencanakan nomor baru
  const planned = [] // {id, old, next}
  for (const [key, arr] of groups.entries()) {
    const [prefix, year] = key.split('/')
    let i = 1
    for (const t of arr) {
      const next = `${prefix}/${year}/${pad6(i)}`
      planned.push({ id: t.id, old: String(t.transaction_number || ''), next })
      i++
    }
  }

  // Hitung berapa yang berubah
  const changed = planned.filter(x => x.old !== x.next)
  console.log('📝 Akan diubah:', changed.length)
  if (changed.length === 0) {
    console.log('✅ Tidak ada perubahan nomor.')
    process.exit(0)
  }

  // Jalankan update dalam transaksi:
  // 1) set semua yang berubah menjadi placeholder unik (__TMP__/id)
  // 2) set ke nomor final
  const run = db.transaction(() => {
    const setTmp = db.prepare(`UPDATE transactions SET transaction_number = ? WHERE id = ?`)
    const setFinal = db.prepare(`UPDATE transactions SET transaction_number = ? WHERE id = ?`)

    for (const x of changed) {
      setTmp.run(`__TMP__/${x.id}`, x.id)
    }
    for (const x of changed) {
      setFinal.run(x.next, x.id)
    }
  })

  run()

  // Verifikasi uniqueness sederhana
  const dup = db.prepare(`
    SELECT transaction_number, COUNT(*) AS c
    FROM transactions
    GROUP BY transaction_number
    HAVING c > 1
    LIMIT 10
  `).all()

  if (dup.length > 0) {
    console.error('❌ Masih ada duplikat transaction_number setelah renumber! Contoh:')
    console.table(dup)
    process.exit(1)
  }

  // Sample output
  const sample = db.prepare(`SELECT id, transaction_number, tgl_nota, created_at FROM transactions ORDER BY id DESC LIMIT 10`).all()
  console.log('✅ Renumber selesai. Sample 10 terakhir:')
  console.table(sample)

} catch (e) {
  console.error('❌ Error:', e && e.message ? e.message : e)
  process.exit(1)
} finally {
  try { db.close() } catch {}
}
