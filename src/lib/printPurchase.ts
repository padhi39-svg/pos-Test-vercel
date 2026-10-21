type PurchasePrint = {
  id?: number
  purchase_number: string
  purchase_date?: string
  supplier_name?: string | null
  invoice_number?: string | null
  notes?: string | null
  subtotal: number
  discount_amount: number
  discount_percent?: number
  ppn_amount: number
  ppn_percent?: number
  total: number
  items: Array<{
    barang_name?: string
    quantity: number
    unit_name?: string
    unit_price?: number
    discount_percent?: number
    discount_amount?: number
    disc1_percent?: number
    disc2_percent?: number
    disc3_percent?: number
    disc_nominal?: number
    total_price: number
  }>
}

const rupiah = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')

export async function printPurchase(p: PurchasePrint, companyName?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
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

    const dateStr = p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('id-ID') : ''
    const notesClean = String(p.notes || '')
    const items = Array.isArray(p.items) ? p.items : []

    const itemsPerPage = 10
    const pages: any[][] = []
    for (let i = 0; i < items.length; i += itemsPerPage) {
      pages.push(items.slice(i, i + itemsPerPage))
    }

    const pagesHtml = pages
      .map((pageItems, pageIndex) => {
        const rowsHtml = pageItems
          .map((it: any, idx: number) => {
            const rowNumber = pageIndex * itemsPerPage + idx + 1
            const qty = Number(it.quantity) || 0
            const tot = Number(it.total_price) || 0
            const unit = Number(it.unit_price) || (qty > 0 ? Math.round(tot / qty) : 0)
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
            <td class="text-right">${rupiah(unit)}</td>
            <td class="text-center disc-cell">${discStr}</td>
            <td class="text-right">${rupiah(tot)}</td>
          </tr>`
          })
          .join('')

        const fillerRowsHtml = Array.from({ length: Math.max(0, itemsPerPage - pageItems.length) })
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

        const isLast = pageIndex === pages.length - 1
        const leftSummaryHtml = isLast || pages.length === 1
          ? `
        <div style="margin-top:4px; border-top:1px solid #9ca3af; padding-top:3px; font-size:12px;">
          <strong>Catatan :</strong>
          <div class="ket-box">${notesClean ? notesClean.replace(/\n/g, '<br/>') : ''}</div>
        </div>`
          : ''

        const rightSummaryHtml = isLast || pages.length === 1
          ? `
        <div class="row"><span>Subtotal</span><span>${rupiah(p.subtotal || 0)}</span></div>
        <div class="row"><span>Diskon</span><span>${p.discount_amount ? '- ' + rupiah(p.discount_amount) : '-'}</span></div>
        <div class="row"><span>PPN</span><span>${rupiah(p.ppn_amount || 0)}</span></div>
        <div class="row" style="border-top:1px solid #9ca3af; padding-top:2px; font-weight:700;"><span>Total</span><span>${rupiah(p.total || 0)}</span></div>`
          : ''

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
            <h1>PEMBELIAN</h1>
            <div class="meta">No. PB : ${p.purchase_number || '-'}</div>
            <div class="meta">Tanggal : ${dateStr}</div>
            <div class="meta">Supplier : ${p.supplier_name || '-'}</div>
            <div class="meta">Kode Nota Supplier : ${p.invoice_number || '-'}</div>
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
  <title>Pembelian ${p.purchase_number || ''}</title>
  <style>
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
    console.error('Gagal membuka pembelian untuk cetak', e)
    alert('Gagal membuka pembelian untuk cetak')
    win.close()
  }
}

export async function printPurchaseById(purchaseId: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/purchases/${purchaseId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data pembelian untuk cetak')
      return
    }
    const data = await res.json()
    const p: PurchasePrint = {
      id: data.id,
      purchase_number: data.purchase_number,
      purchase_date: data.purchase_date,
      supplier_name: data.supplier_name,
      invoice_number: data.invoice_number,
      notes: data.notes,
      subtotal: Number(data.subtotal || 0),
      discount_percent: Number(data.discount_percent || 0),
      discount_amount: Number(data.discount_amount || 0),
      ppn_percent: Number(data.ppn_percent || 0),
      ppn_amount: Number(data.ppn_amount || 0),
      total: Number(data.total || 0),
      items: Array.isArray(data.items)
        ? data.items.map((it: any) => ({
            barang_name: it.barang_name,
            quantity: Number(it.quantity || 0),
            unit_name: it.unit_name,
            unit_price: Number(it.unit_price || 0),
            discount_percent: Number(it.discount_percent || 0),
            discount_amount: Number(it.discount_amount || 0),
            disc1_percent: Number(it.disc1_percent || 0),
            disc2_percent: Number(it.disc2_percent || 0),
            disc3_percent: Number(it.disc3_percent || 0),
            disc_nominal: Number(it.disc_nominal || 0),
            total_price: Number(it.total_price || 0),
          }))
        : [],
    }
    await printPurchase(p)
  } catch (e) {
    console.error('Gagal mengambil data pembelian', e)
    alert('Gagal mengambil data pembelian untuk cetak')
  }
}
