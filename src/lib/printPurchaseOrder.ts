export type PurchaseOrderForPrint = {
  id?: number
  po_number: string
  order_date?: string | null
  expected_date?: string | null
  supplier_name?: string | null
  supplier_code?: string | null
  notes?: string | null
  subtotal: number
  discount_percent?: number
  discount_amount: number
  ppn_percent?: number
  ppn_amount: number
  total: number
  items: Array<{
    barang_code?: string
    barang_name?: string
    quantity: number
    unit_name?: string
    unit_price?: number
    discount_percent?: number
    discount_amount?: number
    total_price: number
  }>
}

function formatRupiah(n: number): string {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
}

export async function printPurchaseOrder(po: PurchaseOrderForPrint, companyName?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const win = window.open('', '_blank', 'width=900,height=900')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
    // Optional: ambil nama perusahaan jika tidak dikirim
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

    const poData = po
    const dateStr = poData.order_date
      ? new Date(poData.order_date).toLocaleDateString('id-ID')
      : ''
    const expectedStr = poData.expected_date
      ? new Date(poData.expected_date).toLocaleDateString('id-ID')
      : '-'
    const supplierName = poData.supplier_name || '-'
    const supplierCode = poData.supplier_code || ''
    const notesClean = String(poData.notes || '')
    const items = Array.isArray(poData.items) ? poData.items : []

    const rowsHtml = items
      .map((it: any, idx: number) => {
        const rowNo = idx + 1
        const qty = Number(it.quantity) || 0
        const price = Number(it.unit_price) || 0
        const total = Number(it.total_price) || 0
        const discPct = Number(it.discount_percent || 0)
        return `<tr>
          <td class="text-center">${rowNo}</td>
          <td>${it.barang_code || ''}</td>
          <td>${it.barang_name || ''}</td>
          <td class="text-right">${qty}</td>
          <td class="text-center">${it.unit_name || ''}</td>
          <td class="text-right">${formatRupiah(price)}</td>
          <td class="text-right">${discPct ? discPct + ' %' : '-'}</td>
          <td class="text-right">${formatRupiah(total)}</td>
        </tr>`
      })
      .join('')

    // Batasi jumlah baris agar tetap 1 halaman A4 dan visualnya mendekati garis footer
    const fillerHtml = Array.from({ length: Math.max(0, 18 - items.length) })
      .map(
        () => `
        <tr>
          <td class="text-center">&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`
      )
      .join('')

    const subtotal = Number(poData.subtotal || 0)
    const discAmt = Number(poData.discount_amount || 0)
    const ppnAmt = Number(poData.ppn_amount || 0)
    const total = Number(poData.total || 0)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PO ${poData.po_number || ''}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
    .company { font-weight: 700; font-size: 18px; }
    .doc-title { text-align:right; }
    .doc-title h1 { margin:0; font-size: 18px; font-weight:800; }
    .meta { font-size: 12px; }
    .content { flex: 1 1 auto; display:flex; flex-direction:column; }
    .section-box { border:1px solid #9ca3af; padding:8px; margin-bottom:10px; }
    table { width:100%; border-collapse: collapse; }
    th, td { padding:4px 6px; }
    th { border-bottom:1px solid #6b7280; font-size:11px; text-align:left; }
    td { font-size:11px; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .items-wrapper { flex:1 1 auto; }
    .items tbody tr td { border-bottom: 1px dashed #e5e7eb; }
    .footer { margin-top:auto; padding-top:6px; border-top:1px solid #9ca3af; }
    .footer-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .section-box { border:1px solid #9ca3af; padding:6px 8px; }
    .notes-section { width: 260px; }
    .summary { width: 260px; border:1px solid #9ca3af; padding:6px 8px; }
    .summary-row { display:flex; justify-content:space-between; margin-bottom:2px; font-size:11px; }
    .notes-box { border:1px solid #9ca3af; min-height:40px; padding:4px; font-size:11px; margin-top:4px; }
    .sign-row { margin-top:16px; display:flex; justify-content:space-between; font-size:11px; }
    .sign-col { width:160px; text-align:center; }
    .sign-space { height:48px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div>
        <div class="company">${(company || '&nbsp;').toUpperCase()}</div>
        <div class="meta">Supplier: ${supplierCode ? supplierCode + ' - ' : ''}${supplierName}</div>
      </div>
      <div class="doc-title">
        <h1>PURCHASE ORDER</h1>
        <div class="meta">No. PO : ${poData.po_number || '-'}</div>
        <div class="meta">Tanggal : ${dateStr}</div>
        <div class="meta">Tgl Diharapkan : ${expectedStr}</div>
      </div>
    </div>

    <div class="content">
      <div class="items-wrapper">
        <table class="items">
          <thead>
            <tr>
              <th class="text-center" style="width:22px;">No</th>
              <th style="width:70px;">Kode</th>
              <th>Nama Barang</th>
              <th class="text-right" style="width:50px;">Qty</th>
              <th style="width:45px;">Unit</th>
              <th class="text-right" style="width:70px;">Harga</th>
              <th class="text-right" style="width:55px;">Disc</th>
              <th class="text-right" style="width:80px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${fillerHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <div class="footer-top">
        <div class="section-box notes-section">
          <strong>Catatan:</strong>
          <div class="notes-box">${notesClean ? notesClean.replace(/\n/g, '<br/>') : ''}</div>
        </div>

        <div class="summary">
          <div class="summary-row"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
          <div class="summary-row"><span>Diskon</span><span>- ${discAmt ? formatRupiah(discAmt) : 'Rp 0'}</span></div>
          <div class="summary-row"><span>PPN</span><span>${formatRupiah(ppnAmt)}</span></div>
          <div class="summary-row" style="border-top:1px solid #9ca3af; padding-top:3px; font-weight:700;"><span>Total</span><span>${formatRupiah(total)}</span></div>
        </div>
      </div>

      <div class="sign-row">
        <div class="sign-col">
          <div>Disiapkan oleh,</div>
          <div class="sign-space"></div>
          <div>(___________________)</div>
        </div>
        <div class="sign-col">
          <div>Disetujui oleh,</div>
          <div class="sign-space"></div>
          <div>(___________________)</div>
        </div>
      </div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  } catch (e) {
    console.error('Gagal membuka PO untuk cetak', e)
    alert('Gagal membuka PO untuk cetak')
    win.close()
  }
}

export async function printPurchaseOrderById(poId: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/purchase-orders/${poId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data PO untuk cetak')
      return
    }
    const data = await res.json()
    const po: PurchaseOrderForPrint = {
      id: data.id,
      po_number: data.po_number || data.poNumber,
      order_date: data.order_date || data.orderDate,
      expected_date: data.expected_date || data.expectedDate,
      supplier_name: data.supplier_name || data.supplierName,
      supplier_code: data.supplier_code || data.supplierCode,
      notes: data.notes || data.note,
      subtotal: Number(data.subtotal || 0),
      discount_percent: Number(data.discount_percent || 0),
      discount_amount: Number(data.discount_amount || 0),
      ppn_percent: Number(data.ppn_percent || 0),
      ppn_amount: Number(data.ppn_amount || 0),
      total: Number(data.total || 0),
      items: Array.isArray(data.items)
        ? data.items.map((it: any) => ({
            barang_code: it.barang_code,
            barang_name: it.barang_name,
            quantity: Number(it.quantity || 0),
            unit_name: it.unit_name,
            unit_price: Number(it.unit_price || 0),
            discount_percent: Number(it.discount_percent || 0),
            discount_amount: Number(it.discount_amount || 0),
            total_price: Number(it.total_price || 0),
          }))
        : [],
    }
    await printPurchaseOrder(po)
  } catch (e) {
    console.error('Gagal mengambil data PO', e)
    alert('Gagal mengambil data PO untuk cetak')
  }
}
