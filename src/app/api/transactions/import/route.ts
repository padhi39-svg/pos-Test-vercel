import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { checkStockAvailability } from '@/lib/stockValidation'

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const dryParam = url.searchParams.get('dry')
    const body = await request.json()
    let { transactions, dryRun } = body
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const isDry = (
      String(dryParam || '').trim() === '1' ||
      String(dryRun).toLowerCase() === 'true' ||
      String(dryRun || '').trim() === '1'
    )

    const normalizeDate = (val: any): string => {
      if (!val) return new Date().toISOString().slice(0,10)
      if (Object.prototype.toString.call(val) === '[object Date]') {
        const d = val as Date
        if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
      }
      const num = Number(val)
      if (isFinite(num) && String(val).trim() !== '' && /^(\d+)(\.\d+)?$/.test(String(val))) {
        const ms = Math.round((num - 25569) * 86400 * 1000)
        const d = new Date(ms)
        if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
      }
      const s = String(val).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
      if (m) {
        const [_, dd, mm, yyyy] = m
        const d = new Date(Number(yyyy), Number(mm)-1, Number(dd))
        if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
      }
      const d2 = new Date(s)
      if (!isNaN(d2.getTime())) return d2.toISOString().slice(0,10)
      return new Date().toISOString().slice(0,10)
    }

    if ((!Array.isArray(transactions) || transactions.length === 0) && rows.length > 0) {
      const groups = new Map<string, any[]>()
      for (const r of rows) {
        const key = String(
          r.nota ?? r.nota_key ?? r.penanda ?? r.no_nota ?? r.ref ?? r.dokumen ?? ''
        ).trim()
        if (!key) continue
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(r)
      }
      const txs: any[] = []
      for (const [key, list] of groups.entries()) {
        const h = list[0] || {}
        const tanggal = normalizeDate(h.tanggal ?? h.date)
        const customer_code = h.customer_code ?? h.customer ?? null
        const metode_pembayaran = h.metode_pembayaran ?? h.payment_method ?? 'cash'

        const agg = new Map<string, number>()
        for (const it of list) {
          const code = String(
            it.kode_barang ?? it.barang_code ?? it.code ?? it.item_code ?? ''
          ).trim()
          if (!code) continue
          const qraw = it.quantity ?? it.qty ?? 0
          const q = Number(String(qraw).replace(/,/g, '.'))
          const qty = isFinite(q) ? q : 0
          if (qty <= 0) continue
          agg.set(code, (agg.get(code) || 0) + qty)
        }
        const items = Array.from(agg.entries()).map(([kode, quantity]) => ({
          kode_barang: kode,
          quantity
        }))
        if (items.length === 0) continue
        txs.push({ tanggal, customer_code, metode_pembayaran, items, _external_ref: key })
      }
      transactions = txs
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'Invalid transactions data' }, { status: 400 })
    }

    const db = getDb()
    const pool = (db as any).$client

    const srows = await rawAll<any>("SELECT setting_key, setting_value FROM settings WHERE setting_group = 'penjualan'")
    const smap: Record<string, string> = {}
    for (const r of srows) smap[r.setting_key] = String(r.setting_value ?? '')
    const priceIncludeTax = smap['sales_include_tax'] === '1'
    const taxRatePercent = Number(smap['sales_default_ppn_percent'] || '11') || 0
    const r = Math.max(0, taxRatePercent) / 100
    const roundRp = (n: number) => Math.round(n)
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      previews: [] as any[]
    }
    const planned: Array<{ header: any; items: any[] }> = []

    let getBarangByCode: any
    try {
      const bpCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'barang_prices'"
      )
      const names = new Set(bpCols.map(c => c.column_name))
      const hasIsActive = names.has('is_active')
      const hasEffectiveDate = names.has('effective_date')
      const priceJoinCond = hasIsActive ? 'AND bp.is_active = 1' : ''
      const priceOrder = hasEffectiveDate ? 'bp.effective_date DESC' : 'bp.rowid DESC'
      const barangSql = `
        SELECT b.id, b.code, b.name, b.jenis,
               COALESCE(bp.price, 0) as current_price
        FROM master_barang b
        LEFT JOIN barang_prices bp ON b.id = bp.barang_id ${priceJoinCond}
        WHERE b.code = $1 AND b.isdelete = 0
        ORDER BY ${priceOrder}
        LIMIT 1
      `
      getBarangByCode = (code: string) => rawGet<any>(barangSql, [code])
    } catch (e) {
      const barangSql = `
        SELECT b.id, b.code, b.name, b.jenis,
               0 as current_price
        FROM master_barang b
        WHERE b.code = $1 AND b.isdelete = 0
        LIMIT 1
      `
      getBarangByCode = (code: string) => rawGet<any>(barangSql, [code])
    }

    let getDefaultUnitByBarang: any
    try {
      const buCols = await rawAll<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'barang_units'"
      )
      const hasRatio = new Set(buCols.map(c => c.column_name.toLowerCase())).has('ratio')
      const ratioCol = hasRatio ? 'ratio' : 'unit_ratio'
      const sql = `
        SELECT id, name, ${ratioCol} as unit_ratio
        FROM barang_units
        WHERE barang_id = $1
        ORDER BY ${ratioCol} ASC, id ASC
        LIMIT 1
      `
      getDefaultUnitByBarang = (barangId: number) => rawGet<any>(sql, [barangId])
    } catch {
      getDefaultUnitByBarang = (barangId: number) => rawGet<any>('SELECT id, name, 1 as unit_ratio FROM barang_units WHERE barang_id = $1 ORDER BY id ASC LIMIT 1', [barangId])
    }

    for (let i = 0; i < transactions.length; i++) {
      const txData = transactions[i]

      try {
        if (!txData.tanggal && txData.date) txData.tanggal = txData.date
        if (!txData.metode_pembayaran && txData.payment_method) txData.metode_pembayaran = txData.payment_method
        if (!Array.isArray(txData.items)) txData.items = []

        if (!txData.tanggal || !txData.items || txData.items.length === 0) {
          results.failed++
          results.errors.push({ row: i + 2, error: 'Tanggal dan items harus diisi' })
          continue
        }

        const txDateISO = normalizeDate(txData.tanggal)
        const period = await getPeriodByDate(txDateISO)
        if (!period) throw new Error(`Periode tidak ditemukan untuk tanggal ${txDateISO}`)
        if (Number(period.is_closed) === 1) throw new Error(`Periode '${period.name}' sudah ditutup`)

        const invoicePrefix = (smap['sales_invoice_prefix'] || 'JL').toUpperCase()
        const year = String(txDateISO).slice(0, 4)
        const escapeRegExp = (s: string) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const likePattern = `${invoicePrefix}/${year}/%`
        const rowsExisting = await rawAll<{ transaction_number: string }>(
          'SELECT transaction_number FROM transactions WHERE transaction_number LIKE $1',
          [likePattern]
        )
        let maxNo = 0
        const re = new RegExp(`^${escapeRegExp(invoicePrefix)}\/${escapeRegExp(year)}\/(\d+)$`)
        for (const r of rowsExisting) {
          const tn = String(r.transaction_number || '')
          const m = re.exec(tn)
          if (m) {
            const n = Number(m[1])
            if (!Number.isNaN(n) && n > maxNo) maxNo = n
          }
        }
        const yearlyNumber = (maxNo + 1).toString().padStart(6, '0')
        const transactionNumber = `${invoicePrefix}/${year}/${yearlyNumber}`

        let customerId = null
        let customerDiscount = 0
        if (txData.customer_code) {
          try {
            const cols = await rawAll<{ column_name: string }>(
              "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_customer'"
            )
            const hasDiscount = new Set(cols.map(c => c.column_name)).has('discount')
            if (hasDiscount) {
              const customer = await rawGet<any>('SELECT id, discount FROM master_customer WHERE code = $1 AND isdelete = 0', [txData.customer_code])
              if (customer) {
                customerId = customer.id
                customerDiscount = Number(customer.discount || 0)
              }
            } else {
              const customer = await rawGet<any>('SELECT id FROM master_customer WHERE code = $1 AND isdelete = 0', [txData.customer_code])
              if (customer) {
                customerId = customer.id
                customerDiscount = 0
              }
            }
          } catch (e) {
            const customer = await rawGet<any>('SELECT id FROM master_customer WHERE code = $1 AND isdelete = 0', [txData.customer_code])
            if (customer) customerId = customer.id
            customerDiscount = 0
          }
        }

        let dppSum = 0
        const validItems: any[] = []

        for (const item of txData.items) {
          const barang = await getBarangByCode(item.kode_barang)

          if (!barang) {
            throw new Error(`Barang ${item.kode_barang} tidak ditemukan`)
          }

          const qty = (() => {
            const raw = item.quantity ?? item.qty ?? 0
            const num = Number(String(raw).replace(/,/g, '.'))
            return isFinite(num) ? num : 0
          })()
          const uiPrice = Number(barang.current_price) || 0
          const unitPriceEx = priceIncludeTax ? roundRp(uiPrice / (1 + r)) : uiPrice
          const lineGrossEx = unitPriceEx * qty
          const discountCalc = 0
          const lineNetEx = Math.max(0, lineGrossEx - discountCalc)
          const taxAmount = roundRp(lineNetEx * r)
          const lineTotal = lineNetEx + taxAmount
          dppSum += lineNetEx

          const u = await getDefaultUnitByBarang(barang.id)
          const unit_id = u?.id || null
          const unit_name = u?.name || 'unit'
          const unit_ratio = Number(u?.unit_ratio || 1) || 1

          validItems.push({
            barang_id: barang.id,
            barang_code: item.kode_barang,
            barang_name: barang.name,
            quantity: qty,
            unit_id,
            unit_name,
            unit_ratio,
            unit_price: unitPriceEx,
            discount_percent: 0,
            discount_amount: 0,
            total_price: lineTotal
          })
        }

        const discountPercent = customerDiscount
        const discountAmount = roundRp(dppSum * (Math.max(0, discountPercent) / 100))
        const dppHeader = Math.max(0, dppSum - discountAmount)
        const taxAmount = roundRp(dppHeader * r)
        const grandTotal = dppHeader + taxAmount

        if (Math.abs((grandTotal + discountAmount) - (dppSum + taxAmount)) > 1) {
          throw new Error(`Ketidakseimbangan akuntansi: total(${grandTotal}) + disc(${discountAmount}) ≠ dppSum(${dppSum}) + ppn(${taxAmount})`)
        }

        const paymentMethod = txData.metode_pembayaran || 'cash'
        const paidAmount = grandTotal
        const changeAmount = 0

        const tipeNum = Number(txData.tipe ?? txData.tipe_penjualan ?? txData.transaction_type)
        const jenisRaw = (txData.jenis_penjualan || txData.tipe_penjualan || '').toString().trim().toLowerCase()
        const transactionType = (() => {
          if (Number.isFinite(tipeNum) && [1,2,3].includes(tipeNum)) return tipeNum
          if (jenisRaw === 'retail' || jenisRaw === '2') return 2
          if (jenisRaw === 'invoice' || jenisRaw === '3') return 3
          if (jenisRaw === 'resto' || jenisRaw === '1') return 1
          return 1
        })()

        try {
          const cols = await rawAll<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'"
          )
          const names = new Set(cols.map(c => c.column_name))
          if (!names.has('price_include_tax')) await rawRun('ALTER TABLE transactions ADD COLUMN price_include_tax INTEGER NOT NULL DEFAULT 0')
          if (!names.has('tax_rate_percent')) await rawRun('ALTER TABLE transactions ADD COLUMN tax_rate_percent REAL NOT NULL DEFAULT 11')
          if (!names.has('tgl_nota')) {
            await rawRun('ALTER TABLE transactions ADD COLUMN tgl_nota TEXT')
          }
          if (!names.has('transaction_date')) await rawRun('ALTER TABLE transactions ADD COLUMN transaction_date TEXT')
        } catch (e) {
          console.warn('[Import] ensure columns warning:', e)
        }

        if (isDry) {
          results.previews.push({
            transaction_number: transactionNumber,
            tanggal: txDateISO,
            customer_code: txData.customer_code || null,
            tipe: transactionType,
            items: validItems.length,
            dpp: dppHeader,
            ppn: taxAmount,
            total: grandTotal
          })
          results.success++
          continue
        }

        if (validItems.length === 0) {
          throw new Error('Tidak ada item valid pada nota ini')
        }
        planned.push({
          header: {
            transactionNumber,
            txDateISO,
            customerId,
            dppHeader,
            dppSum,
            discountPercent,
            discountAmount,
            taxAmount,
            grandTotal,
            paymentMethod,
            paidAmount,
            changeAmount,
            transactionType,
            periodId: period.id,
            notes: (txData._external_ref || txData.catatan || null),
            priceIncludeTax: priceIncludeTax ? 1 : 0,
            taxRatePercent
          },
          items: validItems
        })
        results.success++

      } catch (error: any) {
        results.failed++
        results.errors.push({ row: i + 2, data: txData, error: error.message })
      }
    }

    if (results.failed > 0) {
      return NextResponse.json({
        message: `Import dibatalkan: terdapat ${results.failed} error. Tidak ada data yang disimpan.`,
        results: { ...results, success: 0 }
      }, { status: 400 })
    }

    const tcols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'"
    )
    const namesSet = new Set(tcols.map(c => c.column_name))
    const add = (col: string, val: any, cols: string[], vals: any[]) => { if (namesSet.has(col)) { cols.push(col); vals.push(val) } }

    await pool.query('BEGIN')
    try {
      for (const p of planned) {
        const colsArr: string[] = []
        const valsArr: any[] = []
        add('transaction_number', p.header.transactionNumber, colsArr, valsArr)
        add('transaction_date', p.header.txDateISO, colsArr, valsArr)
        add('tgl_nota', p.header.txDateISO, colsArr, valsArr)
        add('customer_id', p.header.customerId, colsArr, valsArr)
        add('subtotal', p.header.dppSum, colsArr, valsArr)
        add('discount_percent', p.header.discountPercent, colsArr, valsArr)
        add('discount_amount', p.header.discountAmount, colsArr, valsArr)
        add('total_discount', p.header.discountAmount, colsArr, valsArr)
        add('ppn_percent', p.header.taxRatePercent, colsArr, valsArr)
        add('ppn_amount', p.header.taxAmount, colsArr, valsArr)
        add('total', p.header.grandTotal, colsArr, valsArr)
        add('payment_method', p.header.paymentMethod, colsArr, valsArr)
        add('payment_amount', p.header.paidAmount, colsArr, valsArr)
        add('change_amount', p.header.changeAmount, colsArr, valsArr)
        add('card_number', null, colsArr, valsArr)
        add('bank_id', null, colsArr, valsArr)
        add('status', 'completed', colsArr, valsArr)
        add('transaction_type', p.header.transactionType, colsArr, valsArr)
        add('period_id', p.header.periodId, colsArr, valsArr)
        add('due_date', null, colsArr, valsArr)
        add('payment_terms', null, colsArr, valsArr)
        add('notes', p.header.notes, colsArr, valsArr)
        add('price_include_tax', p.header.priceIncludeTax, colsArr, valsArr)
        add('tax_rate_percent', p.header.taxRatePercent, colsArr, valsArr)

        const placeholders = colsArr.map((_, i) => `$${i + 1}`).join(', ')
        const sqlIns = `INSERT INTO transactions (${colsArr.join(', ')}) VALUES (${placeholders}) RETURNING id`
        const txRes = await pool.query(sqlIns, valsArr)
        const transactionId = Number(txRes.rows[0].id)

        for (const it of p.items) {
          await pool.query(
            `INSERT INTO transaction_items (
              transaction_id, barang_id, barang_code, barang_name,
              quantity, unit_name, unit_ratio, unit_price,
              discount_percent, discount_amount, total_price
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [transactionId, it.barang_id, it.barang_code, it.barang_name,
             it.quantity, it.unit_name, it.unit_ratio, it.unit_price,
             it.discount_percent, it.discount_amount, it.total_price]
          )
        }
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({
      message: `Import selesai: ${results.success} berhasil, 0 gagal`,
      results: { ...results, failed: 0 }
    })

  } catch (error: any) {
    console.error('Error importing transactions:', error)
    return NextResponse.json(
      { error: 'Failed to import transactions', details: error.message },
      { status: 500 }
    )
  }
}
