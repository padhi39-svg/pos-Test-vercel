const { Pool } = require('pg')
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

// manual load .env
const envPath = path.join(__dirname, '..', '.env')
const envRaw = fs.readFileSync(envPath, 'utf8')
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*(\w+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

function roundRp(v: number) { return Math.round(v || 0) }

function calcTieredDiscount(qty: number, price: number, discPct: number, disc1Pct: number, disc2Pct: number, disc3Pct: number, discNominal: number) {
  const grossAmount = roundRp(qty * price)
  const dp = Math.min(Math.max(discPct || 0, 0), 100)
  const d1 = Math.min(Math.max(disc1Pct || 0, 0), 100)
  const d2 = Math.min(Math.max(disc2Pct || 0, 0), 100)
  const d3 = Math.min(Math.max(disc3Pct || 0, 0), 100)
  const dn = Math.max(0, discNominal || 0)

  let remaining = grossAmount
  const discountAmount = roundRp(remaining * (dp / 100))
  remaining -= discountAmount
  const disc1Amount = roundRp(remaining * (d1 / 100))
  remaining -= disc1Amount
  const disc2Amount = roundRp(remaining * (d2 / 100))
  remaining -= disc2Amount
  const disc3Amount = roundRp(remaining * (d3 / 100))
  remaining -= disc3Amount
  const discNominalAmount = Math.min(dn, remaining)
  remaining -= discNominalAmount
  const netAmount = Math.max(0, remaining)
  return { grossAmount, discountAmount, disc1Amount, disc2Amount, disc3Amount, discNominal: discNominalAmount, netAmount }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const suppliers = (await pool.query(
    `SELECT code, name FROM master_supplier WHERE isdelete = 0 ORDER BY code`
  )).rows

  const barangList = (await pool.query(`
    SELECT mb.code, mb.name, mb.hpp,
      COALESCE(sb.avg_cost, 0) as avg_cost
    FROM master_barang mb
    LEFT JOIN stock_balance sb ON sb.ingredient_id = mb.id AND sb.warehouse_id = 1
    WHERE mb.isdelete = 0
    ORDER BY mb.code
  `)).rows

  if (suppliers.length < 1) { console.error('Tidak ada supplier'); process.exit(1) }
  if (barangList.length < 3) { console.error('Minimal 3 barang'); process.exit(1) }

  console.log(`Suppliers: ${suppliers.length}, Barang: ${barangList.length}`)

  const masterHeaders = ['TransactionCode', 'Tanggal', 'Supplier Code', 'Subtotal', 'Discount %', 'Discount Amount', 'PPN %', 'Total', 'Notes', 'Warehouse']
  const detailHeaders = ['TransactionCode', 'Kode Barang', 'Quantity', 'Unit', 'Harga Satuan', 'Disc%', 'Disc1%', 'Disc2%', 'Disc3%', 'DiscRp', 'Total']

  const masterRows = [masterHeaders]
  const detailRows = [detailHeaders]

  // pola diskon per item (7 pola untuk rotasi)
  const itemDiscPattern = [
    { discPct: 10, disc1Pct: 5,  disc2Pct: 0, disc3Pct: 0, discNominal: 0 },
    { discPct: 5,  disc1Pct: 0,  disc2Pct: 0, disc3Pct: 0, discNominal: 0 },
    { discPct: 0,  disc1Pct: 10, disc2Pct: 5,  disc3Pct: 0, discNominal: 2000 },
    { discPct: 15, disc1Pct: 0,  disc2Pct: 0, disc3Pct: 0, discNominal: 0 },
    { discPct: 0,  disc1Pct: 0,  disc2Pct: 0, disc3Pct: 0, discNominal: 0 },
    { discPct: 8,  disc1Pct: 8,  disc2Pct: 0, disc3Pct: 0, discNominal: 5000 },
    { discPct: 20, disc1Pct: 0,  disc2Pct: 0, disc3Pct: 0, discNominal: 0 },
  ]

  for (let i = 1; i <= 10; i++) {
    const tx = `SMPL${String(i).padStart(3, '0')}`
    const supp = suppliers[i % suppliers.length]
    const day = String(1 + (i * 3) % 28).padStart(2, '0')
    const tgl = `2026-05-${day}`
    const ppnPct = 11
    let itemsGrossTotal = 0
    let itemsNetTotal = 0
    const items: any[] = []

    // 5 item per transaksi, ambil dari barangList dengan rotasi
    for (let j = 0; j < 5; j++) {
      const brg = barangList[(i * 7 + j * 13) % barangList.length]
      const qty = 2 + (i * (j + 1) + j) % 30

      // harga beli = HPP + markup 5-10%
      const hpp = Math.max(Number(brg.hpp || 0), Number(brg.avg_cost || 0))
      const markup = 1.05 + (i + j) % 6 * 0.01 // 5% - 10%
      const price = hpp > 0 ? roundRp(hpp * markup) : (j + 1) * 5000

      const dp = itemDiscPattern[(i + j) % itemDiscPattern.length]
      const calc = calcTieredDiscount(qty, price, dp.discPct, dp.disc1Pct, dp.disc2Pct, dp.disc3Pct, dp.discNominal)
      itemsGrossTotal += calc.grossAmount
      itemsNetTotal += calc.netAmount
      items.push({ brgCode: brg.code, qty, unit: 'pcs', price, ...dp, discNominal: calc.discNominal, netAmount: calc.netAmount })
    }

    // diskon header 5% dari itemsNetTotal (sama seperti form Add)
    const headerDiscPct = 5
    const headerDiscAmt = roundRp(itemsNetTotal * headerDiscPct / 100)
    const dpp = itemsNetTotal - headerDiscAmt
    const ppn = roundRp(dpp * ppnPct / 100)
    const total = dpp + ppn

    masterRows.push([tx, tgl, supp.code, itemsGrossTotal, headerDiscPct, headerDiscAmt, ppnPct, total, `Sample pembelian ke-${i}`, 1])
    for (const it of items) {
      detailRows.push([tx, it.brgCode, it.qty, it.unit, it.price, it.discPct, it.disc1Pct, it.disc2Pct, it.disc3Pct, it.discNominal, it.netAmount])
    }
  }

  const wsMaster = XLSX.utils.aoa_to_sheet(masterRows)
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)

  const supplierRows = [['Code', 'Name'], ...suppliers.map(s => [s.code, s.name])]
  const barangRows = [['Kode Barang', 'Nama Barang'], ...barangList.map(b => [b.code, b.name])]
  const wsSupp = XLSX.utils.aoa_to_sheet(supplierRows)
  const wsBrg = XLSX.utils.aoa_to_sheet(barangRows)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsMaster, 'MASTER')
  XLSX.utils.book_append_sheet(wb, wsDetail, 'DETAIL')
  XLSX.utils.book_append_sheet(wb, wsSupp, 'Referensi Supplier')
  XLSX.utils.book_append_sheet(wb, wsBrg, 'Referensi Barang')

  const filePath = path.join(__dirname, '..', 'sample-pembelian-mei2026.xlsx')
  XLSX.writeFile(wb, filePath)
  console.log('Sample file created:', filePath)
  console.log('Total transaksi:', masterRows.length - 1)
  console.log('Total baris detail:', detailRows.length - 1)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
