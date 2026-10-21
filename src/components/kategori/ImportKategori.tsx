"use client"
import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Button from '@/components/ui/Button'

export default function ImportKategori({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<any[]>([])
  const [log, setLog] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)

  const downloadTemplate = () => {
    const header = ['Kode', 'Nama', 'PrintTarget']
    const sample = ['KTG-001', 'Contoh Kategori', 'kitchen']
    const ws = XLSX.utils.aoa_to_sheet([header, sample])
    ws['!cols'] = header.map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'Template_Import_Kategori.xlsx', { bookType: 'xlsx', type: 'binary' })
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const data = await f.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
    setRows(json)
    setLog([`File dimuat: ${f.name}. Total baris: ${json.length}`])
  }

  const runImport = async () => {
    setIsImporting(true)
    setLog([])
    try {
      const res = await fetch('/api/kategori/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      if (!res.ok) {
        let errMsg = ''
        try { const e = await res.json(); errMsg = e?.error || '' } catch {}
        throw new Error(`HTTP ${res.status}${errMsg ? ' - ' + errMsg : ''}`)
      }
      const result = await res.json()
      const logs: string[] = []
      logs.push(`Selesai import. Berhasil: ${result.imported}, Gagal: ${result.errors?.length || 0} dari ${result.total} baris`)
      if (result.errors?.length > 0) {
        logs.push('')
        for (const err of result.errors) {
          logs.push(`Baris ${err.row}: GAGAL - ${err.message}`)
        }
      }
      setLog(logs)
      onDone()
    } catch (e: any) {
      setLog(['Error: ' + (e.message || 'Unknown')])
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-3 relative p-4">
      {isImporting && (
        <div className="absolute inset-0 bg-white/75 flex items-center justify-center z-10 rounded">
          <div className="flex items-center gap-2 bg-white p-3 rounded shadow border text-sm font-medium">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Importing...
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={downloadTemplate} disabled={isImporting}>Download Template</Button>
        <label className={`inline-flex items-center px-3 py-1.5 rounded-pill border text-slate-700 text-sm cursor-pointer hover:bg-slate-50 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Pilih File Excel
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" disabled={isImporting} />
        </label>
        <Button onClick={runImport} disabled={!rows.length || isImporting}>
          {isImporting ? 'Importing...' : 'Import'}
        </Button>
      </div>
      {rows.length > 0 && <div className="text-xs text-slate-600">Siap import {rows.length} baris.</div>}
      {log.length > 0 && (
        <div className="p-3 rounded border bg-slate-50 text-xs space-y-1 max-h-48 overflow-auto">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
