"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Button from '@/components/ui/Button'
import { parseRegionalNumber } from '@/lib/regionalNumber'

function titleCase(s: string) {
  return (s ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function parseUnits(row: any) {
  const units: { name: string; ratio: number }[] = []
  for (let i = 1; i <= 3; i++) {
    const name = titleCase(String(row[`Satuan${i}_Nama`] ?? '').trim())
    const ratio = Number(String(row[`Satuan${i}_Rasio`] ?? '').trim())
    if (name && !isNaN(ratio) && ratio > 0) units.push({ name, ratio })
  }
  return units.length ? units : [{ name: 'Pcs', ratio: 1 }]
}

export default function ImportBarangPembantu({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<any[]>([])
  const [log, setLog] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [kategoriList, setKategoriList] = useState<any[]>([])
  const [spesList, setSpesList] = useState<any[]>([])
  const [merkList, setMerkList] = useState<any[]>([])
  const [mastersReady, setMastersReady] = useState(false)

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [rk, rs, rm] = await Promise.all([
          fetch('/api/kategori'),
          fetch('/api/spesifikasi'),
          fetch('/api/merk'),
        ])
        if (!rk.ok || !rs.ok || !rm.ok) throw new Error('Gagal memuat master data')
        const [dk, ds, dm] = await Promise.all([rk.json(), rs.json(), rm.json()])
        setKategoriList(Array.isArray(dk) ? dk : [])
        setSpesList(Array.isArray(ds) ? ds : [])
        setMerkList(Array.isArray(dm) ? dm : [])
      } catch (e) {
        console.error('Gagal memuat master (kategori/spesifikasi/merk):', e)
        setKategoriList([]); setSpesList([]); setMerkList([])
      } finally {
        setMastersReady(true)
      }
    }
    loadMasters()
  }, [])

  const downloadTemplate = () => {
    try {
      const header = [
        'Kode', 'Nama', 'KategoriKode', 'SpesifikasiKode', 'MerkKode', 'HPP', 'Aktif', 'TampilMenu', 'FotoURL',
        'Satuan1_Nama','Satuan1_Rasio','Satuan2_Nama','Satuan2_Rasio','Satuan3_Nama','Satuan3_Rasio','Harga','TanggalBerlaku',
      ]
      const sample = [[
        'BP-001','Contoh Barang Pembantu','CTG-001','SPE-001','MRK-001',10000,'Ya','Tidak','',
        'Pcs',1,'Lusin',12,'Dus',48,0,'2025-10-10'
      ]]
      const ws = XLSX.utils.aoa_to_sheet([header, ...sample])
      ws['!cols'] = header.map(() => ({ wch: 15 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Template')
      XLSX.writeFile(wb, 'Template_Import_Barang_Pembantu.xlsx', { bookType: 'xlsx', type: 'binary' })
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Gagal mendownload template.')
    }
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
    await new Promise(r => setTimeout(r, 300))
    try {
      if (!mastersReady) {
        setLog(['Master data belum siap. Coba lagi beberapa detik.'])
        return
      }
      const mapByCode = (arr: { code: string; id: number }[]) => new Map(arr.map((x) => [String(x.code || '').toLowerCase(), x.id]))
      const kategoriMap = mapByCode(kategoriList)
      const spesMap = mapByCode(spesList)
      const merkMap = mapByCode(merkList)

      const logs: string[] = []
      let ok = 0, fail = 0
      const existingBarangRes = await fetch('/api/barang')
      const existingBarang = existingBarangRes.ok ? await existingBarangRes.json() : []
      const existingCodes = new Set((existingBarang || []).map((b: any) => String(b.code || '').toLowerCase()))

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx]
        try {
          const code = String(r['Kode'] ?? '').trim().toUpperCase()
          const name = titleCase(String(r['Nama'] ?? '').trim())
          if (!code || !name) throw new Error('Kode/Nama wajib')
          if (existingCodes.has(code.toLowerCase())) throw new Error(`Kode ${code} sudah digunakan`)
          const kategoriId = (String(r['KategoriKode'] ?? '').trim().toLowerCase()) ? (kategoriMap.get(String(r['KategoriKode']).trim().toLowerCase()) ?? null) : null
          const spesifikasiId = (String(r['SpesifikasiKode'] ?? '').trim().toLowerCase()) ? (spesMap.get(String(r['SpesifikasiKode']).trim().toLowerCase()) ?? null) : null
          const merkId = (String(r['MerkKode'] ?? '').trim().toLowerCase()) ? (merkMap.get(String(r['MerkKode']).trim().toLowerCase()) ?? null) : null
          const hpp = parseRegionalNumber(r['HPP'])
          const aktif = String(r['Aktif'] ?? '').toLowerCase().startsWith('y')
          const tampilMenu = String(r['TampilMenu'] ?? '').toLowerCase().startsWith('y')
          const units = parseUnits(r)
          const price = parseRegionalNumber(r['Harga'])
          const effectiveDate = String(r['TanggalBerlaku'] ?? '') || new Date().toISOString().slice(0, 10)
          const photoUrl = String(r['FotoURL'] ?? '').trim() || null

          const res = await fetch('/api/barang', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code, name, kategoriId, spesifikasiId, merkId, hpp,
              jenis: 3, aktif, tampilMenu, photoUrl, units,
              prices: [{ price, effectiveDate }],
            }),
          })
          if (!res.ok) {
            let errDetail = ''
            try { const errJson = await res.json(); errDetail = errJson?.error || JSON.stringify(errJson) } catch { try { errDetail = await res.text() } catch {}
            }
            throw new Error(`HTTP ${res.status} ${res.statusText}${errDetail ? ' - ' + errDetail : ''}`)
          }
          existingCodes.add(code.toLowerCase())
          ok++
          logs.push(`Baris ${idx + 2}: OK - ${code} (${name}) tersimpan`)
        } catch (err: any) {
          fail++
          logs.push(`Baris ${idx + 2}: GAGAL - ${err?.message ?? err}`)
        }
      }
      logs.unshift(`Selesai import. Berhasil: ${ok}, Gagal: ${fail}`)
      setLog(logs)
      onDone()
    } catch (error) {
      console.error('Import error:', error)
      setLog(['Error saat import: ' + (error instanceof Error ? error.message : 'Unknown error')])
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-3 relative">
      {isImporting && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded">
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-lg border">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Sedang mengimport data...</span>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={downloadTemplate} disabled={isImporting}>Download Template</Button>
        <label className={`inline-flex items-center px-3 py-1.5 rounded-pill border text-slate-700 text-sm cursor-pointer hover:bg-slate-50 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Pilih File Excel
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" disabled={isImporting} />
        </label>
        <Button type="button" onClick={runImport} disabled={!rows.length || isImporting}>{isImporting ? 'Importing...' : 'Import'}</Button>
        {log.length > 0 && (
          <Button type="button" onClick={() => {
            const blob = new Blob([log.join("\n")], { type: 'text/plain;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `import-barang-pembantu-log-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
          }} disabled={isImporting}>Download Log</Button>
        )}
      </div>
      {rows.length > 0 && (<div className="text-xs text-slate-600">Siap import {rows.length} baris.</div>)}
      {log.length > 0 && (
        <div className="p-3 rounded border bg-slate-50 text-xs space-y-1 max-h-60 overflow-auto">
          {log.map((l, i) => (<div key={i}>{l}</div>))}
        </div>
      )}
    </div>
  )
}
