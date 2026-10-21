"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/regionalNumber'

type TxItem = {
  id: number
  barang_id: number
  barang_code: string
  barang_name: string
  quantity: number
  unit_price?: number
  total_price?: number
  discount_amount?: number
  discon_total?: number
}

type TxDetail = {
  id: number
  transaction_number: string
  customer_id: number | null
  customer_name: string | null
  customer_code: string | null
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  payment_method: string
  payment_amount: number
  change_amount: number
  void: number
  created_at: string
  price_include_tax?: number
  tax_rate_percent?: number
  items: TxItem[]
}

export default function SalesDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<TxDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [printerCfg, setPrinterCfg] = useState<{
    host: string
    port: number
    chars: number
    cut: boolean
  }>({
    host: '',
    port: 9100,
    chars: 48,
    cut: true,
  })
  const [companyInfo, setCompanyInfo] = useState<{ name: string; address: string; phone: string }>({
    name: '',
    address: '',
    phone: '',
  })
  const [layoutCfg, setLayoutCfg] = useState<{
    header_title: string
    show_company: '0' | '1'
    show_address: '0' | '1'
    show_phone: '0' | '1'
    show_invoice_code: '0' | '1'
    separator_char: '-' | '='
    thankyou_text: string
    align_header: 'left' | 'center'
    label_subtotal: string
    label_tax: string
    label_total: string
    label_paid: string
    label_change: string
  }>({
    header_title: '',
    show_company: '1',
    show_address: '1',
    show_phone: '1',
    show_invoice_code: '1',
    separator_char: '-',
    thankyou_text: 'Terima kasih',
    align_header: 'center',
    label_subtotal: 'Subtotal',
    label_tax: 'PPN',
    label_total: 'TOTAL',
    label_paid: 'Bayar',
    label_change: 'Kembali',
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/transactions/${id}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        } else {
          setData(null)
        }
      } catch (e) {
        console.error('Failed to load transaction detail', e)
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  useEffect(() => {
    const loadPrinterAndCompany = async () => {
      try {
        const [resP, resC, resLayout] = await Promise.all([
          fetch('/api/settings?group=printer'),
          fetch('/api/settings?group=company'),
          fetch('/api/settings?group=printer_layout'),
        ])

        if (resP.ok) {
          const rows = await resP.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
          setPrinterCfg(prev => ({
            ...prev,
            host: String(map['printer_network_host'] || '').trim(),
            port: Math.max(1, Math.min(65535, parseInt(map['printer_network_port'] || '9100') || 9100)),
            chars: Math.max(24, Math.min(64, parseInt(map['printer_chars_per_line'] || '48') || 48)),
            cut: (map['printer_cut_paper'] || '1') !== '0',
          }))
        }

        if (resC.ok) {
          const rows = await resC.json()
          const map: Record<string, string> = {}
          ;(rows || []).forEach((r: any) => { map[r.setting_key] = String(r.setting_value ?? '') })
          setCompanyInfo({
            name: map['company_name'] || '',
            address: map['company_address'] || '',
            phone: map['company_phone'] || '',
          })
        }

        if (resLayout.ok) {
          const data = await resLayout.json()
          const map: Record<string, string> = {}
          ;(data || []).forEach((row: any) => { map[row.setting_key] = String(row.setting_value ?? '') })
          setLayoutCfg(prev => ({
            ...prev,
            header_title: map.header_title ?? prev.header_title,
            show_company: (map.show_company as any) ?? prev.show_company,
            show_address: (map.show_address as any) ?? prev.show_address,
            show_phone: (map.show_phone as any) ?? prev.show_phone,
            show_invoice_code: (map.show_invoice_code as any) ?? prev.show_invoice_code,
            separator_char: (map.separator_char as any) || prev.separator_char,
            thankyou_text: map.thankyou_text ?? prev.thankyou_text,
            align_header: (map.align_header as any) || prev.align_header,
            label_subtotal: map.label_subtotal ?? prev.label_subtotal,
            label_tax: map.label_tax ?? prev.label_tax,
            label_total: map.label_total ?? prev.label_total,
            label_paid: map.label_paid ?? prev.label_paid,
            label_change: map.label_change ?? prev.label_change,
          }))
        }
      } catch (e) {
        console.warn('Gagal memuat konfigurasi printer POS dari halaman sales:', e)
      }
    }
    loadPrinterAndCompany()
  }, [])

  const handlePrint = () => window.print()

  const formatReceiptCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return 'Rp 0'
    const num = value.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `Rp ${num}`
  }

  const buildReceiptText = (tx: TxDetail): string => {
    const W = printerCfg.chars
    const lines: string[] = []
    const sep = String(layoutCfg.separator_char || '-').repeat(W)

    const wrap = (text: string, width: number) => {
      const words = String(text || '').split(/\s+/)
      const out: string[] = []
      let line = ''
      for (const w of words) {
        const cand = line ? line + ' ' + w : w
        if (cand.length <= width) line = cand
        else { if (line) out.push(line); line = w }
      }
      if (line) out.push(line)
      return out
    }

    const centerLine = (line: string) => {
      if (layoutCfg.align_header !== 'center') return line
      const pad = Math.max(0, Math.floor((W - line.length) / 2))
      return ' '.repeat(pad) + line
    }

    const pushWrapped = (text: string) => {
      const ws = wrap(text, W)
      for (const ln of ws) lines.push(centerLine(ln))
    }

    if (layoutCfg.show_company === '1' && companyInfo.name) pushWrapped(companyInfo.name.toUpperCase())
    if (layoutCfg.show_address === '1' && companyInfo.address) pushWrapped(companyInfo.address)
    if (layoutCfg.show_phone === '1' && companyInfo.phone) pushWrapped('Tel: ' + companyInfo.phone)
    lines.push(sep)

    const headerTitle = String(layoutCfg.header_title || 'NOTA PENJUALAN')
    pushWrapped(headerTitle.toUpperCase())
    if (layoutCfg.show_invoice_code === '1') pushWrapped('No: ' + (tx.transaction_number || '-'))
    pushWrapped(new Date(tx.created_at).toLocaleString('id-ID'))
    lines.push(sep)

    for (const it of tx.items) {
      const nameLines = wrap(it.barang_name, W)
      if (nameLines.length) lines.push(nameLines[0])
      const qty = it.quantity
      let unitPrice = Number((it as any).unit_price ?? 0)
      if (!unitPrice || unitPrice <= 0) {
        const q = Math.max(1, Number(it.quantity) || 1)
        const total = Number((it as any).total_price ?? 0)
        unitPrice = q > 0 ? Math.round(total / q) : total
      }
      const qtyPrice = `${qty} x ${formatReceiptCurrency(unitPrice)}`
      const totalStr = formatReceiptCurrency((it as any).total_price ?? 0)
      const left = Math.max(0, W - qtyPrice.length - totalStr.length)
      lines.push(qtyPrice + ' '.repeat(left) + totalStr)
      for (let i = 1; i < nameLines.length; i++) lines.push(nameLines[i])
    }

    lines.push(sep)

    const lblSubtotal = layoutCfg.label_subtotal || 'Subtotal'
    const lblTax = layoutCfg.label_tax || 'PPN'
    const lblTotal = layoutCfg.label_total || 'TOTAL'
    const lblPaid = layoutCfg.label_paid || 'Bayar'
    const lblChange = layoutCfg.label_change || 'Kembali'

    const paid = tx.payment_amount
    const change = tx.change_amount

    const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
    const padLeft = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s)

    lines.push(padRight(lblSubtotal, W - 12) + padLeft(formatReceiptCurrency(tx.subtotal), 12))
    if ((tx.discount_amount || 0) > 0) {
      lines.push(padRight('Diskon', W - 12) + padLeft('-' + formatReceiptCurrency(tx.discount_amount || 0), 12))
    }
    if ((tx.ppn_amount || 0) > 0) {
      lines.push(padRight(lblTax, W - 12) + padLeft(formatReceiptCurrency(tx.ppn_amount || 0), 12))
    }
    lines.push(padRight(lblTotal, W - 12) + padLeft(formatReceiptCurrency(tx.total), 12))
    lines.push(padRight(lblPaid, W - 12) + padLeft(formatReceiptCurrency(paid), 12))
    lines.push(padRight(lblChange, W - 12) + padLeft(formatReceiptCurrency(change), 12))
    lines.push(sep)

    const rawFooter = String(layoutCfg.thankyou_text || 'Terima kasih')
    const footerLines = rawFooter.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    if (footerLines.length === 0) footerLines.push('Terima kasih')
    for (const fl of footerLines) {
      const ws = wrap(fl, W)
      for (const ln of ws) lines.push(centerLine(ln))
    }

    lines.push('\n')
    return lines.join('\n')
  }

  const handlePrintPos = async () => {
    if (!data) return
    if (!printerCfg.host) {
      alert('Host printer POS belum diatur di pengaturan Printer')
      return
    }
    try {
      const text = buildReceiptText(data)
      if (!text.trim()) {
        alert('Teks struk kosong, tidak bisa mencetak')
        return
      }
      await fetch('/api/print/escpos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, host: printerCfg.host, port: printerCfg.port, cut: printerCfg.cut }),
      })
    } catch (e) {
      console.error('Gagal mencetak struk POS dari halaman sales:', e)
      alert('Gagal mencetak struk POS')
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!data) return <div className="p-6">Data tidak ditemukan</div>

  const statusBadge = data.void === 1
    ? <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-red-100 text-red-700">VOID</span>
    : <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-teal-bg text-teal-dark">Selesai</span>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-slate-600 hover:text-slate-800 mb-2">← Kembali</button>
          <h1 className="text-2xl font-bold text-slate-800">Detail Penjualan</h1>
          <p className="text-sm text-slate-600 mt-1">No. Nota: <span className="font-semibold">{data.transaction_number}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-pill hover:bg-slate-200 text-sm font-medium">Print Browser</button>
          <button onClick={handlePrintPos} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow">Print POS</button>
          <Link href="/sales" className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-pill hover:bg-slate-200 text-sm font-medium">Tutup</Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg shadow border border-slate-200">
          <div className="text-[11px] text-slate-600 mb-1">Tanggal</div>
          <div className="text-sm font-semibold text-slate-800">{new Date(data.created_at).toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border border-slate-200">
          <div className="text-[11px] text-slate-600 mb-1">Customer</div>
          <div className="text-sm font-semibold text-slate-800">{data.customer_name || 'Umum'} {data.customer_code ? `(${data.customer_code})` : ''}</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border border-slate-200">
          <div className="text-[11px] text-slate-600 mb-1">Metode</div>
          <div className="text-sm font-semibold text-slate-800 capitalize">{data.payment_method}</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-600 mb-1">Status</div>
            <div className="text-sm font-semibold text-slate-800">{statusBadge}</div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-[#2BA8A2] to-[#3CC4BD] text-white">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Kode</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold">Nama</th>
              <th className="px-1 py-1.5 text-right text-xs font-semibold">Qty</th>
              <th className="px-1 py-1.5 text-right text-xs font-semibold">Harga Satuan</th>
              <th className="px-1 py-1.5 text-right text-xs font-semibold">Diskon (Item)</th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-slate-500 text-xs">Tidak ada item</td>
              </tr>
            ) : (
              data.items.map(it => (
                <tr key={it.id} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-1 text-xs font-semibold text-slate-800">{it.barang_code}</td>
                  <td className="px-2 py-1 text-xs text-slate-700">{it.barang_name}</td>
                  <td className="px-1 py-1 text-xs text-right font-semibold text-slate-800">{it.quantity.toLocaleString('id-ID')}</td>
                  {(() => {
                    let displayUnit = Number((it as any).unit_price ?? 0)
                    if (!displayUnit || displayUnit <= 0) {
                      const qty = Math.max(1, Number(it.quantity) || 1)
                      const total = Number((it as any).total_price ?? 0)
                      displayUnit = Math.round(total / qty)
                    }
                    return (
                      <td className="px-1 py-1 text-xs text-right text-slate-700">{formatCurrency(displayUnit)}</td>
                    )
                  })()}
                  <td className="px-1 py-1 text-xs text-right text-red-600">- {formatCurrency((it as any).discon_total ?? (it as any).discount_amount ?? 0)}</td>
                  <td className="px-2 py-1 text-xs text-right font-bold text-teal-primary">{formatCurrency((it as any).total_price ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-right text-slate-700">Subtotal</td>
              <td className="px-2 py-1.5 text-xs text-right font-medium text-slate-800">{formatCurrency(data.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-right text-slate-700">Diskon ({data.discount_percent || 0}%)</td>
              <td className="px-2 py-1.5 text-xs text-right font-medium text-red-600">- {formatCurrency(data.discount_amount || 0)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-right text-slate-700">PPN ({data.ppn_percent || 0}%)</td>
              <td className="px-2 py-1.5 text-xs text-right font-medium text-slate-800">+ {formatCurrency(data.ppn_amount || 0)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-right font-bold text-slate-800">Total</td>
              <td className="px-2 py-1.5 text-xs text-right font-bold text-teal-dark">{formatCurrency(data.total)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-right text-slate-700">Pembayaran</td>
              <td className="px-2 py-1.5 text-xs text-right font-medium text-slate-800">{formatCurrency(data.payment_amount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-right text-slate-700">Kembalian</td>
              <td className="px-2 py-1.5 text-xs text-right font-medium text-slate-800">{formatCurrency(data.change_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
