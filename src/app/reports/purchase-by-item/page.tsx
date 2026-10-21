"use client"
import { useEffect, useState, useMemo } from "react"
import { sanitizeDateInput } from "@/lib/sanitizeDateInput"
import * as XLSX from "xlsx"
import BarangPickerModal, { BarangLite } from "@/components/BarangPickerModal"

interface Row {
  purchase_id: number
  purchase_number: string
  purchase_date: string
  supplier_name: string
  purchase_type: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  discount_percent: number
  discount_total: number
  subtotal: number
}

export default function PurchaseByItemReportPage() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [purchaseNumber, setPurchaseNumber] = useState("")
  const [type, setType] = useState<string>("")
  const [selectedBarang, setSelectedBarang] = useState<BarangLite | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    // Optional: Default to current month could be set here
    // But aligning with purchase-detail, we keep it empty unless explicitly set
  }, [])

  const loadReportWithParams = async (fromDate: string, toDate: string, prNumber: string, prType: string, barangId: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (prNumber) params.set('purchase_number', prNumber)
      if (prType) params.set('type', prType)
      if (barangId) params.set('barang_id', barangId)
      const res = await fetch(`/api/purchase-detail-report?${params.toString()}`)
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setRows(Array.isArray(data?.rows) ? data.rows : [])
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadReport = () => {
    loadReportWithParams(from, to, purchaseNumber, type, selectedBarang ? String(selectedBarang.id) : "")
  }

  // Group data by item_name
  const groupedData = useMemo(() => {
    const groups: { [key: string]: Row[] } = {}
    rows.forEach(row => {
      const key = String(row.item_name || 'Tidak Diketahui')
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    })
    
    // Sort items alphabetically
    const sortedEntries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
    
    // Within each item, sort by purchase date (newest first)
    return sortedEntries.map(([itemName, txRows]) => {
      const rowsSorted = [...txRows].sort((a, b) => {
        const at = Date.parse(String(a.purchase_date || '')) || 0
        const bt = Date.parse(String(b.purchase_date || '')) || 0
        return bt - at // Descending by date
      })
      return [itemName, rowsSorted] as [string, Row[]]
    })
  }, [rows])

  const totalSubtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0)

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!rows || rows.length === 0) {
      alert('Tidak ada data untuk di-export')
      return
    }

    const dataAOA: any[][] = []
    
    // Title
    dataAOA.push(['LAPORAN PEMBELIAN PER BARANG'])
    dataAOA.push([`Periode: ${from || '-'} s/d ${to || '-'}`])
    dataAOA.push([]) // Empty row

    // Content
    groupedData.forEach(([itemName, txRows]) => {
      // Item Header
      dataAOA.push([`Barang: ${itemName}`])
      
      // Table Header for this item
      dataAOA.push([
        'Kode Nota',
        'Tanggal',
        'Supplier',
        'Jenis',
        'QTY',
        'Satuan',
        'Harga',
        'Disc %',
        'Disc Total',
        'Subtotal'
      ])

      let itemTotalQty = 0
      let itemTotalSubtotal = 0

      // Table Rows
      txRows.forEach(r => {
        itemTotalQty += Number(r.quantity || 0)
        itemTotalSubtotal += Number(r.subtotal || 0)

        dataAOA.push([
          r.purchase_number,
          r.purchase_date,
          r.supplier_name,
          r.purchase_type,
          Number(r.quantity),
          r.unit,
          Number(r.unit_price),
          Number(r.discount_percent),
          Number(r.discount_total),
          Number(r.subtotal)
        ])
      })

      // Item Footer
      dataAOA.push([
        '', '', '', 'TOTAL BARANG:', itemTotalQty, '', '', '', '', itemTotalSubtotal
      ])
      dataAOA.push([]) // Empty row spacing
    })

    // Grand Total
    dataAOA.push(['', '', '', '', '', '', '', '', 'GRAND TOTAL:', totalSubtotal])

    const ws = XLSX.utils.aoa_to_sheet(dataAOA)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pembelian Per Barang")
    
    XLSX.writeFile(wb, `Laporan_Pembelian_Per_Barang_${from || 'All'}_${to || 'All'}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Laporan Pembelian per Barang</h1>
        <p className="text-sm text-slate-600 mt-1">Laporan pembelian dikelompokkan berdasarkan barang</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input type="date" value={from} onChange={(e)=>setFrom(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e)=>setTo(sanitizeDateInput(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Kode Nota (Opsional)</label>
            <input type="text" value={purchaseNumber} onChange={(e)=>setPurchaseNumber(e.target.value)} placeholder="PB/2026/000001" className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm" />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Barang (Opsional)</label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={selectedBarang ? selectedBarang.name : ''}
                onClick={() => setShowPicker(true)}
                placeholder="Pilih Barang..."
                className="px-3 py-1.5 w-48 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-bg focus:border-teal-primary focus:border-teal-primary text-sm cursor-pointer bg-white"
              />
              {selectedBarang && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedBarang(null) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Pembelian</label>
            <select value={type} onChange={(e)=>setType(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
              <option value="">Semua</option>
              <option value="0">Pembelian</option>
              <option value="1">Retur Pembelian</option>
            </select>
          </div>
          <div className="flex gap-2 relative">
            <button onClick={loadReport} disabled={loading} className="px-4 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary disabled:opacity-50 text-sm font-medium shadow-lg">{loading? 'Memuat...' : 'Tampilkan'}</button>
            {rows.length > 0 && (
              <>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5">Print</button>
                <button onClick={handleExportExcel} className="px-3 py-1.5 bg-gradient-to-r from-teal-primary to-teal-light text-white rounded-pill hover:from-teal-dark hover:to-teal-primary text-sm font-medium shadow flex items-center gap-1.5">Excel</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {groupedData.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Tidak ada data untuk ditampilkan
          </div>
        ) : (
          groupedData.map(([itemName, txRows], idx) => {
            const itemTotalQty = txRows.reduce((s, r) => s + Number(r.quantity || 0), 0)
            const itemTotalSubtotal = txRows.reduce((s, r) => s + Number(r.subtotal || 0), 0)

            return (
              <div key={idx} className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-teal-primary text-lg">■</span>
                    {itemName}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    {txRows.length} Transaksi
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-teal-primary to-teal-light text-white">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-xs font-semibold">Kode Nota</th>
                        <th className="px-3 py-1.5 text-left text-xs font-semibold">Tanggal</th>
                        <th className="px-3 py-1.5 text-left text-xs font-semibold">Supplier</th>
                        <th className="px-3 py-1.5 text-left text-xs font-semibold">Jenis Pembelian</th>
                        <th className="px-2 py-1.5 text-right text-xs font-semibold">QTY</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold">Satuan</th>
                        <th className="px-2 py-1.5 text-right text-xs font-semibold">Harga</th>
                        <th className="px-2 py-1.5 text-right text-xs font-semibold">Disc %</th>
                        <th className="px-2 py-1.5 text-right text-xs font-semibold">Disc Total</th>
                        <th className="px-3 py-1.5 text-right text-xs font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txRows.map((r, rIdx) => (
                        <tr key={`${r.purchase_id}-${rIdx}`} className="border-t hover:bg-slate-50">
                          <td className="px-3 py-1 text-xs text-slate-700">{r.purchase_number}</td>
                          <td className="px-3 py-1 text-xs text-slate-700">{r.purchase_date}</td>
                          <td className="px-3 py-1 text-xs text-slate-700">{r.supplier_name}</td>
                          <td className="px-3 py-1 text-xs text-slate-700">{r.purchase_type}</td>
                          <td className="px-2 py-1 text-xs text-right text-slate-800 font-semibold">{Number(r.quantity).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-xs text-left text-slate-700">{r.unit}</td>
                          <td className="px-2 py-1 text-xs text-right text-slate-700">{Number(r.unit_price).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-xs text-right text-slate-700">{Number(r.discount_percent).toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-xs text-right text-slate-700">{Number(r.discount_total).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-1 text-xs text-right font-bold text-teal-primary">{Number(r.subtotal).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-slate-800 text-right">TOTAL {itemName}:</td>
                        <td className="px-2 py-1.5 text-xs font-bold text-slate-800 text-right">{itemTotalQty.toLocaleString('id-ID')}</td>
                        <td colSpan={4}></td>
                        <td className="px-3 py-1.5 text-xs font-bold text-teal-dark text-right">{itemTotalSubtotal.toLocaleString('id-ID')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>

      {rows.length > 0 && (
        <div className="bg-slate-800 text-white rounded-lg shadow-md p-4 flex justify-between items-center">
          <div className="font-bold">GRAND TOTAL KESELURUHAN</div>
          <div className="text-xl font-bold font-mono text-teal-primary">Rp {totalSubtotal.toLocaleString('id-ID')}</div>
        </div>
      )}

      <BarangPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={(item) => {
          setSelectedBarang(item)
          setShowPicker(false)
        }}
      />
    </div>
  )
}
