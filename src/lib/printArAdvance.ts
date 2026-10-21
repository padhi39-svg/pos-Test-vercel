const rupiah = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')

export async function printArAdvanceById(advanceId: number): Promise<void> {
  if (typeof window === 'undefined') return

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) {
    alert('Popup untuk cetak diblokir browser. Izinkan popup untuk melanjutkan.')
    return
  }

  try {
    const res = await fetch(`/api/ar-advances/${advanceId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Gagal mengambil data uang muka untuk cetak')
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

    const total = (Array.isArray(data.detail) ? data.detail : []).reduce((a: number, b: any) => a + (Number(b.amount) || 0), 0)

    win.document.write(`
      <html><head><title>Cetak Uang Muka Customer</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
        h2 { text-align: center; margin-bottom: 4px; }
        .header { text-align: center; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 3px 6px; text-align: left; }
        th { background: #eee; }
        .right { text-align: right; }
        .center { text-align: center; }
        .footer { margin-top: 30px; text-align: center; }
      </style></head><body>
      <h2>${company || 'UANG MUKA CUSTOMER'}</h2>
      <div class="header">
        <div>No. ${data.kode_nota || ''}</div>
        <div>Tanggal: ${(data.tanggal || '').slice(0, 10)}</div>
        <div>Customer: ${[data.customer_code, data.customer_name].filter(Boolean).join(' - ')}</div>
      </div>
      <table>
        <thead><tr><th>No</th><th>Perkiraan</th><th>Keterangan</th><th class="right">Jumlah</th></tr></thead>
        <tbody>
          ${(Array.isArray(data.detail) ? data.detail : []).map((d: any, i: number) => `
            <tr>
              <td class="center">${i + 1}</td>
              <td>${[d.account_code, d.account_name].filter(Boolean).join(' - ')}</td>
              <td>${d.notes || ''}</td>
              <td class="right">${rupiah(d.amount || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3" class="right"><strong>Total</strong></td><td class="right"><strong>${rupiah(total)}</strong></td></tr>
        </tfoot>
      </table>
      ${data.notes ? `<div style="margin-top:8px"><strong>Catatan:</strong> ${data.notes}</div>` : ''}
      <div class="footer">Terima kasih</div>
      <script>window.print();window.close();<\/script>
    </body></html>`)
    win.document.close()
  } catch (e: any) {
    alert('Gagal mencetak: ' + (e?.message || 'Unknown error'))
  }
}
