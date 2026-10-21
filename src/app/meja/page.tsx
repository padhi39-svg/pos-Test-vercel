"use client"
import { useEffect, useState, useCallback } from 'react'
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef, FilterDef } from '@/components/master/MasterDataList'

const columns: ColumnDef<any>[] = [
  { key: 'code', label: 'Kode', sortable: true, render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama', sortable: true, render: (r) => r.name },
  { key: 'floor_name', label: 'Lantai', sortable: true, render: (r) => r.floor_name || '-' },
  { key: 'capacity', label: 'Kursi', sortable: true, align: 'center', render: (r) => r.capacity || 0 },
  { key: 'zone', label: 'Zona', sortable: true, render: (r) => r.zone || '-' },
  {
    key: 'barcode',
    label: 'Barcode',
    align: 'center',
    render: (r) => (
      <button
        onClick={() => downloadBarcode(Number(r.id), String(r.code))}
        className="px-2 py-1 rounded-pill border border-teal-primary text-teal-primary text-xs hover:bg-teal-bg"
        title="Download Barcode QR"
      >
        QR
      </button>
    ),
  },
]

export default function TablesPage() {
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [floors, setFloors] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 })

  const fetchFloors = useCallback(async () => {
    const res = await fetch('/api/floors')
    const data = res.ok ? await res.json() : []
    setFloors(Array.isArray(data) ? data : (data?.rows || []))
  }, [])

  useEffect(() => { fetchFloors() }, [fetchFloors])

  async function handleExportBarcodes() {
    try {
      setExporting(true)
      setExportProgress({ current: 0, total: 0 })

      const JSZip = (await import('jszip')).default
      const QRCode = await import('qrcode') as any

      const res = await fetch('/api/meja?limit=500')
      const data = await res.json()
      const mejas = data?.rows || []
      
      if (!mejas.length) {
        alert('Tidak ada data meja')
        setExporting(false)
        return
      }

      setExportProgress({ current: 0, total: mejas.length })
      const zip = new JSZip()
      const baseUrl = window.location.origin

      for (let i = 0; i < mejas.length; i++) {
        const meja = mejas[i]
        const url = `${baseUrl}/self-order/table/${meja.code}`
        const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 })
        const base64 = dataUrl.split(',')[1]
        zip.file(`barcode-meja-${meja.code}.png`, base64, { base64: true })
        setExportProgress({ current: i + 1, total: mejas.length })
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `barcode-meja-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Export barcode error:', e)
      alert('Gagal export barcode')
    } finally {
      setExporting(false)
      setExportProgress({ current: 0, total: 0 })
    }
  }

  const filters: FilterDef[] = [
    {
      type: 'searchable-select',
      key: 'floor_id',
      placeholder: 'Semua Lantai',
      options: floors.map((f: any) => ({ value: String(f.id), label: `${f.code} - ${f.name}` })),
    },
  ]

  return (
    <>
      <MasterDataList
        key={refreshKey}
        title="Master Meja"
        subtitle="Kelola data meja per lantai"
        basePath="/meja"
        endpoint="/api/meja"
        permissionCode="meja"
        columns={columns}
        showStatusColumn
        statusField="is_active"
        statusActiveValue={1}
        defaultSortBy="code"
        serverSortMap={{ code: 'code', name: 'name', floor_name: 'floor_name', capacity: 'capacity', zone: 'zone', is_active: 'is_active' }}
        filters={filters}
        headerActions={[
          { label: 'Import Excel', variant: 'outline', onClick: () => setShowImport(true) },
          { label: 'Export Barcode', variant: 'outline', onClick: handleExportBarcodes, disabled: exporting },
        ]}
        onDelete={async (id) => {
          const res = await fetch(`/api/meja?id=${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Gagal menghapus meja')
        }}
      />

      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b font-semibold flex items-center justify-between">
              <span>Import Meja (Excel)</span>
              {!importing && (
                <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
              )}
            </div>
            <div className="p-4 text-xs space-y-3">
              <div className="text-slate-600">
                Kolom: kode, lantai_kode, zone (Indoor/Outdoor), smoking (0/1),
                mergeable (0/1), jumlah_kursi, aktif (0/1), keterangan
              </div>
              {importing ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-600">Mengimport data...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <input id="fileMeja" type="file" accept=".xlsx,.xls" className="text-xs" />
                  <button onClick={downloadTemplate} className="px-2 py-1 rounded-pill border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs">Download Template</button>
                  <button
                    onClick={() => handleImport(setImporting, setShowSuccess, setSuccessMsg, setShowImport, setRefreshKey, fetchFloors)}
                    className="px-2 py-1 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-xs"
                  >Upload & Import</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-6 text-center space-y-3">
            <div className="text-teal-primary text-4xl">&#10003;</div>
            <div className="text-sm font-semibold text-slate-800">Import Berhasil</div>
            <div className="text-xs text-slate-600">{successMsg}</div>
            <button onClick={() => setShowSuccess(false)} className="px-4 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-xs">OK</button>
          </div>
        </div>
      )}
      {exporting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-6 text-center space-y-4">
            <svg className="animate-spin h-10 w-10 text-teal-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="text-sm font-semibold text-slate-800">Membuat Barcode...</div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-primary h-full rounded-full transition-all duration-200"
                style={{ width: exportProgress.total > 0 ? `${(exportProgress.current / exportProgress.total) * 100}%` : '0%' }}
              />
            </div>
            <div className="text-xs text-slate-500">
              {exportProgress.total > 0 ? `${exportProgress.current} / ${exportProgress.total} meja` : 'Memuat data...'}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

async function downloadBarcode(id: number, code: string) {
  try {
    const res = await fetch(`/api/meja/${id}/barcode`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(d?.error || 'Gagal membuat barcode')
      return
    }
    const a = document.createElement('a')
    a.href = d.dataUrl
    a.download = `barcode-meja-${code}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    alert('Gagal download barcode')
  }
}

async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const rows = [
    ['kode', 'lantai_kode', 'zone', 'smoking', 'mergeable', 'jumlah_kursi', 'aktif', 'keterangan'],
    ['V01', '', 'Indoor', 0, 1, 2, 1, 'contoh'],
    ['V02', '', 'Outdoor', 1, 0, 4, 1, 'contoh'],
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.writeFile(wb, 'template-import-meja.xlsx')
}

async function handleImport(
  setImporting: (v: boolean) => void,
  setShowSuccess: (v: boolean) => void,
  setSuccessMsg: (v: string) => void,
  setShowImport: (v: boolean) => void,
  setRefreshKey: (v: (k: number) => number) => void,
  refreshFloors: () => void,
) {
  try {
    const input = document.getElementById('fileMeja') as HTMLInputElement | null
    if (!input || !input.files || input.files.length === 0) { alert('Pilih file terlebih dahulu'); return }
    const file = input.files[0]
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/meja/import', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setImporting(false); alert(data?.error || 'Gagal import'); return }
    const total = (data.inserted || 0) + (data.updated || 0)
    const errCount = (data.errors || []).length
    const warnCount = (data.warnings || []).length
    let msg = `${total} data berhasil diproses (Insert: ${data.inserted || 0}, Update: ${data.updated || 0})`
    if (warnCount > 0) msg += `. ${warnCount} baris dengan peringatan.`
    if (errCount > 0) msg += `. ${errCount} baris gagal.`
    setSuccessMsg(msg)
    refreshFloors()
    setRefreshKey(k => k + 1)
    setShowImport(false)
    setImporting(false)
    setShowSuccess(true)
  } catch { setImporting(false); alert('Gagal import') }
}
