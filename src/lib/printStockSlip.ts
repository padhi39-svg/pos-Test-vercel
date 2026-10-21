type StockSlipItem = {
  name: string
  code?: string
  qty: number
  unit?: string
}

export type StockSlipHeader = {
  number: string
  date: string
  type: 'transfer' | 'usage' | 'opname'
  fromWarehouse?: string | null
  toWarehouse?: string | null
  warehouse?: string | null
  notes?: string | null
}

export type StockSlipData = {
  header: StockSlipHeader
  items: StockSlipItem[]
}

export async function printStockSlip(data: StockSlipData): Promise<void> {
  if (typeof window === 'undefined') return

  const { header, items } = data
  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
    const sumQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
    const totalItems = items.length

    const typeTitle =
      header.type === 'transfer'
        ? 'SLIP TRANSFER STOK'
        : header.type === 'usage'
        ? 'SLIP PEMAKAIAN STOK'
        : 'SLIP DRAFT OPNAME'

    const itemsPerPage = 13
    const pages: StockSlipItem[][] = []
    for (let i = 0; i < items.length; i += itemsPerPage) {
      pages.push(items.slice(i, i + itemsPerPage))
    }

    const pagesHtml = pages
      .map((pageItems, pageIndex) => {
        const isLast = pageIndex === pages.length - 1
        const rowsHtml = pageItems
          .map((it, idx) => {
            const rowNo = pageIndex * itemsPerPage + idx + 1
            const label = it.code ? `${it.code} - ${it.name}` : it.name
            return `<tr>
              <td class="text-center">${rowNo}</td>
              <td>${label || ''}</td>
              <td class="text-right">${Number(it.qty) || 0}</td>
              <td>${it.unit || ''}</td>
            </tr>`
          })
          .join('')

        const fillerRowsHtml = Array.from({
          length: Math.max(0, itemsPerPage - pageItems.length),
        })
          .map(
            () => `
            <tr>
              <td class="text-center">&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`
          )
          .join('')

        const footerHtml = isLast
          ? `
        <div class="footer-row">
          <div class="left">
            <div><strong>Total Qty :</strong> ${sumQty}</div>
            <div><strong>Total Barang :</strong> ${totalItems}</div>
          </div>
        </div>`
          : ''

        const whInfo = (() => {
          if (header.type === 'transfer') {
            return `Gudang Asal : ${header.fromWarehouse || '-'}<br/>Gudang Tujuan : ${
              header.toWarehouse || '-'
            }`
          }
          if (header.type === 'usage') {
            return `Gudang : ${header.warehouse || '-'}
            ${header.notes ? `<br/>Keterangan : ${header.notes}` : ''}`
          }
          if (header.type === 'opname') {
            return `Gudang : ${header.warehouse || '-'}
            ${header.notes ? `<br/>Keterangan : ${header.notes}` : ''}`
          }
          return ''
        })()

        return `
      <div class="page">
        <div class="header">
          <div class="header-title">
            <div class="header-left"></div>
            <div class="header-right" style="text-align:right;">
              <h1>${typeTitle}</h1>
              <div class="meta">No. Dokumen : ${header.number || '-'}</div>
              <div class="meta">Tanggal : ${header.date || '-'}</div>
              <div class="meta">${whInfo}</div>
            </div>
          </div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th class="text-center" style="width:10mm">No.</th>
              <th>Nama Barang</th>
              <th class="text-right" style="width:25mm">Qty</th>
              <th class="text-left" style="width:30mm">Satuan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${fillerRowsHtml}
          </tbody>
        </table>

        ${footerHtml}
      </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${typeTitle} ${header.number || ''}</title>
  <style>
    /* A5 landscape-like layout: samakan dengan invoice (210mm x ~145mm) agar konsisten */
    @page { size: 210mm 150mm; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 145mm;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      color: #111827;
    }
    .wrapper {
      width: 210mm;
      height: 145mm;
      margin: 0 auto;
      box-sizing: border-box;
      padding: 0;
    }
    .page {
      width: 210mm;
      height: 145mm;
      border: 1px solid #374151;
      box-sizing: border-box;
      padding: 4mm 5mm;
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .header { margin-bottom: 3mm; border-bottom: 1px solid #374151; padding-bottom: 1mm; }
    .header-title { display:flex; justify-content:space-between; align-items:flex-start; }
    .header-right h1 { font-size: 16px; margin: 0; font-weight: 800; }
    .meta { font-size: 12px; color:#111827; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { border-bottom: 1px solid #374151; font-size: 11px; text-align:left; padding: 2px 3px; }
    td { font-size: 11px; padding: 2px 3px; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .items tbody tr td { border-bottom: 1px dashed #cbd5e1; }
    .footer-row { display:flex; justify-content:flex-start; margin-top: 3mm; border-top:1px solid #9ca3af; padding-top:3px; font-size:12px; }
    .footer-row .left { flex:1; }
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
    console.error('Gagal membuka slip stok untuk cetak', e)
    alert('Gagal membuka slip stok untuk cetak')
    win.close()
  }
}

// Helper: Transfer Stok by ID
export async function printTransferSlipById(id: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/stock-transfers/${id}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data transfer stok untuk cetak')
      return
    }
    const json = await res.json() as any
    const h = json.header || {}
    const items = Array.isArray(json.items) ? json.items : []
    const data: StockSlipData = {
      header: {
        type: 'transfer',
        number: String(h.number || ''),
        date: String(h.tdate || h.created_at || new Date().toISOString()).slice(0, 10),
        fromWarehouse: h.from_warehouse || String(h.from_warehouse_id || ''),
        toWarehouse: h.to_warehouse || String(h.to_warehouse_id || ''),
        notes: h.notes || null,
      },
      items: items.map((it: any) => ({
        name: String(it.barang_name || ''),
        code: it.barang_code ? String(it.barang_code) : undefined,
        qty: Number(it.qty) || 0,
        unit: String(it.unit_name || ''),
      })),
    }
    await printStockSlip(data)
  } catch (e) {
    console.error('Gagal mengambil data transfer stok', e)
    alert('Gagal mengambil data transfer stok untuk cetak')
  }
}

// Helper: Pemakaian Stok by ID
export async function printUsageSlipById(id: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/stock-usage/${id}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data pemakaian stok untuk cetak')
      return
    }
    const json = await res.json() as any
    const h = json.header || {}
    const items = Array.isArray(json.items) ? json.items : []
    const data: StockSlipData = {
      header: {
        type: 'usage',
        number: String(h.number || ''),
        date: String(h.tdate || h.created_at || new Date().toISOString()).slice(0, 10),
        warehouse: h.warehouse || String(h.warehouse_id || ''),
        notes: h.notes || null,
      },
      items: items.map((it: any) => ({
        name: String(it.barang_name || ''),
        code: it.barang_code ? String(it.barang_code) : undefined,
        qty: Number(it.qty) || 0,
        unit: String(it.unit_name || ''),
      })),
    }
    await printStockSlip(data)
  } catch (e) {
    console.error('Gagal mengambil data pemakaian stok', e)
    alert('Gagal mengambil data pemakaian stok untuk cetak')
  }
}
