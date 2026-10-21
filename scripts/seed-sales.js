const pg = require('pg')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Ambil data referensi
  const barang = (await pool.query(`SELECT b.id, b.code, b.name, bp.price FROM master_barang b
    LEFT JOIN barang_prices bp ON bp.barang_id = b.id AND bp.effective_date <= CURRENT_DATE
    WHERE b.aktif = 1 AND b.isdelete = 0 AND bp.price > 0`)).rows
  if (!barang.length) { console.error('Tidak ada barang dengan harga.'); process.exit(1) }
  const customers = (await pool.query('SELECT id, name FROM master_customer')).rows
  const users = (await pool.query('SELECT id, name, code FROM master_users LIMIT 1')).rows
  const userId = users[0]?.id || 1
  const akunKas = (await pool.query("SELECT id FROM accounts WHERE code='111-001-01' OR name ILIKE '%kas besar%' LIMIT 1")).rows[0]
  const akunBank = (await pool.query("SELECT id FROM accounts WHERE code='111-002-01' LIMIT 1")).rows[0]
  const invoicePrefix = 'JL'

  function randomBarang() {
    const idx = Math.floor(Math.random() * barang.length)
    return barang[idx]
  }

  function randomItems() {
    const count = 2 + Math.floor(Math.random() * 2)
    const items = []
    for (let i = 0; i < count; i++) {
      const b = randomBarang()
      const qty = 1 + Math.floor(Math.random() * 3)
      items.push({ barang_id: Number(b.id), code: b.code, name: b.name, qty, unit_price: Number(b.price) })
    }
    return items
  }

  function makeDate(dateStr) {
    const d = new Date(dateStr)
    return d.toISOString().replace('T', ' ').slice(0, 19)
  }

  async function getNextNumber(year) {
    const like = `${invoicePrefix}/${year}/%`
    const rows = (await pool.query(`SELECT transaction_number FROM transactions WHERE transaction_number LIKE $1`, [like])).rows
    let maxNo = 0
    const re = new RegExp(`^${invoicePrefix}/${year}/(\\d+)$`)
    for (const r of rows) {
      const m = re.exec(String(r.transaction_number || ''))
      if (m) { const n = Number(m[1]); if (!Number.isNaN(n) && n > maxNo) maxNo = n }
    }
    return `${invoicePrefix}/${year}/${String(maxNo + 1).padStart(6, '0')}`
  }

  async function createTransaction(dateStr, items, customer, payMethod) {
    const year = dateStr.slice(0, 4)
    const txnNumber = await getNextNumber(year)
    const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0)
    const ppn = Math.round(subtotal * 0.11)
    const total = subtotal + ppn
    const payAmount = payMethod === 'piutang' ? 0 : total

    // Buat header
    const tx = await pool.query(`INSERT INTO transactions
      (transaction_number, customer_id, customer_name, subtotal, discount_percent, discount_amount,
       service_charge_percent, service_charge_amount, ppn_percent, ppn_amount, total,
       payment_method, payment_amount, change_amount, status, tgl_nota, transaction_type, period_id,
       user_create, created_at, updated_at, notes)
      VALUES ($1,$2,$3,$4,0,0,0,0,11,$5,$6,$7,$8,0,'completed',$9,3,      (SELECT id FROM master_periode WHERE $10::date BETWEEN start_date AND end_date LIMIT 1),$11,$12,$12,$13) RETURNING id`,
      [txnNumber, customer.id, customer.name, subtotal, ppn, total, payMethod, payAmount, dateStr, dateStr, userId, makeDate(dateStr), `Seed ${dateStr}`])
    const txId = tx.rows[0].id

    // Items
    for (const it of items) {
      const totalPrice = it.qty * it.unit_price
      await pool.query(`INSERT INTO transaction_items
        (transaction_id, barang_id, barang_code, barang_name, quantity, unit_name, unit_ratio, unit_price,
         discount_percent, discount_amount, total_price, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,'pcs',1,$6,0,0,$7,$8,$8)`,
        [txId, it.barang_id, it.code, it.name, it.qty, it.unit_price, totalPrice, makeDate(dateStr)])
    }

    // Payment
    if (payMethod !== 'piutang') {
      const accountId = payMethod === 'transfer' ? akunBank?.id : akunKas?.id
      if (accountId) {
        await pool.query(`INSERT INTO transaction_payments (transaction_id, method, amount, account_id, created_at) VALUES ($1,$2,$3,$4,$5)`,
          [txId, payMethod, payAmount, accountId, makeDate(dateStr)])
      }
    }

    console.log(`  ${txnNumber} | ${dateStr.slice(0,10)} | ${customer.name} | Rp${total.toLocaleString()} | ${payMethod}`)
    return txId
  }

  // ============================================================
  // 7 BULAN KE BELAKANG (1 transaksi per bulan)
  // ============================================================
  console.log('\n--- 7 Bulan ke Belakang ---')
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15)
    const dateStr = d.toISOString().slice(0, 10)
    const customer = customers[Math.floor(Math.random() * customers.length)]
    const items = randomItems()
    const methods = ['cash', 'cash', 'transfer']
    const method = methods[Math.floor(Math.random() * methods.length)]
    await createTransaction(dateStr, items, customer, method)
  }

  // ============================================================
  // 7 HARI KE BELAKANG (1 transaksi per hari)
  // ============================================================
  console.log('\n--- 7 Hari ke Belakang ---')
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const customer = customers[Math.floor(Math.random() * customers.length)]
    const items = randomItems()
    const methods = ['cash', 'cash', 'transfer', 'piutang']
    const method = methods[Math.floor(Math.random() * methods.length)]
    await createTransaction(dateStr, items, customer, method)
  }

  console.log('\nSelesai!')
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
