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
  
  // Parse up to 3 levels of units from separate columns
  for (let i = 1; i <= 3; i++) {
    const name = titleCase(String(row[`Satuan${i}_Nama`] ?? '').trim())
    const ratio = Number(String(row[`Satuan${i}_Rasio`] ?? '').trim())
    
    if (name && !isNaN(ratio) && ratio > 0) {
      units.push({ name, ratio })
    }
  }
  
  // Default to Pcs=1 if no units provided
  return units.length ? units : [{ name: 'Pcs', ratio: 1 }]
}

export default function ImportBarang({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<any[]>([])
  const [log, setLog] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  // Master lists from SQLite API
  const [kategoriList, setKategoriList] = useState<any[]>([])
  const [spesList, setSpesList] = useState<any[]>([])
  const [merkList, setMerkList] = useState<any[]>([])
  const [accountList, setAccountList] = useState<any[]>([])
  const [mastersReady, setMastersReady] = useState(false)
  const [mastersError, setMastersError] = useState<string | null>(null)

  const loadMasters = async () => {
    setMastersReady(false)
    setMastersError(null)
    try {
      const [rk, rs, rm, rac] = await Promise.all([
        fetch('/api/kategori?limit=9999'),
        fetch('/api/spesifikasi?limit=9999'),
        fetch('/api/merk?limit=9999'),
        fetch('/api/keuangan/perkiraan'),
      ])
      if (!rk.ok) throw new Error(`API kategori error (${rk.status})`)
      if (!rs.ok) throw new Error(`API spesifikasi error (${rs.status})`)
      if (!rm.ok) throw new Error(`API merk error (${rm.status})`)
      if (!rac.ok) throw new Error(`API perkiraan error (${rac.status})`)
      const [dk, ds, dm, dac] = await Promise.all([rk.json(), rs.json(), rm.json(), rac.json()])
      setKategoriList(Array.isArray(dk) ? dk : (dk?.rows || []))
      setSpesList(Array.isArray(ds) ? ds : (ds?.rows || []))
      setMerkList(Array.isArray(dm) ? dm : (dm?.rows || []))
      setAccountList(Array.isArray(dac) ? dac.filter((a:any) => {
        if (a.is_header) return false
        return a.posting_allowed === undefined || Number(a.posting_allowed) === 1
      }) : [])
      setMastersReady(true)
    } catch (e: any) {
      console.error('Gagal memuat master data:', e)
      setKategoriList([]); setSpesList([]); setMerkList([]); setAccountList([])
      setMastersError(e?.message || 'Gagal memuat master data. Refresh halaman atau coba lagi.')
    }
  }

  useEffect(() => { loadMasters() }, [])

  const downloadTemplate = () => {
    try {
      const header = [
        'Kode',
        'Nama',
        'KategoriKode',
        'SpesifikasiKode',
        'MerkKode',
        'PerkiraanKode',
        'HPP',
        'Jenis',
        'Aktif',
        'TampilMenu',
        'FotoURL',
        'Satuan1_Nama',
        'Satuan1_Rasio',
        'Satuan2_Nama',
        'Satuan2_Rasio',
        'Satuan3_Nama',
        'Satuan3_Rasio',
        'Harga',
        'TanggalBerlaku',
      ]
      const sample = [
        [
          'BRG-001',
          'Contoh Barang',
          'CTG-001',
          'SPE-001',
          'MRK-001',
          '100-000-00',
          10000,
          'Barang Jadi',
          'Ya',
          'Ya',
          'https://example.com/foto-produk.jpg',
          'Pcs',
          1,
          'Lusin',
          12,
          'Dus',
          48,
          15000,
          '2025-10-10',
        ],
      ]
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([header, ...sample])
      
      // Set column widths
      const colWidths = header.map(() => ({ wch: 15 }))
      ws['!cols'] = colWidths
      
      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Template')
      
      // Write file with proper options
      XLSX.writeFile(wb, 'Template_Import_Barang.xlsx', {
        bookType: 'xlsx',
        type: 'binary'
      })
      
      console.log('Template downloaded successfully')
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Gagal mendownload template. Pastikan browser mendukung download file.')
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
    
    // Add delay to ensure loading spinner is visible
    await new Promise(resolve => setTimeout(resolve, 500))
    
    try {
      if (!mastersReady) {
        setLog(['Master data belum siap. Tunggu beberapa detik atau klik Refresh Master Data.'])
        setIsImporting(false)
        return
      }
      if (mastersError) {
        setLog(['Master data gagal dimuat. Klik "Refresh Master Data" lalu coba lagi.'])
        setIsImporting(false)
        return
      }
      // First, validate all master codes before processing any rows
      const invalidCodes: string[] = []
      const mapByCode = (arr: { code: string; id: number }[]) =>
        new Map(arr.map((x) => [String(x.code || '').toLowerCase(), x.id]))

    const kategoriMap = mapByCode(kategoriList)
    const spesMap = mapByCode(spesList)
    const merkMap = mapByCode(merkList)
    const accountMap = mapByCode(accountList)

    // Pre-validation: Check all master codes exist
    rows.forEach((r, idx) => {
      const kategoriCode = String(r['KategoriKode'] ?? '').trim()
      const spesCode = String(r['SpesifikasiKode'] ?? '').trim()
      const merkCode = String(r['MerkKode'] ?? '').trim()
      const perkiraanCode = String(r['PerkiraanKode'] ?? '').trim()

      if (kategoriCode && !kategoriMap.has(kategoriCode.toLowerCase())) {
        invalidCodes.push(`Baris ${idx + 2}: Kode Kategori "${kategoriCode}" tidak ditemukan`)
      }
      if (spesCode && !spesMap.has(spesCode.toLowerCase())) {
        invalidCodes.push(`Baris ${idx + 2}: Kode Spesifikasi "${spesCode}" tidak ditemukan`)
      }
      if (merkCode && !merkMap.has(merkCode.toLowerCase())) {
        invalidCodes.push(`Baris ${idx + 2}: Kode Merk "${merkCode}" tidak ditemukan`)
      }
      if (perkiraanCode && !accountMap.has(perkiraanCode.toLowerCase())) {
        invalidCodes.push(`Baris ${idx + 2}: Kode Perkiraan "${perkiraanCode}" tidak ditemukan`)
      }
    })

      // If there are invalid codes, show error and stop
      if (invalidCodes.length > 0) {
        const errorMsg = `Import dibatalkan! Kode master tidak ditemukan:\n\n${invalidCodes.join('\n')}\n\nPastikan semua kode Kategori, Merk, dan Spesifikasi sudah ada di master data.`
        alert(errorMsg)
        setLog(invalidCodes)
        setIsImporting(false)
        return
      }

      // Proceed with import if all codes are valid
      const logs: string[] = []
      let ok = 0
      let fail = 0
      
      // Get existing barang codes (non-deleted only) from API
      const existingBarangRes = await fetch('/api/barang')
      const existingBarang = existingBarangRes.ok ? await existingBarangRes.json() : []
      const existingCodes = new Set((existingBarang || []).map((b: any) => String(b.code || '').toLowerCase()))

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx]
        try {
          const code = String(r['Kode'] ?? '').trim().toUpperCase()
          const name = titleCase(String(r['Nama'] ?? '').trim())
          if (!code || !name) throw new Error('Kode/Nama wajib')
          
          // Check duplicate code
          if (existingCodes.has(code.toLowerCase())) {
            throw new Error(`Kode ${code} sudah digunakan`)
          }
          const kategoriCode = String(r['KategoriKode'] ?? '').trim().toLowerCase()
          const spesCode = String(r['SpesifikasiKode'] ?? '').trim().toLowerCase()
          const merkCode = String(r['MerkKode'] ?? '').trim().toLowerCase()
          const perkiraanCode = String(r['PerkiraanKode'] ?? '').trim().toLowerCase()
          const kategoriId = kategoriCode ? kategoriMap.get(kategoriCode) ?? null : null
          const spesifikasiId = spesCode ? spesMap.get(spesCode) ?? null : null
          const merkId = merkCode ? merkMap.get(merkCode) ?? null : null
          const accountId = perkiraanCode ? accountMap.get(perkiraanCode) ?? null : null
        const hpp = parseRegionalNumber(r['HPP'])
        const jenisRaw = String(r['Jenis'] ?? '').toLowerCase()
        const jenis = jenisRaw.includes('bahan') ? 2 : 1
        const aktif = String(r['Aktif'] ?? '').toLowerCase().startsWith('y')
        const tampilMenu = String(r['TampilMenu'] ?? '').toLowerCase().startsWith('y')
        const units = parseUnits(r)
        const price = parseRegionalNumber(r['Harga'])
        const effectiveDate = String(r['TanggalBerlaku'] ?? '') || new Date().toISOString().slice(0, 10)
        const photoUrl = String(r['FotoURL'] ?? '').trim() || null

        // Create barang via API
        const res = await fetch('/api/barang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            name,
            kategoriId,
            spesifikasiId,
            merkId,
            accountId,
            hpp,
            jenis,
            aktif,
            tampilMenu,
            photoUrl,
            units,
            prices: [{ price, effectiveDate }],
          }),
        })
        if (!res.ok) {
          let errDetail = ''
          try {
            const errJson = await res.json()
            errDetail = errJson?.error || JSON.stringify(errJson)
          } catch {
            try { errDetail = await res.text() } catch {}
          }
          throw new Error(`HTTP ${res.status} ${res.statusText}${errDetail ? ' - ' + errDetail : ''}`)
        }
        // Add to existing codes set to prevent duplicates within this import batch
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
      {mastersError && (
        <div className="flex items-center gap-2 p-2 rounded border border-red-200 bg-red-50 text-xs text-red-700">
          <span>{mastersError}</span>
          <button onClick={loadMasters} className="ml-auto px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 font-medium">Refresh Master Data</button>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={downloadTemplate} disabled={isImporting}>Download Template</Button>
        <label className={`inline-flex items-center px-3 py-1.5 rounded-pill border text-slate-700 text-sm cursor-pointer hover:bg-slate-50 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Pilih File Excel
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" disabled={isImporting} />
        </label>
        <Button type="button" onClick={runImport} disabled={!rows.length || isImporting || !mastersReady}>
          {isImporting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Importing...
            </div>
          ) : (
            'Import'
          )}
        </Button>
        {!mastersReady && !mastersError && (
          <span className="text-xs text-slate-500 self-center">Memuat master data...</span>
        )}
        {log.length > 0 && (
          <Button
            type="button"
            onClick={() => {
              const blob = new Blob([log.join("\n")], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `import-barang-log-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
            }}
            disabled={isImporting}
          >
            Download Log
          </Button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="text-xs text-slate-600">Siap import {rows.length} baris.</div>
      )}
      {log.length > 0 && (
        <div className="p-3 rounded border bg-slate-50 text-xs space-y-1 max-h-60 overflow-auto">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}
