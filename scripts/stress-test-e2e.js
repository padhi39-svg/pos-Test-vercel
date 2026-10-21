// End-to-end stress test: hit /api/transactions in parallel to simulate 10 users
// Requires the Next.js app to be running on http://localhost:3001

const { setTimeout: sleep } = require('timers/promises')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'
const WORKERS = Number(process.env.WORKERS || 10)
const REQUESTS_PER_WORKER = Number(process.env.REQUESTS || 30)

async function pickBarang() {
  try {
    const res = await fetch(`${BASE_URL}/api/barang`)
    if (res.ok) {
      const list = await res.json()
      // pick first menu item with price
      const item = list.find(x => x && x.jenis === 1 && x.aktif && x.tampilMenu)
      if (item) {
        // derive latest price from prices[] if available
        let price = 0
        try {
          const today = new Date().toISOString().slice(0,10)
          const rows = Array.isArray(item.prices) ? item.prices.map(r=>({ price: Number(r.price)||0, eff: String(r.effectiveDate||r.effective_date||'0000-00-00') })) : []
          const past = rows.filter(r=> r.price>0 && r.eff <= today)
          if (past.length) {
            past.sort((a,b)=> a.eff<b.eff?-1:a.eff>b.eff?1:0)
            price = past[past.length-1].price
          }
        } catch {}
        if (!price) price = Number(item.price || item.hpp || 10000)
        return { id: item.id, code: item.code, name: item.name, price }
      }
    }
  } catch {}
  // Fallback if API not accessible: use known sample menu item
  return { id: 611, code: 'MN037', name: 'Aneka Buah Segar', price: 28000 }
}

async function buildPayload() {
  const barang = await pickBarang()
  const qty = 1
  const includeTax = true
  const ppnPercent = 10
  const r = ppnPercent/100
  // in app, unitPrice expected as EX-TAX per unit, totalPrice include tax
  const unitPriceEx = Math.round((barang.price / (1 + r)))
  const lineNetEx = unitPriceEx * qty
  const taxAmount = Math.round(lineNetEx * r)
  const lineTotal = lineNetEx + taxAmount
  const subtotal = lineNetEx
  const discountAmount = 0
  const ppnAmount = taxAmount
  const total = lineTotal

  const payment = { method: 'cash', amount: total, bankId: null, cardNumber: null, notes: 'e2e' }

  return {
    transactionType: 1,
    customerId: 1,
    items: [
      {
        barangId: barang.id,
        quantity: qty,
        unitPrice: unitPriceEx,
        discon_total: 0,
        totalPrice: lineTotal,
        unitName: 'PCS',
        unitRatio: 1,
      },
    ],
    subtotal,
    discountPercent: 0,
    discountAmount,
    ppnPercent,
    ppnAmount,
    total,
    includeTax,
    price_include_tax: includeTax ? 1 : 0,
    payments: [payment],
  }
}

async function createTransaction(body) {
  const res = await fetch(`${BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test': '1' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(()=> '')
    throw new Error(`HTTP ${res.status}: ${txt}`)
  }
  return res.json()
}

async function worker(id) {
  let ok = 0, fail = 0
  for (let i = 0; i < REQUESTS_PER_WORKER; i++) {
    try {
      const payload = await buildPayload()
      // tiny stagger
      await sleep(5)
      await createTransaction(payload)
      ok++
    } catch (e) {
      fail++
      if (fail === 1) {
        console.error(`Worker ${id} first error:`, e && e.message ? e.message : e)
      }
    }
    // tiny jitter
    await sleep(Math.floor(Math.random()*10))
  }
  return { ok, fail }
}

async function main() {
  const start = Date.now()
  const promises = []
  for (let i = 0; i < WORKERS; i++) promises.push(worker(i+1))
  const results = await Promise.all(promises)
  const ok = results.reduce((s,r)=>s+r.ok,0)
  const fail = results.reduce((s,r)=>s+r.fail,0)
  const dur = Date.now() - start
  const tps = (ok / (dur/1000)).toFixed(1)
  console.log(`E2E /api/transactions: OK=${ok}, Fail=${fail}, Duration=${dur}ms, ~${tps} tps`)
  process.exit(fail>0?1:0)
}

main().catch(e=>{ console.error(e); process.exit(1) })
