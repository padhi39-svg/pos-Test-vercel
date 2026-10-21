import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { checkStockAvailability } from '@/lib/stockValidation'

/**
 * POST /api/transactions/import-advanced
 * Body: {
 *   headers: Array<{
 *     transactioncode: string
 *     tanggalnota: string
 *     jamnota?: string
 *     tanggalcreate?: string
 *     jamcreate?: string
 *     KodeCustomer?: string
 *     warehouse?: string
 *     kodemeja?: string
 *     jumlah_tamu?: number
 *     subtotal?: number
 *     disc?: number
 *     service_charge?: number
 *     tax?: number
 *     total: number
 *     paymentamount?: number
 *     paymentmethod?: string
 *     user_create?: string
 *     sales?: string
 *     bank?: string
 *     nokartu?: string
 *     keterangan?: string
 *     catatan?: string
 *   }>
 *   details: Array<{
 *     transactioncode: string
 *     KodeBarang: string
 *     Quantity: number
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dryParam = url.searchParams.get('dry')
    const body = await req.json()
    const headers = Array.isArray(body?.headers) ? body.headers : []
    const details = Array.isArray(body?.details) ? body.details : []
    // Dry run detection: support query ?dry=1 or body { dryRun: true/1 }
    const isDry = (
      String(dryParam || '').trim() === '1' ||
      String(body.dryRun).toLowerCase() === 'true' ||
      String(body.dryRun || '').trim() === '1'
    )

    if (!headers.length || !details.length) {
      return NextResponse.json({ error: 'headers dan details wajib diisi' }, { status: 400 })
    }

    let db: any
    let pool: any
    try {
      db = getDb()
      pool = (db as any).$client
    } catch (dbErr: any) {
      console.error('Failed to get database:', dbErr)
      return NextResponse.json({ error: 'Database connection failed', details: dbErr.message }, { status: 500 })
    }

    // Load penjualan settings (untuk tax_rate, include_tax, allow_negative)
    let smap: Record<string, string> = {}
    try {
      const srows = await rawAll(`SELECT setting_key, setting_value FROM settings WHERE setting_group = 'penjualan'`) as any[]
      for (const r of srows) smap[r.setting_key] = String(r.setting_value ?? '')
    } catch (settingsErr: any) {
      console.warn('Failed to load penjualan settings, using defaults:', settingsErr.message)
    }
    const priceIncludeTax = smap['sales_include_tax'] === '1'
    const taxRatePercent = Number(smap['sales_default_ppn_percent'] || '11') || 0
    const allowNegativeStock = smap['sales_allow_negative'] === '1'
    const servicePercentDefault = Number(smap['sales_default_service_percent'] || '0') || 0
    const roundRp = (n: number) => Math.round(n)

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      previews: [] as any[],
    }

    // Helper normalize date from "DD/MM/YYYY", "YYYY-MM-DD", ISO with time, or Excel serial number
    const normalizeDate = (s: string | number | undefined | null): string => {
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const formatLocalYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      const formatUtcYmd = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
      if (s === undefined || s === null || s === '') return formatLocalYmd(new Date())

      // Check if it's an Excel serial number (number or numeric string)
      const numVal = typeof s === 'number' ? s : Number(s)
      if (!isNaN(numVal) && numVal > 25569 && numVal < 100000) {
        // Excel serial date: days since 1899-12-30 (Excel epoch)
        // Use UTC math to avoid timezone shifts and round to nearest day
        const days = Math.round(numVal)
        const msPerDay = 24 * 60 * 60 * 1000
        const excelEpochUtcMs = Date.UTC(1899, 11, 30)
        const d = new Date(excelEpochUtcMs + days * msPerDay)
        if (!isNaN(d.getTime())) return formatUtcYmd(d)
      }

      const str = String(s).trim()
      if (!str) return formatLocalYmd(new Date())

      // Already ISO format
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
      // ISO with time or space separator → take date part to avoid TZ shift
      const mIsoWithTime = str.match(/^(\d{4}-\d{2}-\d{2})[T\s].*$/)
      if (mIsoWithTime) return mIsoWithTime[1]

      // DD/MM/YYYY or DD-MM-YYYY format
      const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
      if (m) {
        const [_, dd, mm, yyyy] = m
        const y = Number(yyyy)
        const mo = Number(mm)
        const da = Number(dd)
        const d = new Date(y, mo - 1, da)
        if (!isNaN(d.getTime())) return `${y}-${pad2(mo)}-${pad2(da)}`
      }

      // Try parsing as date string
      const d2 = new Date(str)
      if (!isNaN(d2.getTime())) return formatLocalYmd(d2)

      return formatLocalYmd(new Date())
    }

    // Index detail per transactioncode dan catat baris Excel kasar (jika dikirim)
    type DetailRow = {
      transactioncode: string
      KodeBarang: string
      Quantity: number
      unit_price?: number
      discount_amount?: number
      total_price?: number
      __rowIndex?: number
    }
    const detailRows: DetailRow[] = details.map((d: any, idx: number) => ({
      transactioncode: String(d.transactioncode || d.TransactionCode || d.Transactioncode || '').trim(),
      KodeBarang: String(
        d.KodeBarang ?? d.kode_barang ?? d.kodebarang ?? d['Kode Barang'] ?? d['kode barang'] ?? ''
      ).trim(),
      Quantity: Number(d.Quantity ?? d.quantity ?? d.Qty ?? d.qty ?? 0),
      unit_price: d.unit_price !== undefined
        ? Number(d.unit_price)
        : (d.Harga !== undefined
          ? Number(d.Harga)
          : (d.price !== undefined ? Number(d.price) : undefined)),
      discount_amount: d.discount_amount !== undefined
        ? Number(d.discount_amount)
        : (d.DiscAmount !== undefined
          ? Number(d.DiscAmount)
          : (d.disc_amount !== undefined ? Number(d.disc_amount) : undefined)),
      total_price: d.total_price !== undefined
        ? Number(d.total_price)
        : (d.TotalPrice !== undefined
          ? Number(d.TotalPrice)
          : undefined),
      __rowIndex: Number(d.__rowIndex ?? idx + 2), // default: baris ke-2 dst (asumsi row 1 header)
    }))

    // Helper satuan default per barang (pakai ratio terkecil dari barang_units, mirip import sederhana)
    let getDefaultUnitByBarang: any
    try {
      const buCols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='barang_units'`) as { name: string }[]
      const hasRatio = new Set(buCols.map(c => c.name.toLowerCase())).has('ratio')
      const ratioCol = hasRatio ? 'ratio' : 'unit_ratio'
      const sqlUnit = `
        SELECT id, name, ${ratioCol} as unit_ratio
        FROM barang_units
        WHERE barang_id = ?
        ORDER BY ${ratioCol} ASC, id ASC
        LIMIT 1
      `
      getDefaultUnitByBarang = async (barangId: number) => rawGet(sqlUnit, [barangId])
    } catch {
      // Fallback: ambil baris pertama jika struktur berbeda
      try {
        getDefaultUnitByBarang = async (barangId: number) => rawGet('SELECT id, name, 1 as unit_ratio FROM barang_units WHERE barang_id = ? ORDER BY id ASC LIMIT 1', [barangId])
      } catch {
        getDefaultUnitByBarang = null
      }
    }

    // Optional: customer, bank, warehouse, meja; kita toleran jika tabel tidak ada
    const tableExists = async (name: string): Promise<boolean> => {
      try {
        const row = await rawGet(`SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name=?`, [name])
        return !!row
      } catch {
        return false
      }
    }

    const hasCustomer = await tableExists('master_customer')
    const hasBank = await tableExists('master_banks')
    const hasWarehouse = (await tableExists('warehouses')) || (await tableExists('warehouse')) || (await tableExists('master_gudang'))
    const hasMeja = await tableExists('master_meja')
    const hasUsers = await tableExists('master_users')
    const hasSalesTable = await tableExists('master_sales')
    const hasStockMovements = await tableExists('stock_movements')
    const hasStockBalance = await tableExists('stock_balance')
    const hasBarangUnits = await tableExists('barang_units')
    const hasMasterBarang = await tableExists('master_barang')
    const hasBarangRecipes = await tableExists('barang_recipes')

    let findCustomerByCode: any = null
    if (hasCustomer) {
      findCustomerByCode = async (code: string) => rawGet('SELECT id FROM master_customer WHERE code = ? AND isdelete = 0', [code])
    }
    let findBankByCodeOrName: any = null
    if (hasBank) {
      findBankByCodeOrName = async (code: string) => rawGet('SELECT id FROM master_banks WHERE (bank_name = ? OR owner_name = ? OR account_number = ?) AND isdelete = 0 LIMIT 1', [code, code, code])
    }
    let findWarehouseByCode: any = null
    if (hasWarehouse) {
      findWarehouseByCode = async (code: string) => {
        const r1 = await rawGet('SELECT id FROM warehouses WHERE code = ? OR name = ? LIMIT 1', [code, code])
        if (r1) return r1
        const r2 = await rawGet('SELECT id FROM warehouse WHERE code = ? OR name = ? LIMIT 1', [code, code])
        if (r2) return r2
        return rawGet('SELECT id FROM master_gudang WHERE code = ? OR name = ? LIMIT 1', [code, code])
      }
    }
    let findMejaByCode: any = null
    if (hasMeja) {
      findMejaByCode = async (code: string) => rawGet('SELECT id FROM master_meja WHERE code = ? OR name = ? LIMIT 1', [code, code])
    }

    // Optional: lookup master_users by username/email for user_create mapping
    let findUserByUsernameOrEmail: any = null
    if (hasUsers) {
      try {
        const ucols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='master_users'`) as { name: string }[]
        const hasUsername = ucols.some(c => c.name.toLowerCase() === 'username')
        if (hasUsername) {
          findUserByUsernameOrEmail = async (user: string) => rawGet(
            'SELECT id FROM master_users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
            [user, user]
          )
        } else {
          findUserByUsernameOrEmail = async (user: string) => rawGet(
            'SELECT id FROM master_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [user]
          )
        }
      } catch {
        findUserByUsernameOrEmail = null
      }
    }

    // Optional: lookup sales (waiter) by code/name for waiter_id mapping
    let findSalesByCodeOrName: any = null
    if (hasSalesTable) {
      findSalesByCodeOrName = async (code: string) => rawGet('SELECT id FROM master_sales WHERE code = ? OR name = ? LIMIT 1', [code, code])
    }

    // Payment method yang diizinkan (untuk validasi dan normalisasi)
    const allowedPaymentMethods = new Set(['cash', 'Debit Card', 'Credit Card'])

    // Process each header (1 header = 1 transaksi)
    // Atomic mode: for non-dry run, wrap ALL inserts in one DB transaction and rollback if any header fails
    // Ensure sequence recalculation per year on each request (avoid stale global cache after data reset)
    const recomputedYears = new Set<number>()

    if (!isDry) {
      await pool.query('BEGIN')
    }
    for (let i = 0; i < headers.length; i++) {
        const h = headers[i]
        const headerRowIndex = Number((h as any).__rowIndex ?? i + 2)

        try {
        const code = String(h.transactioncode || '').trim()
        if (!code) {
          throw new Error('transactioncode wajib diisi di sheet Header')
        }

        const headerDetails = detailRows.filter(d => d.transactioncode === code)
        if (headerDetails.length === 0) {
          throw new Error(`Tidak ada detail untuk transactioncode ${code}`)
        }

        // Validasi master: customer
        let customerId: number | null = null
        const customerCode = String(h.KodeCustomer || h.customer_code || '').trim()
        if (customerCode) {
          if (!findCustomerByCode) {
            throw new Error('Tabel master_customer tidak tersedia, tidak bisa validasi customer')
          }
          const row = await findCustomerByCode(customerCode) as any
          if (!row) {
            throw new Error(`Customer dengan kode '${customerCode}' tidak ditemukan`)
          }
          customerId = Number(row.id)
        }

        // Validasi master: warehouse
        // Default ke 1 supaya memenuhi NOT NULL di transactions.warehouse_id
        let warehouseId: number | null = 1
        // Normalisasi ke UPPERCASE agar konsisten dengan master_gudang.code
        const whCode = String(h.warehouse || h.warehouse_code || '').trim().toUpperCase()
        if (whCode && findWarehouseByCode) {
          try {
            const row = await findWarehouseByCode(whCode) as any
            if (row && row.id != null) {
              warehouseId = Number(row.id)
            }
            // Jika tidak ketemu, biarkan default 1 (tidak error)
          } catch {
            // Abaikan error lookup gudang, tetap pakai default 1
          }
        }

        // Validasi master: meja (opsional)
        let tableId: number | null = null
        const mejaCode = String(h.kodemeja || h.table_code || '').trim()
        if (mejaCode && findMejaByCode) {
          try {
            const row = await findMejaByCode(mejaCode) as any
            if (row) tableId = Number(row.id)
          } catch {
            // Ignore meja lookup errors
          }
        }

        // Rakitan pembayaran (format baru): kolom fixed Tunai/Debit/Kredit
        type PaymentRow = { method: string; amount: number; bankId: number | null; cardNumber: string | null; notes: string | null }

        const toNumber = (v: any): number => {
          if (v === null || v === undefined) return 0
          if (typeof v === 'number') return Number.isFinite(v) ? v : 0
          const s = String(v).trim()
          if (!s) return 0
          // Support "1.000.000" or "1,000,000" or "1000000"; and decimal comma
          const cleaned = s
            .replace(/\s+/g, '')
            .replace(/\.(?=\d{3}(\D|$))/g, '')
            .replace(/,/g, '.')
          const n = Number(cleaned)
          return Number.isFinite(n) ? n : 0
        }

        const tunaiAmt = toNumber((h as any).Tunai ?? (h as any).tunai)
        const debitAmt = toNumber((h as any).KartuDebit ?? (h as any).kartudebit)
        const kreditAmt = toNumber((h as any).KartuKredit ?? (h as any).kartukredit)

        const penerbitDebit = String((h as any).PenerbitKartuDebit ?? (h as any).penerbitkartudebit ?? '').trim()
        const noDebit = String((h as any).NoKartuDebit ?? (h as any).nokartudebit ?? '').trim()
        const penerbitKredit = String((h as any).PenerbitKartuKredit ?? (h as any).penerbitkartukredit ?? '').trim()
        const noKredit = String((h as any).NoKartuKredit ?? (h as any).nokartukredit ?? '').trim()

        const resolveBankId = async (bankCode: string): Promise<number | null> => {
          const code = String(bankCode || '').trim()
          if (!code) return null
          if (!findBankByCodeOrName) return null
          try {
            const row = await findBankByCodeOrName(code) as any
            if (row) return Number(row.id)
          } catch {}
          return null
        }

        const paymentsClean: PaymentRow[] = []
        if (tunaiAmt > 0) paymentsClean.push({ method: 'cash', amount: tunaiAmt, bankId: null, cardNumber: null, notes: null })
        if (debitAmt > 0) paymentsClean.push({ method: 'Debit Card', amount: debitAmt, bankId: await resolveBankId(penerbitDebit), cardNumber: noDebit || null, notes: null })
        if (kreditAmt > 0) paymentsClean.push({ method: 'Credit Card', amount: kreditAmt, bankId: await resolveBankId(penerbitKredit), cardNumber: noKredit || null, notes: null })

        // Tanggal & periode
        const txDateISO = normalizeDate(h.tanggalnota as string)
        const period = await getPeriodByDate(txDateISO)
        if (!period) throw new Error(`Periode tidak ditemukan untuk tanggal ${txDateISO}`)
        if (Number(period.is_closed) === 1) throw new Error(`Periode '${period.name}' sudah ditutup`)

        // Angka header (percaya angka dari Excel)
        const subtotalHeader = Number(h.subtotal ?? 0) || 0
        const discHeader = Number(h.disc ?? 0) || 0
        const serviceChargeAmount = Number((h as any).service_charge ?? 0) || 0
        const taxHeader = Number(h.tax ?? 0) || 0
        const totalHeader = Number(h.total ?? 0) || 0
        // Allow total = 0 for dry run preview, but warn
        if (!Number.isFinite(totalHeader)) {
          throw new Error('Kolom total pada Header harus berupa angka')
        }
        // For actual import (non-dry), total must be > 0
        if (!isDry && totalHeader === 0) {
          throw new Error('Kolom total pada Header wajib diisi dan tidak boleh 0')
        }

        // Ringkasan pembayaran header (multi/single)
        const totalAmount = totalHeader
        let headerPaymentMethod: string = 'cash'
        let headerPaymentAmount: number = 0
        let headerChangeAmount: number = 0
        let headerBankId: number | null = null
        let headerCardNumber: string | null = null

        if (paymentsClean.length > 0) {
          const totalPaid = paymentsClean.reduce((sum: number, p: PaymentRow) => sum + (Number(p.amount) || 0), 0)
          if (!isDry && totalAmount > 0 && totalPaid <= 0) {
            throw new Error('Kolom pembayaran (Tunai/KartuDebit/KartuKredit) wajib diisi')
          }

          headerPaymentAmount = totalPaid
          const excess = totalPaid - totalAmount
          headerChangeAmount = excess > 0 ? excess : 0

          const primary = paymentsClean[0]
          headerPaymentMethod = paymentsClean.length === 1 ? primary.method : 'multi'

          const firstNonCash = paymentsClean.find((p: PaymentRow) => {
            const m = p.method.toLowerCase()
            return m === 'debit card' || m === 'credit card'
          })
          if (firstNonCash) {
            if (firstNonCash.bankId != null) headerBankId = Number(firstNonCash.bankId)
            if (firstNonCash.cardNumber != null) headerCardNumber = String(firstNonCash.cardNumber)
          }
        }

        // Optional: kita tidak memaksa hitung ulang subtotal/tax, tapi kita bisa hitung DPP untuk isi kolom subtotal
        let discountAmount = discHeader
        let dppHeader = subtotalHeader
        let taxAmount = taxHeader
        let grandTotal = totalHeader

        // Validasi semua detail items terlebih dahulu (abaikan qty 0)
        const validatedItems: { barang: any; d: DetailRow; qty: number }[] = []
        for (const d of headerDetails) {
          let barang: any = null
          try {
            barang = await rawGet(`SELECT id, code, name FROM master_barang WHERE code = ? AND isdelete = 0 LIMIT 1`, [d.KodeBarang])
          } catch (barangErr: any) {
            throw new Error(`Gagal mencari barang '${d.KodeBarang}': ${barangErr.message}`)
          }
          if (!barang) {
            throw new Error(`Barang dengan kode '${d.KodeBarang}' tidak ditemukan (detail row ${d.__rowIndex})`)
          }
          const qty = Number(d.Quantity)
          if (!Number.isFinite(qty) || qty === 0) {
            // Skip baris dengan qty 0/invalid tanpa menggagalkan transaksi
            continue
          }
          validatedItems.push({ barang, d, qty })
        }

        // Hitung ulang subtotal dari detail (termasuk qty negatif) jika memungkinkan
        if (validatedItems.length > 0) {
          let detailSubtotal = 0
          for (const { d, qty } of validatedItems) {
            const hasLineTotal = d.total_price !== undefined && d.total_price !== null
            const unitPrice = Number(d.unit_price ?? 0) || 0
            const discAmt = Number(d.discount_amount ?? 0) || 0
            const lineTotal = hasLineTotal ? Number(d.total_price) || 0 : (unitPrice * qty - discAmt)
            detailSubtotal += Number(lineTotal) || 0
          }
          dppHeader = Math.round(detailSubtotal)
          // Jika tax/totaI tidak disediakan atau tidak konsisten, hitung dari setting
          const recomputedTax = roundRp(dppHeader * (Math.max(0, taxRatePercent) / 100))
          if (!Number.isFinite(taxAmount) || taxAmount === 0) taxAmount = recomputedTax
          // Grand total dari dpp + service + tax (diskon sudah tertanam di detail)
          grandTotal = dppHeader + serviceChargeAmount + taxAmount
        }

        // Jika dry run, kumpulkan preview dan lanjut ke header berikutnya
        if (isDry) {
          results.previews.push({
            transactioncode: code,
            tanggal: txDateISO,
            customer_code: customerCode || null,
            items: validatedItems.length,
            subtotal: dppHeader,
            disc: discountAmount,
            service_charge_percent: servicePercentDefault,
            service_charge: serviceChargeAmount,
            tax: taxAmount,
            total: grandTotal,
            paymentmethod: headerPaymentMethod,
          })
          results.success++
          continue
        }

        // Jika tidak ada item valid (semua qty 0), lewati transaksi ini (tidak dimasukkan ke DB)
        if (validatedItems.length === 0) {
          if (isDry) {
            results.errors.push({ headerRow: headerRowIndex, transactioncode: code, error: 'Tidak ada detail dengan qty > 0 untuk transactioncode ini' })
            results.failed++
          }
          continue
        }

        // Siapkan transaksi di DB
        // Build kolom dinamis sesuai skema transactions saat ini
        let tcols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions'`) as { name: string }[]
        let namesSet = new Set(tcols.map(c => String(c.name)))

        // Pastikan kolom waiter_id ada (non-destructive migration di sini)
        if (!namesSet.has('waiter_id')) {
          try {
            await rawRun('ALTER TABLE transactions ADD COLUMN waiter_id INTEGER')
            tcols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions'`) as { name: string }[]
            namesSet = new Set(tcols.map(c => String(c.name)))
          } catch {
            // jika gagal, abaikan; kolom waiter_id hanya tidak akan terisi
          }
        }
        const add = (col: string, val: any, cols: string[], vals: any[]) => {
          if (namesSet.has(col)) { cols.push(col); vals.push(val) }
        }

        // Generator nomor transaksi bawaan sistem: PREFIX/YYYY/XXXXXX (unik per tahun)
        // Tahun mengikuti tanggal nota (txDateISO) agar import sesuai tahun nota.
        const invoicePrefix = (smap['sales_invoice_prefix'] || 'JL').toUpperCase()
        const yearNow = Number(String(txDateISO).slice(0, 4))
        type SeqCache = { base: number; next: number }
        const seqKey = `year_${yearNow}`
        ;(globalThis as any).__tx_seq_cache = (globalThis as any).__tx_seq_cache || {}
        const seqCacheAll = (globalThis as any).__tx_seq_cache as Record<string, SeqCache>
        // Recompute from DB once per year per request to reflect latest state (e.g., after reset/deletion)
        if (!recomputedYears.has(yearNow)) {
          let lastSuffix = 0
          try {
            const like = `${invoicePrefix}/${yearNow}/%`
            const rows = await rawAll(`SELECT transaction_number FROM transactions WHERE transaction_number LIKE ?`, [like]) as any[]
            const escapeRegExp = (s: string) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re2 = new RegExp(`^${escapeRegExp(invoicePrefix)}\/${escapeRegExp(String(yearNow))}\/([0-9]+)$`)
            for (const rr of rows) {
              const tn = String(rr?.transaction_number || '')
              const mm = re2.exec(tn)
              if (mm) {
                const n = Number(mm[1])
                if (!Number.isNaN(n) && n > lastSuffix) lastSuffix = n
              }
            }
          } catch {}
          seqCacheAll[seqKey] = { base: lastSuffix, next: lastSuffix + 1 }
          recomputedYears.add(yearNow)
        }
        const getNextNumber = () => {
          const seq = seqCacheAll[seqKey]
          const num = seq.next
          seq.next++
          return `${invoicePrefix}/${yearNow}/${String(num).padStart(6, '0')}`
        }
        let transactionNumber = getNextNumber()

        const colsArr: string[] = []
        const valsArr: any[] = []

        // Map optional user_create (Excel username/email) -> master_users.id
        const userCreateRaw = String((h as any).user_create || '').trim()
        let userCreateId: number | null = null
        if (userCreateRaw && findUserByUsernameOrEmail) {
          try {
            const row = await findUserByUsernameOrEmail(userCreateRaw) as any
            if (row && row.id != null) userCreateId = Number(row.id)
          } catch {
            userCreateId = null
          }
        }

        // Map optional sales (waiter code) -> waiter_id (master_sales.id)
        const salesRaw = String((h as any).sales || '').trim()
        let waiterId: number | null = null
        if (salesRaw && findSalesByCodeOrName) {
          try {
            const row = await findSalesByCodeOrName(salesRaw) as any
            if (row && row.id != null) waiterId = Number(row.id)
          } catch {
            waiterId = null
          }
        }

        add('transaction_number', transactionNumber, colsArr, valsArr)
        add('transaction_date', txDateISO, colsArr, valsArr)
        add('tgl_nota', txDateISO, colsArr, valsArr)
        add('customer_id', customerId, colsArr, valsArr)
        const dppGross = dppHeader + discountAmount
        add('subtotal', dppGross, colsArr, valsArr)
        add('discount_percent', 0, colsArr, valsArr)
        add('discount_amount', discountAmount, colsArr, valsArr)
        {
          const totalLineDiscounts = validatedItems.reduce((sum, { d }) => sum + (Number(d.discount_amount ?? 0) || 0), 0)
          add('total_discount', roundRp(totalLineDiscounts + discountAmount), colsArr, valsArr)
        }
        add('service_charge_percent', servicePercentDefault, colsArr, valsArr)
        add('service_charge_amount', serviceChargeAmount, colsArr, valsArr)
        add('ppn_percent', taxRatePercent, colsArr, valsArr)
        add('ppn_amount', taxAmount, colsArr, valsArr)
        add('total', grandTotal, colsArr, valsArr)
        // Summary pembayaran tetap disimpan di header transactions
        add('payment_method', headerPaymentMethod, colsArr, valsArr)
        add('payment_amount', headerPaymentAmount, colsArr, valsArr)
        add('change_amount', headerChangeAmount, colsArr, valsArr)
        add('card_number', headerCardNumber, colsArr, valsArr)
        add('bank_id', headerBankId, colsArr, valsArr)
        add('status', 'completed', colsArr, valsArr)
        // Gunakan nilai transaction_type dari Header jika ada (1=Resto,2=Retail,3=Invoice)
        const txTypeHdr = Number((h as any).transaction_type)
        const txType = (Number.isFinite(txTypeHdr) && [1,2,3].includes(txTypeHdr)) ? txTypeHdr : 1
        add('transaction_type', txType, colsArr, valsArr)
        add('period_id', period.id, colsArr, valsArr)
        add('due_date', null, colsArr, valsArr)
        add('payment_terms', null, colsArr, valsArr)
        add('notes', (h.keterangan || h.catatan || code), colsArr, valsArr)
        add('price_include_tax', priceIncludeTax ? 1 : 0, colsArr, valsArr)
        add('tax_rate_percent', taxRatePercent, colsArr, valsArr)
        add('warehouse_id', warehouseId, colsArr, valsArr)
        add('table_id', tableId, colsArr, valsArr)
        add('jumlah_tamu', h.jumlah_tamu ?? null, colsArr, valsArr)
        add('waiter_id', waiterId, colsArr, valsArr)
        add('user_create', userCreateId, colsArr, valsArr)

        // Build created_at from tanggalcreate + jamcreate (Excel columns)
        const pad2 = (n: number) => String(n).padStart(2, '0')
        const parseCreateDate = (dateStr: string | number | undefined | null): { y: number; m: number; d: number } | null => {
          if (!dateStr) return null
          // Check Excel serial number
          const numVal = typeof dateStr === 'number' ? dateStr : Number(dateStr)
          if (!isNaN(numVal) && numVal > 25569 && numVal < 100000) {
            const excelEpoch = Date.UTC(1899, 11, 30)
            const msPerDay = 24 * 60 * 60 * 1000
            const dt = new Date(excelEpoch + numVal * msPerDay)
            if (!isNaN(dt.getTime())) return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
          }
          const str = String(dateStr).trim()
          // dd/mm/yyyy
          const m1 = str.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/)
          if (m1) return { y: parseInt(m1[3], 10), m: parseInt(m1[2], 10), d: parseInt(m1[1], 10) }
          // yyyy-mm-dd
          const m2 = str.match(/^(\d{4})-([0-1]?\d)-([0-3]?\d)$/)
          if (m2) return { y: parseInt(m2[1], 10), m: parseInt(m2[2], 10), d: parseInt(m2[3], 10) }
          return null
        }
        const parseCreateTime = (timeStr: string | number | undefined | null): { hh: number; mm: number; ss: number } | null => {
          if (!timeStr) return null
          // Excel time fraction (0.5 = 12:00)
          const numVal = typeof timeStr === 'number' ? timeStr : Number(timeStr)
          if (!isNaN(numVal) && numVal >= 0 && numVal < 1) {
            const totalMinutes = Math.round(numVal * 24 * 60)
            const hh = Math.floor(totalMinutes / 60) % 24
            const mm = totalMinutes % 60
            return { hh, mm, ss: 0 }
          }
          const str = String(timeStr).trim()
          const m = str.match(/^([0-2]?\d):([0-5]?\d)(?::([0-5]?\d))?$/)
          if (!m) return null
          return { hh: Math.min(23, parseInt(m[1], 10) || 0), mm: Math.min(59, parseInt(m[2], 10) || 0), ss: Math.min(59, m[3] != null ? parseInt(m[3], 10) || 0 : 0) }
        }
        const createDatePart = parseCreateDate((h as any).tanggalcreate)
        const createTimePart = parseCreateTime((h as any).jamcreate)
        let createdAtLocal: string
        if (createDatePart && createTimePart) {
          createdAtLocal = `${createDatePart.y}-${pad2(createDatePart.m)}-${pad2(createDatePart.d)} ${pad2(createTimePart.hh)}:${pad2(createTimePart.mm)}:${pad2(createTimePart.ss)}`
        } else if (createDatePart) {
          // Only date provided, use 00:00:00
          createdAtLocal = `${createDatePart.y}-${pad2(createDatePart.m)}-${pad2(createDatePart.d)} 00:00:00`
        } else {
          // Fallback to current local time
          const nowLocal = new Date()
          createdAtLocal = `${nowLocal.getFullYear()}-${pad2(nowLocal.getMonth() + 1)}-${pad2(nowLocal.getDate())} ${pad2(nowLocal.getHours())}:${pad2(nowLocal.getMinutes())}:${pad2(nowLocal.getSeconds())}`
        }
        add('created_at', createdAtLocal, colsArr, valsArr)
        add('updated_at', createdAtLocal, colsArr, valsArr)

        const placeholders = colsArr.map((_, i) => `$${i + 1}`).join(', ')
        const sqlIns = `INSERT INTO transactions (${colsArr.join(', ')}) VALUES (${placeholders})`

        // Helper stok (jika infrastruktur tersedia)
        const stockInfraReady = hasStockMovements && hasStockBalance && hasMasterBarang
        const canStockOps = stockInfraReady

        // Retry jika unik bentrok: naikkan nomor dan coba lagi beberapa kali
        let transactionId: number | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const insResult = await pool.query(sqlIns, valsArr)
            transactionId = insResult.rows[0]?.id
            break
          } catch (insErr: any) {
            const msg = String(insErr?.message || '')
            if (msg.includes('unique') && msg.includes('transaction_number')) {
              transactionNumber = getNextNumber()
              const idxNum = colsArr.indexOf('transaction_number')
              if (idxNum >= 0) valsArr[idxNum] = transactionNumber
              continue
            }
            throw insErr
          }
        }
        if (!transactionId) throw new Error('Gagal menyimpan transaksi setelah beberapa percobaan')

        // Jika tabel transaction_payments tersedia, simpan detail pembayaran
        try {
          const payTable = await rawGet(`SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='transaction_payments'`) as any
          if (payTable && paymentsClean.length > 0) {
            // Ensure needed columns exist (non-destructive)
            try {
              const pcols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='transaction_payments'`) as { name: string }[]
              const pnames = new Set(pcols.map(c => String(c.name).toLowerCase()))
              if (!pnames.has('change_amount')) {
                await rawRun('ALTER TABLE transaction_payments ADD COLUMN change_amount REAL DEFAULT 0')
              }
            } catch {}

            // Hitung kembalian dulu
            const totalPaid = paymentsClean.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
            const excess = totalPaid - grandTotal
            const changeAmt = excess > 0 ? excess : 0

            // Ensure created_at/updated_at columns exist
            try {
              const pcolsAll = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='transaction_payments'`) as { name: string }[]
              const pnames = new Set(pcolsAll.map(c => String(c.name).toLowerCase()))
              if (!pnames.has('created_at')) {
                await rawRun('ALTER TABLE transaction_payments ADD COLUMN created_at TEXT')
              }
              if (!pnames.has('updated_at')) {
                await rawRun('ALTER TABLE transaction_payments ADD COLUMN updated_at TEXT')
              }
            } catch {}

            // Helper: resolve account_id untuk metode pembayaran
            const resolvePayAccount = async (method: string, bankId: number | null): Promise<number | null> => {
              const m = String(method).toLowerCase()
              if (m === 'cash' || m === 'tunai') {
                const mapping = await rawGet(`SELECT account_id FROM account_mappings WHERE map_group = 'pelanggan' AND map_key = 'default_cash_account'`) as any
                if (mapping?.account_id) return Number(mapping.account_id)
                const cashAcc = await rawGet(`SELECT id FROM accounts WHERE is_cash = 1 AND is_active = 1 ORDER BY code LIMIT 1`) as any
                return cashAcc?.id ?? null
              }
              if (bankId) {
                const bank = await rawGet(`SELECT account_id FROM master_banks WHERE id = ? AND account_id IS NOT NULL`, [bankId]) as any
                if (bank?.account_id) return Number(bank.account_id)
              }
              const bankAcc = await rawGet(`SELECT id FROM accounts WHERE is_bank_account = 1 AND is_active = 1 ORDER BY code LIMIT 1`) as any
              return bankAcc?.id ?? null
            }

            // Insert semua pembayaran; set change_amount pada baris cash pertama
            let cashChangeSet = false
            for (const p of paymentsClean) {
              const isCash = String(p.method).toLowerCase() === 'cash'
              const rowChange = (isCash && !cashChangeSet) ? changeAmt : 0
              if (isCash && !cashChangeSet) cashChangeSet = true
              const accountId = await resolvePayAccount(p.method, p.bankId)
              await rawRun(`
                INSERT INTO transaction_payments (
                  transaction_id, method, amount, bank_id, card_number, notes, change_amount, created_at, updated_at, account_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                transactionId,
                p.method,
                p.amount,
                p.bankId != null ? Number(p.bankId) : null,
                p.cardNumber != null ? String(p.cardNumber) : null,
                p.notes,
                rowChange,
                createdAtLocal,
                createdAtLocal,
                accountId
              ])
            }
          }
        } catch {
          // Jika gagal, jangan gagalkan seluruh transaksi import
        }

        // Auto-create AR Payment fisik untuk POS direct-payment
        try {
          if (paymentsClean.length > 0) {
            const existingArItem = await rawGet(`
              SELECT COUNT(*)::int as cnt FROM ar_payment_items pai
              JOIN ar_payments ap ON ap.id = pai.payment_id AND ap.status = 'active'
              WHERE pai.sale_id = ?
            `, [transactionId]) as any
            if (!existingArItem?.cnt) {
              const tps = await rawAll(`
                SELECT method, amount, change_amount, account_id 
                FROM transaction_payments WHERE transaction_id = ?
              `, [transactionId]) as any[]
              const allHaveAccount = tps.every((tp: any) => tp.account_id != null)
              if (tps.length > 0 && allHaveAccount) {
                const year = txDateISO.slice(0, 4)
                const last = await rawGet(`
                  SELECT payment_number FROM ar_payments 
                  WHERE payment_number LIKE ? ORDER BY payment_number DESC LIMIT 1
                `, [`AR/${year}/%`]) as any
                let seq = 1
                if (last?.payment_number) {
                  const parts = String(last.payment_number).split('/')
                  const lastSeq = parseInt(parts[2] || '0', 10)
                  seq = isNaN(lastSeq) ? 1 : lastSeq + 1
                }
                const paymentNumber = `AR/${year}/${String(seq).padStart(6, '0')}`
                let custName: string | null = null
                if (customerId) {
                  const c = await rawGet('SELECT name FROM master_customer WHERE id = ?', [customerId]) as any
                  if (c) custName = c.name
                }
                const arResult = await pool.query(`
                  INSERT INTO ar_payments (payment_number, payment_date, customer_id, customer_name, period_id, status, subtotal, total, notes, user_create, created_at)
                  VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, CURRENT_TIMESTAMP) RETURNING id
                `, [
                  paymentNumber, txDateISO,
                  customerId, custName,
                  period.id, grandTotal, grandTotal,
                  `Auto: ${custName || 'POS'} - ${transactionNumber}`,
                  userId || null,
                ])
                const arPaymentId = Number(arResult.rows[0].id)
                await rawRun(`
                  INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type)
                  VALUES (?, ?, ?, ?, ?, ?, 'transaction')
                `, [arPaymentId, transactionId, transactionNumber, grandTotal, grandTotal, 'Pembayaran POS otomatis'])
                for (const tp of tps as any[]) {
                  const netAmount = Number(tp.amount || 0) - Number(tp.change_amount || 0)
                  if (netAmount <= 0) continue
                  const acc = await rawGet('SELECT code, name FROM accounts WHERE id = ?', [Number(tp.account_id)]) as any
                  await rawRun(`
                    INSERT INTO ar_payment_methods (payment_id, account_id, account_code, account_name, amount)
                    VALUES (?, ?, ?, ?, ?)
                  `, [arPaymentId, Number(tp.account_id), acc?.code || '', acc?.name || '', netAmount])
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Import-Advanced] gagal auto-create AR Payment:', e)
        }

        // Ensure created_at/updated_at columns exist on transaction_items
        try {
          const icolsAll = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='transaction_items'`) as { name: string }[]
          const inames = new Set(icolsAll.map(c => String(c.name).toLowerCase()))
          if (!inames.has('created_at')) {
            await rawRun('ALTER TABLE transaction_items ADD COLUMN created_at TEXT')
          }
          if (!inames.has('updated_at')) {
            await rawRun('ALTER TABLE transaction_items ADD COLUMN updated_at TEXT')
          }
        } catch {}

        for (const { barang, d, qty } of validatedItems) {
          // Ambil satuan default dari barang_units (ratio terkecil), fallback ke 'pcs' jika tidak ada
          let unitName = 'pcs'
          let unitRatio = 1
          if (getDefaultUnitByBarang) {
            try {
              const u = await getDefaultUnitByBarang(barang.id) as any
              if (u) {
                if (u.name) unitName = String(u.name)
                if (u.unit_ratio != null) {
                  const r = Number(u.unit_ratio)
                  if (Number.isFinite(r) && r > 0) unitRatio = r
                }
              }
            } catch {
              // jika gagal, biarkan default 'pcs' dan 1
            }
          }

          const unitPrice = Number(d.unit_price ?? 0) || 0
          const lineDiscount = Number(d.discount_amount ?? 0) || 0
          const lineTotal = Number(d.total_price ?? 0) || 0

          await rawRun(`
            INSERT INTO transaction_items (
              transaction_id, barang_id, barang_code, barang_name,
              quantity, unit_name, unit_ratio, unit_price,
              discount_percent, discount_amount, total_price,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            transactionId,
            barang.id,
            barang.code,
            barang.name,
            qty,
            unitName,
            unitRatio,
            unitPrice,
            0,
            lineDiscount,
            lineTotal,
            createdAtLocal,
            createdAtLocal
          ])

          // Potong stok per gudang (jika aktif & infrastruktur tersedia)
          try {
            if (canStockOps) {
              const qtySold = Number(qty) || 0
              const warehouseForStock = Number(warehouseId || 1)
              const recipes = hasBarangRecipes
                ? (await rawAll('SELECT ingredient_id, quantity, unit FROM barang_recipes WHERE barang_id = ?', [barang.id]) as { ingredient_id:number; quantity:number; unit:string }[])
                : []

              // Cek stok apabila tidak boleh minus
              if (!allowNegativeStock) {
                if (recipes && recipes.length > 0) {
                  for (const r of recipes) {
                    const need = (Number(r.quantity)||0) * qtySold
                    if (need > 0) {
                      const chk = await checkStockAvailability(db as any, r.ingredient_id, warehouseForStock, need)
                      if (!chk.available) throw new Error(`Stok bahan kurang (ID ${r.ingredient_id}): ${chk.currentStock} < ${need}`)
                    }
                  }
                } else {
                  const unitsAsc = hasBarangUnits
                    ? (await rawAll('SELECT name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC', [barang.id]) as {name:string;ratio:number}[])
                    : [{name:unitName, ratio: unitRatio}]
                  const baseRatio = Number(unitsAsc[0]?.ratio || 1)
                  const needBase = qtySold * baseRatio
                  const chk = await checkStockAvailability(db as any, barang.id, warehouseForStock, needBase)
                  if (!chk.available) throw new Error(`Stok barang ${barang.code} kurang: ${chk.currentStock} < ${needBase}`)
                }
              }

              // Lakukan mutasi keluar
              if (recipes && recipes.length > 0) {
                for (const r of recipes) {
                  const used = (Number(r.quantity)||0) * qtySold
                  if (used > 0) {
                    try {
                      const ex = await rawGet(`SELECT 1 FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ? LIMIT 1`, [r.ingredient_id, warehouseForStock])
                      if (!ex) await rawRun(`INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, unit, updated_at) VALUES (?, ?, 0, ?, CURRENT_TIMESTAMP)`, [r.ingredient_id, warehouseForStock, r.unit || 'unit'])
                    } catch {}
                    await rawRun(`INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, notes) VALUES (?, ?, 'out', ?, ?, 'sale', ?, ?, ?, ?)`, [r.ingredient_id, warehouseForStock, used, r.unit||'unit', transactionId, period.id, txDateISO, `Import ${barang.code} x${qty}`])
                    await rawRun(`UPDATE stock_balance SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?`, [used, r.ingredient_id, warehouseForStock])
                  }
                }
              } else {
                const unitsAsc = hasBarangUnits
                  ? (await rawAll('SELECT name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC', [barang.id]) as {name:string;ratio:number}[])
                  : [{name:unitName, ratio: unitRatio}]
                const baseUnit = unitsAsc[0]?.name || unitName
                const baseRatio = Number(unitsAsc[0]?.ratio || 1)
                const usedBase = qtySold * baseRatio
                try {
                  const ex = await rawGet(`SELECT 1 FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ? LIMIT 1`, [barang.id, warehouseForStock])
                  if (!ex) await rawRun(`INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, unit, updated_at) VALUES (?, ?, 0, ?, CURRENT_TIMESTAMP)`, [barang.id, warehouseForStock, baseUnit])
                } catch {}
                await rawRun(`INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, notes) VALUES (?, ?, 'out', ?, ?, 'sale', ?, ?, ?, ?)`, [barang.id, warehouseForStock, usedBase, baseUnit, transactionId, period.id, txDateISO, `Import ${barang.code} x${qty}`])
                await rawRun(`UPDATE stock_balance SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?`, [usedBase, barang.id, warehouseForStock])
              }
            }
          } catch (stockErr) {
            throw stockErr
          }
        }

        results.success++
      } catch (e: any) {
        results.failed++
        results.errors.push({
          headerRow: headerRowIndex,
          transactioncode: String(h.transactioncode || ''),
          error: e.message || String(e),
        })
      }
    }

    if (!isDry) {
      if (results.failed > 0) {
        await pool.query('ROLLBACK')
        return NextResponse.json({
          message: `Import advanced dibatalkan: terdapat ${results.failed} error. Tidak ada data yang disimpan.`,
          results: { ...results, success: 0 },
        }, { status: 400 })
      }
      await pool.query('COMMIT')
    }

    if (isDry) {
      return NextResponse.json({
        message: `Preview advanced selesai: ${results.success} transaksi valid, ${results.failed} error`,
        results,
      })
    }

    return NextResponse.json({
      message: `Import advanced selesai: ${results.success} berhasil, 0 gagal`,
      results: { ...results, failed: 0 },
    })
  } catch (error: any) {
    console.error('Error in /api/transactions/import-advanced:', error)
    try { const pool = (getDb() as any).$client; pool.query('ROLLBACK') } catch {}
    return NextResponse.json(
      { error: 'Failed to import advanced transactions', details: error.message },
      { status: 500 },
    )
  }
}
