"use client"
import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Button from '@/components/ui/Button'

export default function ImportCustomer({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<any[]>([])
  const [log, setLog] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [accountList, setAccountList] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/keuangan/perkiraan')
      .then(r => r.json())
      .then(d => setAccountList(Array.isArray(d) ? d.filter((a: any) => {
        if (a.is_header) return false
        return a.posting_allowed === undefined || Number(a.posting_allowed) === 1
      }) : []))
      .catch(() => setAccountList([]))
  }, [])

  const downloadTemplate = () => {
    const header = ['Kode', 'Nama', 'Alamat', 'NoTelp', 'NPWP', 'DiskonPersen', 'TermHari', 'KodeInt', 'PerkiraanKode']
    const sample = ['CUST-001', 'Contoh Customer', 'Jl. Contoh No.1', '08123456789', '00.000.000.0-000.000', 0, 0, 'INT-001', '100-000-00']
    const ws = XLSX.utils.aoa_to_sheet([header, sample])
    ws['!cols'] = header.map(() => ({ wch: 15 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'Template_Import_Customer.xlsx', { bookType: 'xlsx', type: 'binary' })
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
      const accountMap = new Map(accountList.map((a: any) => [String(a.code).toLowerCase(), a.id]))

      const logs: string[] = []
      let ok = 0, fail = 0
      const existingRes = await fetch('/api/customer')
      const existing = existingRes.ok ? await existingRes.json() : []
      const existingCodes = new Set((existing || []).map((b: any) => String(b.code || '').toLowerCase()))

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx]
        try {
          const code = String(r['Kode'] ?? '').trim().toUpperCase()
          const name = String(r['Nama'] ?? '').trim()
          if (!code || !name) throw new Error('Kode/Nama wajib')
          if (existingCodes.has(code.toLowerCase())) throw new Error(`Kode ${code} sudah digunakan`)

          const perkiraanCode = String(r['PerkiraanKode'] ?? '').trim().toLowerCase()
          if (perkiraanCode && !accountMap.has(perkiraanCode)) throw new Error(`Kode Perkiraan "${r['PerkiraanKode']}" tidak ditemukan di master perkiraan`)

          const res = await fetch('/api/customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              name,
              address: String(r['Alamat'] ?? '').trim(),
              phone: String(r['NoTelp'] ?? '').trim(),
              npwp: String(r['NPWP'] ?? '').trim(),
              discountPercent: Number(r['DiskonPersen'] ?? 0),
              term: Number(r['TermHari'] ?? 0),
              kodeInt: String(r['KodeInt'] ?? '').trim().toUpperCase(),
              accountId: perkiraanCode ? accountMap.get(perkiraanCode) : null,
            }),
          })
          if (!res.ok) {
            let errDetail = ''
            try { const e = await res.json(); errDetail = e?.error || '' } catch {}
            throw new Error(`HTTP ${res.status}${errDetail ? ' - ' + errDetail : ''}`)
          }
          existingCodes.add(code.toLowerCase())
          ok++
          logs.push(`Baris ${idx + 2}: OK - ${code} (${name})`)
        } catch (err: any) {
          fail++
          logs.push(`Baris ${idx + 2}: GAGAL - ${err?.message ?? err}`)
        }
      }
      logs.unshift(`Selesai import. Berhasil: ${ok}, Gagal: ${fail}`)
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
