const rupiah = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')

export async function printApPayment(paymentId: number): Promise<void> {
  if (typeof window === 'undefined') return

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
    const res = await fetch(`/api/ap-payments/${paymentId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data pembayaran untuk cetak')
      return
    }
    const data = await res.json()

    let company = ''
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

    const dateStr = data.payment_date ? new Date(data.payment_date).toLocaleDateString('id-ID') : ''
    const notesClean = String(data.notes || '')
    const detail = Array.isArray(data.detail) ? data.detail : []
    const methods = Array.isArray(data.methods) ? data.methods : []
    const extras = Array.isArray(data.extras) ? data.extras : []

    const subtotalDetail = detail.reduce((a: number, b: any) => {
      const st = String(b.source_type || '').toLowerCase()
      if (st === 'ap_advance') return a
      return a + (Number(b.pay_amount) || 0)
    }, 0)
    const advanceTotal = detail.reduce((a: number, b: any) => {
      const st = String(b.source_type || '').toLowerCase()
      if (st !== 'ap_advance') return a
      return a + Math.abs(Number(b.pay_amount) || 0)
    }, 0)
    const totalMethods = methods.reduce((a: number, b: any) => a + (Number(b.amount) || 0), 0)
    const totalExtraDebit = extras.reduce((a: number, b: any) => a + (Number(b.debit) || 0), 0)
    const totalExtraCredit = extras.reduce((a: number, b: any) => a + (Number(b.credit) || 0), 0)
    const expectedMethods = subtotalDetail - advanceTotal + totalExtraDebit - totalExtraCredit

    const detailRowsPerPage = 8
    const detailPages: any[][] = []
    for (let i = 0; i < detail.length; i += detailRowsPerPage) {
      detailPages.push(detail.slice(i, i + detailRowsPerPage))
    }

    const pagesHtml = detailPages
      .map((pageItems, pageIndex) => {
        const rowsHtml = pageItems
          .map((it: any, idx: number) => {
            const rowNumber = pageIndex * detailRowsPerPage + idx + 1
            return `<tr>
              <td class="text-center">${rowNumber}</td>
              <td>${it.invoice_number || '-'}</td>
              <td class="text-center">${it.invoice_supplier_number || '-'}</td>
              <td class="text-center">${it.invoice_date || '-'}</td>
              <td class="text-right">${rupiah(Number(it.due_amount || 0))}</td>
              <td class="text-right">${rupiah(Number(it.pay_amount || 0))}</td>
              <td>${it.remarks || '-'}</td>
            </tr>`
          })
          .join('')

        const fillerRowsHtml = Array.from({ length: Math.max(0, detailRowsPerPage - pageItems.length) })
          .map(() => `<tr>
            <td class="text-center">&nbsp;</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>`)
          .join('')

        const isLast = pageIndex === detailPages.length - 1

        const metodeRowsHtml = isLast
          ? methods
              .map(
                (m: any) =>
                  `<tr>
                <td class="text-right">${m.account_code || '-'}</td>
                <td>${m.account_name || '-'}</td>
                <td class="text-right">${rupiah(Number(m.amount || 0))}</td>
                <td>${m.notes || '-'}</td>
              </tr>`
              )
              .join('')
          : ''

        const extrasRowsHtml =
          isLast && extras.length
            ? extras
                .map(
                  (x: any) =>
                    `<tr>
                  <td class="text-right">${x.account_code || '-'}</td>
                  <td>${x.account_name || '-'}</td>
                  <td>${x.notes || '-'}</td>
                  <td class="text-right">${rupiah(Number(x.debit || 0))}</td>
                  <td class="text-right">${rupiah(Number(x.credit || 0))}</td>
                </tr>`
                )
                .join('')
            : ''

        const summaryHtml = isLast
          ? `<div class="right-box">
          <div class="row"><span>Subtotal Nota</span><span>${rupiah(subtotalDetail)}</span></div>
          ${advanceTotal ? `<div class="row"><span>Uang Muka</span><span>${rupiah(advanceTotal)}</span></div>` : ''}
          ${totalExtraDebit ? `<div class="row"><span>Debit Lain</span><span>${rupiah(totalExtraDebit)}</span></div>` : ''}
          ${totalExtraCredit ? `<div class="row"><span>Kredit Lain</span><span>${rupiah(totalExtraCredit)}</span></div>` : ''}
          <div class="row" style="border-top:1px solid #9ca3af; padding-top:2px; font-weight:700;"><span>Total Dibayar</span><span>${rupiah(expectedMethods)}</span></div>
        </div>`
          : ''

        return `<div class="page">
          <div class="header">
            <div class="header-title">
              <div class="header-left">${(company || ' ').toUpperCase()}</div>
              <div class="header-right">
                <h1>PEMBAYARAN HUTANG</h1>
                <div class="meta">No. ${data.payment_number || '-'}</div>
                <div class="meta">Tanggal : ${dateStr}</div>
                <div class="meta">Supplier : ${data.supplier_name || '-'}</div>
              </div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th class="text-center" style="width:8mm">No.</th>
                <th>Invoice</th>
                <th class="text-center" style="width:28mm">Nota Supplier</th>
                <th class="text-center" style="width:24mm">Tgl Invoice</th>
                <th class="text-right" style="width:26mm">Sisa</th>
                <th class="text-right" style="width:26mm">Dibayar</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${fillerRowsHtml}
            </tbody>
          </table>

          ${metodeRowsHtml ? `
          <div style="margin-top:2mm;"><strong>Metode Pembayaran:</strong></div>
          <table class="items">
            <thead>
              <tr>
                <th class="text-right" style="width:28mm">Akun</th>
                <th>Nama Akun</th>
                <th class="text-right" style="width:30mm">Nominal</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${metodeRowsHtml}
            </tbody>
          </table>` : ''}

          ${extrasRowsHtml ? `
          <div style="margin-top:2mm;"><strong>Biaya Lain-lain:</strong></div>
          <table class="items">
            <thead>
              <tr>
                <th class="text-right" style="width:28mm">Akun</th>
                <th>Nama Akun</th>
                <th>Keterangan</th>
                <th class="text-right" style="width:24mm">Debit</th>
                <th class="text-right" style="width:24mm">Kredit</th>
              </tr>
            </thead>
            <tbody>
              ${extrasRowsHtml}
            </tbody>
          </table>` : ''}

          <div class="totals-row" style="margin-top:2mm;">
            <div style="flex:1;">
              <div style="margin-top:2px; font-size:11px;">
                <strong>Catatan :</strong><br/>
                <span style="font-size:10px;">${notesClean || '-'}</span>
              </div>
            </div>
            ${summaryHtml}
          </div>
        </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pembayaran Hutang ${data.payment_number || ''}</title>
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
    th { border-bottom: 1px solid #374151; font-size: 10px; text-align:left; padding: 2px 3px; }
    td { font-size: 10px; padding: 2px 3px; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .items tbody tr td { border-bottom: 1px dashed #cbd5e1; }
    .totals-row { display:flex; justify-content:space-between; align-items:flex-start; gap: 3mm; }
    .right-box { width: 58mm; border: 1px solid #374151; padding: 2mm; box-sizing: border-box; }
    .right-box .row { display:flex; justify-content:space-between; margin-bottom: 1px; font-size: 11px; }
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
    console.error('Gagal membuka pembayaran hutang untuk cetak', e)
    alert('Gagal membuka pembayaran hutang untuk cetak')
    win.close()
  }
}
