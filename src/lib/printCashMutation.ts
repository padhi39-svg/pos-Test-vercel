type CashMutationPrint = {
  id?: number
  mutation_number: string
  mutation_date: string
  cash_account_code: string
  cash_account_name: string
  mutation_type: 'MASUK' | 'KELUAR'
  notes: string
  total_amount: number
  items: Array<{
    line_no: number
    account_code: string
    account_name: string
    notes: string
    amount: number
  }>
}

const rupiah = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')

export async function printCashMutation(p: CashMutationPrint, companyName?: string): Promise<void> {
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

    const dateStr = p.mutation_date ? new Date(p.mutation_date).toLocaleDateString('id-ID') : ''
    const notesClean = String(p.notes || '')
    const items = Array.isArray(p.items) ? p.items : []
    const typeLabel = p.mutation_type === 'MASUK' ? 'MASUK' : 'KELUAR'

    const itemsPerPage = 14
    const pages: any[][] = []
    for (let i = 0; i < items.length; i += itemsPerPage) {
      pages.push(items.slice(i, i + itemsPerPage))
    }

    const pagesHtml = pages
      .map((pageItems, pageIndex) => {
        const rowsHtml = pageItems
          .map((it: any, idx: number) => {
            const rowNumber = pageIndex * itemsPerPage + idx + 1
            return `<tr>
              <td class="text-center">${rowNumber}</td>
              <td>${it.account_code || ''}</td>
              <td>${it.account_name || ''}</td>
              <td>${it.notes || ''}</td>
              <td class="text-right">${rupiah(it.amount)}</td>
            </tr>`
          })
          .join('')

        const fillerRowsHtml = Array.from({ length: Math.max(0, itemsPerPage - pageItems.length) })
          .map(() => `<tr><td class="text-center">&nbsp;</td><td></td><td></td><td></td><td></td></tr>`)
          .join('')

        const isLast = pageIndex === pages.length - 1

        const notesHtml = isLast && notesClean
          ? `<div style="margin-top:2px; border-top:1px solid #9ca3af; padding-top:2px; font-size:11px;">
               <strong>Catatan:</strong>
               <div class="ket-box">${notesClean.replace(/\n/g, '<br/>')}</div>
             </div>`
          : ''

        const totalsHtml = isLast
          ? `<div class="total-summary">
               <div class="total-row"><span>Total ${typeLabel}</span><span>${rupiah(p.total_amount)}</span></div>
             </div>`
          : ''

        return `
        <div class="page">
          <div class="header">
            <div class="header-title">
              <div class="header-left">${(company || ' ').toUpperCase()}</div>
              <div class="header-right" style="text-align:right;">
                <h1>MUTASI KAS/BANK</h1>
                <div class="meta">No. MT : ${p.mutation_number || '-'}</div>
                <div class="meta">Tanggal : ${dateStr}</div>
                <div class="meta">Akun Kas/Bank : ${p.cash_account_code} - ${p.cash_account_name}</div>
                <div class="meta">Jenis : ${typeLabel}</div>
              </div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th class="text-center" style="width:8mm">No.</th>
                <th style="width:22mm">Kode</th>
                <th style="width:32mm">Perkiraan</th>
                <th style="width:35mm">Keterangan</th>
                <th class="text-right" style="width:30mm">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${fillerRowsHtml}
            </tbody>
          </table>

          <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:3mm;">
              <div style="flex:1">${notesHtml}</div>
              ${totalsHtml}
            </div>
          </div>
        </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Mutasi Kas/Bank ${p.mutation_number || ''}</title>
  <style>
    @page { size: 210mm 150mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: 210mm; height: 145mm; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; color: #111827; }
    .page { width: 210mm; height: 145mm; border: 1px solid #374151; box-sizing: border-box; padding: 3mm 4mm; display: flex; flex-direction: column; }
    .header { margin-bottom: 2mm; border-bottom: 1px solid #374151; padding-bottom: 1mm; }
    .header-title { display:flex; justify-content:space-between; align-items:flex-start; }
    .header-left { font-weight: 800; font-size: 16px; letter-spacing: 0.5px; }
    .header-right h1 { font-size: 16px; margin: 0; font-weight: 800; }
    .meta { font-size: 11px; color:#111827; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { border-bottom: 1px solid #374151; font-size: 10px; text-align:left; padding: 2px 3px; }
    td { font-size: 10px; padding: 2px 3px; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .items tbody tr td { border-bottom: 1px dashed #cbd5e1; }
    .ket-box { border: 1px solid #9ca3af; min-height: 10mm; max-height: 16mm; padding: 1mm; font-size: 10px; overflow: hidden; }
    .total-summary { border: 1px solid #374151; padding: 2mm; min-width: 55mm; }
    .total-row { display:flex; justify-content:space-between; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div>
    ${pagesHtml}
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  } catch (e) {
    console.error('Gagal mencetak mutasi kas/bank', e)
    alert('Gagal membuka mutasi kas/bank untuk cetak')
    win.close()
  }
}

export async function printCashMutationById(mutationId: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/cash-mutations/${mutationId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data mutasi kas/bank untuk cetak')
      return
    }
    const data = await res.json()
    const p: CashMutationPrint = {
      id: data.id,
      mutation_number: data.mutation_number,
      mutation_date: data.mutation_date,
      cash_account_code: data.cash_account_code,
      cash_account_name: data.cash_account_name,
      mutation_type: data.mutation_type,
      notes: data.notes || '',
      total_amount: Number(data.total_amount || 0),
      items: Array.isArray(data.detail)
        ? data.detail.map((it: any) => ({
            line_no: Number(it.line_no || 0),
            account_code: it.account_code || '',
            account_name: it.account_name || '',
            notes: it.notes || '',
            amount: Number(it.amount || 0),
          }))
        : [],
    }
    await printCashMutation(p)
  } catch (e) {
    console.error('Gagal mengambil data mutasi kas/bank', e)
    alert('Gagal mengambil data mutasi kas/bank untuk cetak')
  }
}
