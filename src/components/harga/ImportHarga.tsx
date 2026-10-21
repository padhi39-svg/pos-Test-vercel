"use client"
import { useState } from 'react'
import Button from '@/components/ui/Button'

export default function ImportHarga({ onDone }: { onDone: () => void }) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = event.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]
          const rows = jsonData.map((row, idx) => ({
            rowNumber: idx + 2,
            kodeBarang: row['Kode Barang'] || row['kode_barang'] || '',
            satuan: row['Satuan'] || row['satuan'] || '',
            harga: parseFloat(row['Harga'] || row['harga'] || 0),
            tanggalEfektif: row['Tanggal Efektif'] || row['tanggal_efektif'] || new Date().toISOString().split('T')[0],
          }))
          const response = await fetch('/api/harga/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows }),
          })
          if (response.ok) {
            const resultData = await response.json()
            setResult(resultData)
          } else {
            alert('Gagal import data')
          }
        } catch {
          alert('Format Excel tidak valid')
        } finally {
          setImporting(false)
        }
      }
      reader.readAsBinaryString(file)
    } catch {
      alert('Terjadi kesalahan saat import')
      setImporting(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div className={`p-2 rounded text-xs ${result.failed === 0 ? 'bg-teal-bg text-teal-dark' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
          <p className="font-medium">Berhasil: {result.success} data</p>
          {result.failed > 0 && <p className="font-medium text-red-600">Gagal: {result.failed} data</p>}
        </div>
        {result.errors?.length > 0 && (
          <div className="max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-slate-700 mb-1">Detail Error:</p>
            <ul className="text-xs text-red-600 space-y-0.5">
              {result.errors.map((err: string, idx: number) => (
                <li key={idx} className="bg-red-50 p-1.5 rounded">{err}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onDone}>Selesai</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="p-2 rounded bg-teal-bg text-xs text-teal-dark space-y-1">
        <p className="font-medium">Format Excel:</p>
        <ul className="list-disc ml-4">
          <li>Kolom: Kode Barang, Satuan, Harga, Tanggal Efektif</li>
          <li>Kode barang harus sudah ada di master barang</li>
          <li>Satuan harus valid untuk barang tersebut</li>
          <li>Harga dalam angka (tanpa Rp atau titik)</li>
        </ul>
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1">Upload File Excel (.xlsx atau .csv)</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          disabled={importing}
          className="w-full border border-slate-300 rounded-pill px-3 py-2 text-sm outline-none transition-colors bg-white hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2] disabled:opacity-50"
        />
      </div>
      {importing && (
        <div className="text-center py-4">
          <span className="w-6 h-6 border-2 border-teal-primary rounded-full border-t-transparent animate-spin inline-block" />
          <p className="text-xs text-slate-500 mt-1">Mengimport data...</p>
        </div>
      )}
    </div>
  )
}
