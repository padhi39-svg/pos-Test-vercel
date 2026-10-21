export async function printManufaktur(data: any): Promise<void> {
  if (typeof window === 'undefined') return

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
    let company = ''
    try {
      const compRes = await fetch('/api/settings?group=company')
      if (compRes.ok) {
        const rows = await compRes.json()
        const map: Record<string, string> = {}
        ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
        company = map['company_name'] || ''
      }
    } catch {}

    const rup = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
    const dateStr = new Date(data.tanggal).toLocaleDateString('id-ID')
    const details = Array.isArray(data.details) ? data.details : []
    const biayaList = Array.isArray(data.biaya) ? data.biaya : []

    const itemsPerPage = 12
    const pages: any[][] = []
    for (let i = 0; i < details.length; i += itemsPerPage) {
      pages.push(details.slice(i, i + itemsPerPage))
    }
    if (pages.length === 0) pages.push([])

    const pagesHtml = pages
      .map((pageItems, pageIndex) => {
        const isLast = pageIndex === pages.length - 1
        const rowsHtml = pageItems
          .map((d: any, idx: number) => {
            const rowNo = pageIndex * itemsPerPage + idx + 1
            return `<tr>
              <td class="text-center">${rowNo}</td>
              <td>${d.barang_code ? `${d.barang_code} - ${d.barang_name}` : (d.barang_name || '-')}</td>
              <td class="text-center">${d.quantity || 0}</td>
              <td class="text-right">${rup(d.hpp_satuan || 0)}</td>
              <td class="text-right">${rup(d.total_hpp || 0)}</td>
            </tr>`
          })
          .join('')

        const fillerRowsHtml = Array.from({ length: Math.max(0, itemsPerPage - pageItems.length) })
          .map(() => `<tr>
            <td class="text-center">&nbsp;</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>`)
          .join('')

        const notesHtml = isLast
          ? `<div class="notes-row">
              <div class="left">
                ${data.notes ? `<div><strong>Catatan :</strong><div class="ket-box">${String(data.notes).replace(/\n/g, '<br/>')}</div></div>` : ''}
              </div>
              <div class="right-box">
                <div class="row"><span>Total Biaya Bahan</span><span>${rup(data.total_biaya_bahan || 0)}</span></div>
                <div class="row"><span>Total Biaya Lain</span><span>${rup(data.total_biaya_lain || 0)}</span></div>
                <div class="row" style="border-top:1px solid #374151;padding-top:2px;font-weight:700;"><span>Grand Total</span><span>${rup(data.total_biaya || 0)}</span></div>
              </div>
            </div>`
          : ''

        const biayaHtml = isLast && biayaList.length > 0
          ? `<div class="biaya-section">
              <h3 style="font-size:11px;margin:4px 0 2px;font-weight:700;">Biaya Lain</h3>
              <table class="items" style="margin-bottom:2mm;">
                <thead>
                  <tr>
                    <th>Akun</th>
                    <th>Keterangan</th>
                    <th class="text-right" style="width:28mm">Debit</th>
                    <th class="text-right" style="width:28mm">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  ${biayaList.map((b: any) => `<tr>
                    <td>${b.account_code ? `${b.account_code} - ${b.account_name}` : (b.account_name || '-')}</td>
                    <td>${b.notes || '-'}</td>
                    <td class="text-right">${b.debit ? rup(b.debit) : '-'}</td>
                    <td class="text-right">${b.credit ? rup(b.credit) : '-'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`
          : ''

        return `<div class="page">
          <div class="header">
            <div class="header-title">
              <div class="header-left">${(company || ' ').toUpperCase()}</div>
              <div class="header-right" style="text-align:right;">
                <h1>MANUFAKTUR</h1>
                <div class="meta">No. MF : ${data.nomor || '-'}</div>
                <div class="meta">Tanggal : ${dateStr}</div>
                <div class="meta">Barang Jadi : ${data.barang_code ? `${data.barang_code} - ${data.barang_name}` : (data.barang_name || '-')}</div>
                <div class="meta">Qty Produksi : ${data.quantity || 0}</div>
              </div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th class="text-center" style="width:10mm">No.</th>
                <th>Bahan Baku</th>
                <th class="text-center" style="width:20mm">Qty</th>
                <th class="text-right" style="width:28mm">HPP Satuan</th>
                <th class="text-right" style="width:28mm">Total HPP</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${fillerRowsHtml}
            </tbody>
          </table>

          ${biayaHtml}
          ${notesHtml}
        </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Manufaktur ${data.nomor || ''}</title>
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
    .items tbody tr td { border-bottom: 1px dashed #cbd5e1; }
    .notes-row { display:flex; justify-content:space-between; align-items:flex-start; gap: 3mm; margin-top: 2mm; flex:1; }
    .notes-row .left { flex:1; }
    .right-box { width: 58mm; border: 1px solid #374151; padding: 2mm; box-sizing: border-box; }
    .right-box .row { display:flex; justify-content:space-between; margin-bottom: 1px; font-size: 11px; }
    .ket-box { border: 1px solid #9ca3af; min-height: 10mm; max-height: 14mm; padding: 1mm; font-size: 10px; overflow: hidden; }
    .biaya-section { margin-top: 0; }
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
    alert('Gagal mencetak: ' + (e as any)?.message)
    win.close()
  }
}

export async function printManufakturById(id: number): Promise<void> {
  const res = await fetch(`/api/manufaktur/${id}?t=${Date.now()}`, { cache: 'no-store' })
  const data = await res.json()
  await printManufaktur(data)
}
