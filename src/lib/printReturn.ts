/**
 * Fungsi cetak retur penjualan (format A5 seperti faktur, dengan label RETUR PENJUALAN)
 */

type ReturnData = {
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

export async function printReturn(ret: ReturnData, companyName?: string): Promise<void> {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) { alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.'); return }

  try {
    // Ambil nama perusahaan bila tidak diberikan
    let company = companyName || ''
    if (!company) {
      try {
        const res = await fetch('/api/settings?group=company')
        if (res.ok) {
          const rows = await res.json()
          const map: Record<string, string> = {}
          ;(rows||[]).forEach((r:any)=>{ map[r.setting_key]=String(r.setting_value??'') })
          company = map['company_name'] || ''
        }
      } catch {}
    }

    const dateStr = new Date(ret.tgl_nota || ret.transaction_date || ret.created_at || new Date()).toLocaleDateString('id-ID')
    const dueStr = ret.due_date ? new Date(ret.due_date).toLocaleDateString('id-ID') : '-'
    const customerName = ret.customer_name || '-'
    const notesClean = String(ret.notes || '')
    const items = Array.isArray(ret.items) ? ret.items : []

    const rup = (n:number) => 'Rp ' + (Number(n)||0).toLocaleString('id-ID')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Retur ${ret.transaction_number || ''}</title>
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
    .keterangan { margin-top: 2mm; }
    .ket-box { border: 1px solid #9ca3af; min-height: 12mm; max-height: 18mm; padding: 1mm; font-size: 10px; overflow: hidden; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="page">
      <div class="header">
        <div class="header-title">
          <div class="header-left">${(company || ' ').toUpperCase()}</div>
          <div class="header-right" style="text-align:right;">
            <h1>RETUR PENJUALAN</h1>
            <div class="meta">No. Retur : ${ret.transaction_number || '-'}</div>
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
            <th class="text-center" style="width:28mm">Jumlah</th>
            <th class="text-right" style="width:24mm">Harga</th>
            <th class="text-center" style="width:38mm">Diskon</th>
            <th class="text-right" style="width:26mm">Total (−)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it:any, idx:number)=>{
            const qty = Number(it.quantity)||0
            const tot = Number(it.total_price)||0
            const unit = Number(it.unit_price) || (qty>0 ? Math.round(tot/qty):0)
            const discPct = Number(it.discount_percent || 0)
            const disc1 = Number(it.disc1_percent || 0)
            const disc2 = Number(it.disc2_percent || 0)
            const disc3 = Number(it.disc3_percent || 0)
            const discRp = Number(it.disc_nominal || 0)
            const discStr = `${discPct}%+${disc1}%+${disc2}%+${disc3}% Rp${discRp.toLocaleString('id-ID')}`
            return `<tr>
              <td class="text-center">${idx+1}</td>
              <td>${it.barang_name || it.name || ''}</td>
              <td class="text-center">${qty} ${it.unit_name || it.unit || ''}</td>
              <td class="text-right">${rup(unit)}</td>
              <td class="text-center disc-cell">${discStr}</td>
              <td class="text-right">- ${rup(tot)}</td>
            </tr>`
          }).join('')}
          ${Array.from({ length: Math.max(0, 10 - items.length) }).map(() => `
          <tr>
            <td class="text-center">&nbsp;</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>`).join('')}
        </tbody>
      </table>

      <div class="totals-row">
        <div class="keterangan">
          <div style="margin-bottom:2px; font-weight:600; font-size:12px;">Keterangan :</div>
          <div class="ket-box">${notesClean ? notesClean.replace(/\n/g, '<br/>') : ''}</div>
        </div>
        <div class="right-box">
          <div class="row"><span>Bruto</span><span>${rup(Number(ret.subtotal||0) + Number(ret.discount_amount||0))}</span></div>
          <div class="row"><span>Disc</span><span>${Number(ret.discount_amount)||0 ? ('- ' + rup(Number(ret.discount_amount)||0)) : '-'}</span></div>
          <div class="row"><span>PPN</span><span>${rup(Number(ret.ppn_amount)||0)}</span></div>
          <div class="row" style="border-top:1px solid #9ca3af; padding-top:2px; font-weight:700;"><span>Total Retur</span><span>- ${rup(Number(ret.total)||0)}</span></div>
        </div>
      </div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

    win.document.open(); win.document.write(html); win.document.close()
  } catch (e) {
    console.error('Gagal membuka retur untuk cetak', e)
    alert('Gagal membuka retur untuk cetak')
    win.close()
  }
}

export async function printReturnById(id: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/transactions/${id}`)
    if (!res.ok) { const err = await res.json().catch(()=>({})); alert(err?.error || 'Gagal mengambil data retur untuk cetak'); return }
    const tx = await res.json()
    await printReturn(tx)
  } catch (e) {
    console.error('Gagal mengambil data retur', e)
    alert('Gagal mengambil data retur untuk cetak')
  }
}
