"use client"

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (data: any[]) => Promise<{ success: boolean; message?: string }>
  title?: string
  sampleColumns?: string[]
}

export default function ImportModal({ open, onClose, onImport, title = 'Import Excel', sampleColumns = [] }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setMessage('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const rows = data as any[][]
      if (rows.length < 2) {
        setMessage('File Excel kosong atau tidak valid.')
        setPreview([])
        return
      }
      const headers = rows[0]
      const items = rows.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== '')).map(row => {
        const obj: any = {}
        headers.forEach((h, i) => {
          obj[String(h || `col${i}`)] = row[i]
        })
        return obj
      })
      setPreview(items)
    }
    reader.readAsBinaryString(f)
  }

  const handleImport = async () => {
    if (!preview.length) {
      setMessage('Tidak ada data untuk diimport.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const result = await onImport(preview)
      if (result.success) {
        setMessage('Import berhasil!')
        setTimeout(() => {
          onClose()
          setFile(null)
          setPreview([])
          setMessage('')
        }, 1500)
      } else {
        setMessage(result.message || 'Import gagal.')
      }
    } catch (e: any) {
      setMessage(e?.message || 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    onClose()
    setFile(null)
    setPreview([])
    setMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {sampleColumns.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
            <p className="font-semibold mb-1">Format kolom yang diharapkan:</p>
            <ul className="list-disc list-inside">
              {sampleColumns.map(col => <li key={col}>{col}</li>)}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Pilih file Excel (.xlsx/.xls)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {preview.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Preview Data ({preview.length} baris)</p>
            <div className="overflow-auto max-h-64 border rounded text-xs">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(preview[0]).map(k => <th key={k} className="px-2 py-1 text-left border-b">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b">
                      {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && <p className="text-center text-gray-500 py-2">...dan {preview.length - 10} baris lagi</p>}
            </div>
          </div>
        )}

        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${message.includes('berhasil') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={handleClose} disabled={loading} className="px-4 py-2 border rounded text-sm disabled:opacity-50">Batal</button>
          <button onClick={handleImport} disabled={!preview.length || loading} className="px-4 py-2 bg-teal-primary text-white rounded text-sm disabled:opacity-50">
            {loading ? 'Mengimport...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
