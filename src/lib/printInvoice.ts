/**
 * Fungsi cetak invoice dengan desain Faktur Penjualan A5
 * Digunakan di: list invoice, add invoice, edit invoice
 */

type InvoiceData = {
  id?: number
  transaction_number: string
  tgl_nota?: string
  transaction_date?: string
  created_at?: string
  due_date?: string
  customer_name?: string
  customer_code?: string
  notes?: string
  subtotal: number
  discount_amount: number
  discount_percent?: number
  ppn_amount: number
  ppn_percent?: number
  total: number
  items: Array<{
    barang_name?: string
    barang_id?: number
    quantity: number
    unit_name?: string
    unit_price?: number
    total_price: number
    discon_total?: number
    discount_amount?: number
    discount_percent?: number
    disc1_percent?: number
    disc2_percent?: number
    disc3_percent?: number
    disc_nominal?: number
  }>
}

/**
 * Buka window print invoice dengan desain Faktur Penjualan
 * @param invoiceData - Data invoice lengkap dengan items
 * @param companyName - Nama perusahaan (opsional, akan di-fetch jika tidak disediakan)
 */
export async function printInvoice(invoiceData: InvoiceData, companyName?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
    // Fetch company name jika tidak disediakan
    let company = companyName || ''
    if (!company) {
      try {
        const compRes = await fetch('/api/settings?group=company')
        if (compRes.ok) {
          const rows = await compRes.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => {
            map[r.setting_key] = String(r.setting_value ?? '')
          })
          company = map['company_name'] || ''
        }
      } catch {}
    }

    const tx = invoiceData
    const dateStr = new Date(tx.tgl_nota || tx.transaction_date || tx.created_at || new Date()).toLocaleDateString('id-ID')
    const dueStr = tx.due_date ? new Date(tx.due_date).toLocaleDateString('id-ID') : '-'
    const customerName = tx.customer_name || '-'
    const notesClean = String(tx.notes || '')
    // gunakan semua item, pagination akan membagi per 10 baris per halaman
    const items = Array.isArray(tx.items) ? tx.items : []
    const sumQty = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
    const rup = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
    const bruto = Number(tx.subtotal || 0) + Number(tx.discount_amount || 0)
    const netto = Number(tx.total || 0)

    // Fungsi terbilang sederhana (jutaan-an)
    const smallTerbilang = (num: number): string => {
      if (num === 0) return 'nol'
      const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']
      const belasan = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas']
      const puluhan = ['', 'sepuluh', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh', 'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh']
      const ratusan = ['', 'seratus', 'dua ratus', 'tiga ratus', 'empat ratus', 'lima ratus', 'enam ratus', 'tujuh ratus', 'delapan ratus', 'sembilan ratus']
      const toWords = (n: number): string => {
        if (n === 0) return '' // Return empty for remainder, not 'nol'
        if (n < 10) return satuan[n]
        if (n < 20) return belasan[n - 10]
        if (n < 100) return (puluhan[Math.floor(n / 10)] + ' ' + satuan[n % 10]).trim()
        if (n < 1000) return (ratusan[Math.floor(n / 100)] + ' ' + toWords(n % 100)).trim()
        if (n < 1000000) return (toWords(Math.floor(n / 1000)) + ' ribu ' + toWords(n % 1000)).trim()
        if (n < 1000000000) return (toWords(Math.floor(n / 1000000)) + ' juta ' + toWords(n % 1000000)).trim()
        return ''
      }
      return toWords(Math.floor(num)).replace(/\s+/g, ' ').trim()
    }
    const terbilangText = smallTerbilang(netto)

    // Bagi items per halaman (maks 10 baris per halaman)
    const itemsPerPage = 10
    const pages: any[][] = []
    for (let i = 0; i < items.length; i += itemsPerPage) {
      pages.push(items.slice(i, i + itemsPerPage))
    }

    const globalDisc = Number(tx.discount_amount) || 0
    const globalPpn = Number(tx.ppn_amount) || 0

    const pagesHtml = pages
      .map((pageItems, pageIndex) => {
        const isLast = pageIndex === pages.length - 1
        const pageSubTotal = pageItems.reduce(
          (s: number, it: any) => s + (Number(it.total_price) || 0),
          0
        )
        const pageBruto = isLast || pages.length === 1 ? bruto : pageSubTotal

        const rowsHtml = pageItems
          .map((it: any, idx: number) => {
            const rowNumber = pageIndex * itemsPerPage + idx + 1
            const qty = Number(it.quantity) || 0
            const tot = Number(it.total_price) || 0
            const unit =
              Number(it.unit_price) || (qty > 0 ? Math.round(tot / qty) : 0)
            const discPct = Number(it.discount_percent || 0)
            const disc1 = Number(it.disc1_percent || 0)
            const disc2 = Number(it.disc2_percent || 0)
            const disc3 = Number(it.disc3_percent || 0)
            const discRp = Number(it.disc_nominal || 0)
            const discStr = `${discPct}%+${disc1}%+${disc2}%+${disc3}% Rp${discRp.toLocaleString('id-ID')}`
            return `<tr>
            <td class="text-center">${rowNumber}</td>
            <td>${it.barang_name || it.name || ''}</td>
            <td class="text-center">${qty} ${it.unit_name || it.unit || ''}</td>
            <td class="text-right">${rup(unit)}</td>
            <td class="text-center disc-cell">${discStr}</td>
            <td class="text-right">${rup(tot)}</td>
          </tr>`
          })
          .join('')

        const fillerRowsHtml = Array.from({
          length: Math.max(0, itemsPerPage - pageItems.length)
        })
          .map(
            () => `
          <tr>
            <td class="text-center">&nbsp;</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>`
          )
          .join('')

        const leftSummaryHtml = isLast || pages.length === 1
          ? `
        <div style="margin-top:4px; border-top:1px solid #9ca3af; padding-top:3px; font-size:12px;">
          <strong>Total Qty :</strong> ${sumQty}
        </div>
        <div style="margin-top:6px; font-size:12px;">
          <div><strong>Terbilang :</strong> ${terbilangText ? terbilangText + ' rupiah' : '-'}</div>
        </div>
        <div class="keterangan">
          <div style="margin-bottom:2px; font-weight:600; font-size:12px;">Keterangan :</div>
          <div class="ket-box">${notesClean ? notesClean.replace(/\n/g, '<br/>') : ''}</div>
        </div>`
          : `
        <div style="margin-top:4px; border-top:1px solid #9ca3af; padding-top:0; font-size:12px; min-height:6mm;"></div>`

        const rightSummaryHtml = isLast || pages.length === 1
          ? `
        <div class="row"><span>Bruto</span><span>${rup(bruto)}</span></div>
        <div class="row"><span>Disc</span><span>${globalDisc ? '- ' + rup(globalDisc) : '-'}</span></div>
        <div class="row"><span>PPN</span><span>${rup(globalPpn)}</span></div>
        <div class="row" style="border-top:1px solid #9ca3af; padding-top:2px; font-weight:700;"><span>Netto</span><span>${rup(netto)}</span></div>`
          : `
        <div class="row"><span>Bruto</span><span>${rup(pageBruto)}</span></div>`

        const totalsRowHtml = (leftSummaryHtml || rightSummaryHtml)
          ? `
      <div class="totals-row">
        <div style="flex:1">
          ${leftSummaryHtml}
        </div>
        <div class="right-box">
          ${rightSummaryHtml}
        </div>
      </div>`
          : ''

        return `
    <div class="page">
      <div class="header">
        <div class="header-title">
          <div class="header-left">${(company || ' ').toUpperCase()}</div>
          <div class="header-right" style="text-align:right;">
            <h1>FAKTUR PENJUALAN</h1>
            <div class="meta">No. Faktur : ${tx.transaction_number || '-'}</div>
            <div class="meta">Tanggal : ${dateStr}</div>
            <div class="meta">Jatuh Tempo : ${dueStr}</div>
            <div class="meta">Customer : ${customerName}</div>
          </div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="text-center" style="width:10mm">No.</th>
            <th>Nama Barang</th>
            <th class="text-center" style="width:32mm">Jumlah</th>
            <th class="text-right" style="width:28mm">Harga</th>
            <th class="text-center" style="width:38mm">Diskon</th>
            <th class="text-right" style="width:30mm">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${fillerRowsHtml}
        </tbody>
      </table>

      ${totalsRowHtml}
    </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${tx.transaction_number || ''}</title>
  <style>
    /* A5 landscape-ish layout: lebar 210mm, tinggi sedikit di bawah 150mm agar tidak pecah 2 halaman */
    @page { size: 210mm 150mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: 210mm; height: 145mm; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; color: #111827; }
    .wrapper { width: 210mm; height: 145mm; padding: 0; box-sizing: border-box; }
    .page { width: 210mm; height: 145mm; border: 1px solid #374151; box-sizing: border-box; padding: 3mm 4mm; display: flex; flex-direction: column; }
    .header { margin-bottom: 3mm; border-bottom: 1px solid #374151; padding-bottom: 1mm; }
    .header-title { display:flex; justify-content:space-between; align-items:flex-start; }
    .header-left { font-weight: 800; font-size: 18px; letter-spacing: 0.5px; }
    .header-right h1 { font-size: 18px; margin: 0; font-weight: 800; }
    .meta { font-size: 12px; color:#111827; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { border-bottom: 1px solid #374151; font-size: 11px; text-align:left; padding: 2px 3px; }
    td { font-size: 11px; padding: 2px 3px; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .disc-cell { font-size: 9px; white-space: nowrap; }
    .items tbody tr td { border-bottom: 1px dashed #cbd5e1; }
    .totals-row { display:flex; justify-content:space-between; align-items:flex-start; gap: 3mm; margin-top: 2mm; }
    .right-box { width: 58mm; border: 1px solid #374151; padding: 2mm; box-sizing: border-box; }
    .right-box .row { display:flex; justify-content:space-between; margin-bottom: 1px; font-size: 11px; }
    .keterangan { margin-top: 2mm; }
    .ket-box { border: 1px solid #9ca3af; min-height: 12mm; max-height: 18mm; padding: 1mm; font-size: 10px; overflow: hidden; }
  </style>
</head>
<body>
  <div class="wrapper">
    ${pagesHtml}
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  } catch (e) {
    console.error('Gagal membuka invoice untuk cetak', e)
    alert('Gagal membuka invoice untuk cetak')
    win.close()
  }
}

/**
 * Fetch data invoice dari API dan langsung print
 * @param invoiceId - ID invoice yang akan dicetak
 */
export async function printInvoiceById(invoiceId: number): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const res = await fetch(`/api/transactions/${invoiceId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data invoice untuk cetak')
      return
    }
    const tx = await res.json()
    await printInvoice(tx)
  } catch (e) {
    console.error('Gagal mengambil data invoice', e)
    alert('Gagal mengambil data invoice untuk cetak')
  }
}
