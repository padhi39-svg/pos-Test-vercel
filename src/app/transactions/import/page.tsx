"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type ExcelRow = {
  tanggal: string
  customer_code?: string
  customer_name?: string
  kode_barang: string
  nama_barang?: string
  quantity: number
  harga: number
  ppn?: number
  metode_pembayaran?: string
  nominal_bayar?: number
  catatan?: string
}

export default function ImportTransactionsPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [preview, setPreview] = useState<any>(null)
  const [previewAdvanced, setPreviewAdvanced] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const downloadTemplate = () => {
    // Create template data - SIMPLIFIED VERSION
    const template = [
      {
        'No. Nota': '1',
        'Tanggal (DD/MM/YYYY)': '13/10/2025',
        'Kode Customer': 'CUST001',
        'Tipe': 1,
        'Kode Barang': 'MK058',
        'Quantity': 1
      },
      {
        'No. Nota': '1',
        'Tanggal (DD/MM/YYYY)': '13/10/2025',
        'Kode Customer': 'CUST001',
        'Tipe': 1,
        'Kode Barang': 'MK059',
        'Quantity': 2
      },
      {
        'No. Nota': '2',
        'Tanggal (DD/MM/YYYY)': '14/10/2025',
        'Kode Customer': 'CUST002',
        'Tipe': 2,
        'Kode Barang': 'MK058',
        'Quantity': 1
      }
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'Template_Import_Penjualan.xlsx')
  }

  const downloadAdvancedTemplate = () => {
    const headerRows = [
      {
        transactioncode: 'TRX-001',
        tanggalnota: '13/10/2025',
        jamnota: '12:30',
        tanggalcreate: '13/10/2025',
        jamcreate: '12:31',
        // Jenis transaksi: 1=Resto, 2=Retail, 3=Invoice
        transaction_type: 1,
        KodeCustomer: 'CUST001',
        warehouse: 'WH-01',
        kodemeja: 'T01',
        jumlah_tamu: 3,
        subtotal: 200000,
        disc: 0,
        service_charge: 10000,
        tax: 20000,
        total: 230000,
        // Pembayaran (format baru): isi nilai Tunai/Debit/Kredit. Multi akan terdeteksi otomatis.
        Tunai: 100000,
        KartuDebit: 130000,
        PenerbitKartuDebit: 'BCA',
        NoKartuDebit: '4111 1111 1111 1111',
        KartuKredit: 0,
        PenerbitKartuKredit: '',
        NoKartuKredit: '',
        user_create: 'kasir@resto.com',
        sales: 'SLS001',
        keterangan: 'Makan siang meja 1',
      },
      {
        transactioncode: 'TRX-002',
        tanggalnota: '13/10/2025',
        jamnota: '19:15',
        tanggalcreate: '13/10/2025',
        jamcreate: '19:16',
        transaction_type: 2,
        KodeCustomer: '',
        warehouse: 'WH-01',
        kodemeja: 'T05',
        jumlah_tamu: 2,
        subtotal: 150000,
        disc: 0,
        service_charge: 7500,
        tax: 15000,
        total: 172500,
        Tunai: 0,
        KartuDebit: 172500,
        PenerbitKartuDebit: 'BCA',
        NoKartuDebit: '4111 1111 1111 1111',
        KartuKredit: 0,
        PenerbitKartuKredit: '',
        NoKartuKredit: '',
        user_create: 'kasir@resto.com',
        sales: 'SLS001',
        keterangan: 'Walk-in, bayar debit BCA',
      },
    ]

    const detailRows = [
      {
        transactioncode: 'TRX-001',
        KodeBarang: 'MK058',
        Quantity: 1,
        Harga: 200000,
        discount_amount: 0,
        total_price: 200000,
      },
      {
        transactioncode: 'TRX-001',
        KodeBarang: 'MK059',
        Quantity: 2,
        Harga: 100000,
        discount_amount: 0,
        total_price: 200000,
      },
      {
        transactioncode: 'TRX-002',
        KodeBarang: 'MK100',
        Quantity: 1,
        Harga: 150000,
        discount_amount: 0,
        total_price: 150000,
      },
      {
        transactioncode: 'TRX-002',
        KodeBarang: 'MK200',
        Quantity: -1,
        Harga: 150000,
        discount_amount: 0,
        total_price: -150000,
      },
    ]

    const wb = XLSX.utils.book_new()
    const wsHeader = XLSX.utils.json_to_sheet(headerRows)
    const wsDetail = XLSX.utils.json_to_sheet(detailRows)
    XLSX.utils.book_append_sheet(wb, wsHeader, 'Header')
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail')
    XLSX.writeFile(wb, 'Template_Import_Penjualan_Advanced.xlsx')
  }

  const runImport = async (mode: 'preview' | 'import') => {
    if (!file) {
      alert('Pilih file Excel terlebih dahulu')
      return
    }

    try {
      setLoading(true)
      setResult(null)
      if (mode === 'preview') setPreview(null)

      // Read Excel file
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        alert('File Excel kosong')
        return
      }

      // Group by No. Nota (simplified grouping)
      const transactionsMap = new Map<string, any>()

      const parseDateExcel = (raw: any): string | null => {
        const str = String(raw || '').trim()
        if (!str) return null
        // Expect dd/mm/yyyy from Excel
        const parts = str.split('/')
        if (parts.length !== 3) return null
        const [dd, mm, yyyy] = parts
        if (!dd || !mm || !yyyy) return null
        const d = dd.padStart(2, '0')
        const m = mm.padStart(2, '0')
        const y = yyyy.length === 2 ? `20${yyyy}` : yyyy
        return `${y}-${m}-${d}`
      }

      for (const row of jsonData) {
        const noNota = row['No. Nota'] || ''
        const tanggalRaw = row['Tanggal (DD/MM/YYYY)']
        const tanggal = parseDateExcel(tanggalRaw)
        const customerCode = row['Kode Customer'] || ''
        const tipeRaw = row['Tipe']
        const kodeBarang = row['Kode Barang']
        const quantity = parseFloat(row['Quantity']) || 0

        if (!tanggal || !kodeBarang) {
          continue
        }

        // Create unique key for transaction using No. Nota
        const txKey = noNota ? `nota_${noNota}` : `${tanggal}_${customerCode}_${Math.random()}`

        if (!transactionsMap.has(txKey)) {
          transactionsMap.set(txKey, {
            tanggal,
            customer_code: customerCode,
            tipe: (tipeRaw !== undefined && tipeRaw !== null && String(tipeRaw).trim() !== '') ? Number(tipeRaw) : undefined,
            items: []
          })
        }

        transactionsMap.get(txKey).items.push({
          kode_barang: kodeBarang,
          quantity
        })
      }

      const transactions = Array.from(transactionsMap.values())

      // Send to API
      const endpoint = mode === 'preview' ? '/api/transactions/import?dry=1' : '/api/transactions/import'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, dryRun: mode === 'preview' ? 1 : 0 })
      })

      const result = await res.json()
      if (mode === 'preview') setPreview(result)
      else setResult(result)

      if (mode === 'import') {
        if (result?.results) {
          const { success = 0, failed = 0 } = result.results
          alert(`Import selesai: ${success} berhasil, ${failed} gagal`)
          if (failed === 0) {
            router.refresh()
          }
        }
      } else {
        if (result.results) {
          alert(`Preview selesai: ${result.results.success} transaksi valid, ${result.results.failed} error`)
        }
      }

    } catch (error: any) {
      console.error('Error importing:', error)
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper untuk parsing Excel advanced (dipakai oleh preview dan import)
  const parseAdvancedExcel = async () => {
    if (!file) {
      alert('Pilih file Excel terlebih dahulu')
      return null
    }
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const headerSheet = workbook.Sheets['Header']
    const detailSheet = workbook.Sheets['Detail']
    if (!headerSheet || !detailSheet) {
      alert('File harus memiliki dua sheet bernama "Header" dan "Detail"')
      return null
    }
    const headerJson = XLSX.utils.sheet_to_json(headerSheet, { defval: '' }) as any[]
    const detailJson = XLSX.utils.sheet_to_json(detailSheet, { defval: '' }) as any[]
    if (headerJson.length === 0 || detailJson.length === 0) {
      alert('Sheet Header dan Detail tidak boleh kosong')
      return null
    }
    const headers = headerJson.map((row, idx) => ({
      transactioncode: String(row.transactioncode || row.TransactionCode || '').trim(),
      tanggalnota: String(row.tanggalnota || row.TanggalNota || row['tanggal nota'] || '').trim(),
      jamnota: String(row.jamnota || row.JamNota || '').trim(),
      tanggalcreate: String(row.tanggalcreate || row.TanggalCreate || '').trim(),
      jamcreate: String(row.jamcreate || row.JamCreate || '').trim(),
      // Jenis transaksi (alias): tipe_penjualan / transaction_type / tipe / jenis_penjualan
      transaction_type: (() => {
        const n = Number(row.transaction_type ?? row.tipe ?? row.tipe_penjualan)
        if (Number.isFinite(n) && [1,2,3].includes(n)) return n
        const s = String(row.jenis_penjualan || '').trim().toLowerCase()
        if (s === 'retail' || s === '2') return 2
        if (s === 'invoice' || s === '3') return 3
        if (s === 'resto' || s === '1') return 1
        return undefined
      })(),
      KodeCustomer: String(row.KodeCustomer || row.customer_code || '').trim(),
      warehouse: String(row.warehouse || row.warehouse_code || '').trim(),
      kodemeja: String(row.kodemeja || row.table_code || '').trim(),
      jumlah_tamu: row.jumlah_tamu !== '' ? Number(row.jumlah_tamu) : undefined,
      subtotal: row.subtotal !== '' ? Number(row.subtotal) : undefined,
      disc: row.disc !== '' ? Number(row.disc) : undefined,
      service_charge: row.service_charge !== '' && row.service_charge !== undefined ? Number(row.service_charge) : undefined,
      tax: row.tax !== '' ? Number(row.tax) : undefined,
      total: Number(row.total ?? 0) || 0,
      Tunai: row.Tunai !== '' && row.Tunai !== undefined ? Number(row.Tunai) : (row.tunai !== '' && row.tunai !== undefined ? Number(row.tunai) : undefined),
      KartuDebit: row.KartuDebit !== '' && row.KartuDebit !== undefined ? Number(row.KartuDebit) : (row.kartudebit !== '' && row.kartudebit !== undefined ? Number(row.kartudebit) : undefined),
      PenerbitKartuDebit: String(row.PenerbitKartuDebit || row.penerbitkartudebit || '').trim(),
      NoKartuDebit: String(row.NoKartuDebit || row.nokartudebit || '').trim(),
      KartuKredit: row.KartuKredit !== '' && row.KartuKredit !== undefined ? Number(row.KartuKredit) : (row.kartukredit !== '' && row.kartukredit !== undefined ? Number(row.kartukredit) : undefined),
      PenerbitKartuKredit: String(row.PenerbitKartuKredit || row.penerbitkartukredit || '').trim(),
      NoKartuKredit: String(row.NoKartuKredit || row.nokartukredit || '').trim(),
      user_create: String(row.user_create || '').trim(),
      sales: String(row.sales || '').trim(),
      keterangan: String(row.keterangan || row.catatan || '').trim(),
      __rowIndex: idx + 2,
    }))
    const details = detailJson.map((row, idx) => ({
      transactioncode: String(row.transactioncode || row.TransactionCode || '').trim(),
      KodeBarang: String(row.KodeBarang || row.kode_barang || '').trim(),
      Quantity: Number(row.Quantity ?? row.quantity ?? 0) || 0,
      unit_price: row.unit_price !== undefined
        ? Number(row.unit_price)
        : (row.Harga !== undefined
          ? Number(row.Harga)
          : (row.price !== undefined ? Number(row.price) : undefined)),
      discount_amount: row.discount_amount !== undefined
        ? Number(row.discount_amount)
        : (row.DiscAmount !== undefined
          ? Number(row.DiscAmount)
          : (row.disc_amount !== undefined ? Number(row.disc_amount) : undefined)),
      total_price: row.total_price !== undefined
        ? Number(row.total_price)
        : (row.TotalPrice !== undefined
          ? Number(row.TotalPrice)
          : undefined),
      __rowIndex: idx + 2,
    }))
    return { headers, details }
  }

  const runPreviewAdvanced = async () => {
    try {
      setLoading(true)
      setPreviewAdvanced(null)
      const parsed = await parseAdvancedExcel()
      if (!parsed) return
      const { headers, details } = parsed
      const res = await fetch('/api/transactions/import-advanced?dry=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, details, dryRun: 1 }),
      })
      const dataRes = await res.json()
      if (!res.ok) {
        const msg = String(dataRes?.error || dataRes?.details || 'Gagal preview advanced')
        alert(msg)
        return
      }
      setPreviewAdvanced(dataRes)
      const results = dataRes.results || { success: 0, failed: 0 }
      alert(`Preview advanced selesai: ${results.success} transaksi valid, ${results.failed} error`)
    } catch (error: any) {
      console.error('Error preview advanced:', error)
      alert('Error preview advanced: ' + (error?.message || String(error)))
    } finally {
      setLoading(false)
    }
  }

  const runImportAdvanced = async () => {
    try {
      setLoading(true)
      const parsed = await parseAdvancedExcel()
      if (!parsed) return
      const { headers, details } = parsed
      const res = await fetch('/api/transactions/import-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, details }),
      })
      const dataRes = await res.json()
      if (!res.ok) {
        // Tampilkan pesan 400 dari server (termasuk ringkasan error atomic)
        const msg = String(
          dataRes?.message || dataRes?.error || dataRes?.details || 'Gagal import advanced'
        )
        // Jika server mengembalikan daftar errors, tampilkan beberapa baris agar informatif
        if (Array.isArray(dataRes?.results?.errors) && dataRes.results.errors.length > 0) {
          let detail = '\n\nError detail:'
          for (const err of dataRes.results.errors.slice(0, 20)) {
            detail += `\n- Header row ${err.headerRow || '?'} (trx: ${err.transactioncode || '-'}) -> ${err.error}`
          }
          alert(msg + detail)
        } else {
          alert(msg)
        }
        return
      }
      const results = dataRes.results || { success: 0, failed: 0, errors: [] }
      let msg = `Import advanced selesai: ${results.success} berhasil, ${results.failed} gagal`
      if (Array.isArray(results.errors) && results.errors.length > 0) {
        msg += '\n\nError detail:'
        for (const err of results.errors) {
          msg += `\n- Header row ${err.headerRow || '?'} (trx: ${err.transactioncode || '-'}) -> ${err.error}`
        }
      }
      alert(msg)
      if (results.failed === 0) {
        router.refresh()
      }
    } catch (error: any) {
      console.error('Error importing advanced:', error)
      alert('Error advanced import: ' + (error?.message || String(error)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Import Penjualan Excel</h1>
          <p className="text-sm text-slate-600 mt-1">Import data penjualan bulanan dari file Excel</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
        >
          ← Kembali
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Petunjuk Import:</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Download template Excel dengan klik tombol &ldquo;Download Template&rdquo;</li>
          <li>Isi data penjualan sesuai format template</li>
          <li>Untuk transaksi dengan multiple item, gunakan tanggal, customer, dan pembayaran yang sama</li>
          <li>Kode nota akan dibuat otomatis (format: TRX-YYYYMMDD-XXXX)</li>
          <li>Upload file Excel dan klik &ldquo;Import&rdquo;</li>
        </ol>
      </div>

      {/* Template Download */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">1. Download Template</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadAdvancedTemplate}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 text-sm font-medium shadow flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 018 0m-4-4V4m9 4h-3m-8 0H4" />
            </svg>
            Download Template Advanced (Header & Detail)
          </button>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">2. Upload File Excel</h3>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={runPreviewAdvanced}
              disabled={!file || loading}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-xs md:text-sm font-medium shadow"
            >
              {loading ? 'Memproses...' : 'Preview Advanced'}
            </button>
            <button
              onClick={runImportAdvanced}
              disabled={!file || loading}
              className="px-6 py-2 bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg hover:from-slate-700 hover:to-slate-900 disabled:opacity-50 text-xs md:text-sm font-medium shadow"
            >
              {loading ? 'Memproses...' : 'Import Advanced (2 Sheet)'}
            </button>
          </div>
        </div>
        {file && (
          <p className="text-xs text-slate-600 mt-2">
            File dipilih: {file.name}
          </p>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Preview (Dry Run)</h3>
          <p className="text-xs text-slate-600 mb-3">Tidak ada data yang disimpan. Cek ringkasan berikut sebelum Import.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Kode Customer</th>
                  <th className="px-2 py-1 text-left">Tipe</th>
                  <th className="px-2 py-1 text-left">Kode Barang</th>
                  <th className="px-2 py-1 text-left">Quantity</th>
                  <th className="px-2 py-1 text-right">Items</th>
                  <th className="px-2 py-1 text-right">DPP</th>
                  <th className="px-2 py-1 text-right">PPN</th>
                  <th className="px-2 py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(preview.results?.previews || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="px-2 py-1">{p.transaction_number}</td>
                    <td className="px-2 py-1">{p.tanggal}</td>
                    <td className="px-2 py-1">{p.customer_code || '-'}</td>
                    <td className="px-2 py-1 text-right">{p.items}</td>
                    <td className="px-2 py-1 text-right">{p.dpp.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1 text-right">{p.ppn.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1 text-right">{p.total.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.results?.errors?.length > 0 && (
            <div className="mt-3">
              <h4 className="font-semibold text-red-700 mb-2 text-sm">Error:</h4>
              <div className="bg-red-50 border border-red-200 rounded p-3 max-h-48 overflow-y-auto">
                {preview.results.errors.map((err: any, idx: number) => (
                  <div key={idx} className="text-xs text-red-700 mb-1">
                    <strong>Row {err.row}:</strong> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Advanced */}
      {previewAdvanced && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Preview Advanced (Dry Run)</h3>
          <p className="text-xs text-slate-600 mb-3">Tidak ada data yang disimpan. Cek ringkasan berikut sebelum Import Advanced.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Transaction Code</th>
                  <th className="px-2 py-1 text-left">Tanggal</th>
                  <th className="px-2 py-1 text-left">Customer</th>
                  <th className="px-2 py-1 text-right">Items</th>
                  <th className="px-2 py-1 text-right">Subtotal</th>
                  <th className="px-2 py-1 text-right">Disc</th>
                  <th className="px-2 py-1 text-right">Service Charge</th>
                  <th className="px-2 py-1 text-right">Tax</th>
                  <th className="px-2 py-1 text-right">Total</th>
                  <th className="px-2 py-1 text-left">Payment</th>
                </tr>
              </thead>
              <tbody>
                {(previewAdvanced.results?.previews || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="px-2 py-1 font-medium">{p.transactioncode}</td>
                    <td className="px-2 py-1">{p.tanggal}</td>
                    <td className="px-2 py-1">{p.customer_code || '-'}</td>
                    <td className="px-2 py-1 text-right">{p.items}</td>
                    <td className="px-2 py-1 text-right">{(p.subtotal || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1 text-right">{(p.disc || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1 text-right">{(p.service_charge || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1 text-right">{(p.tax || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1 text-right font-semibold">{(p.total || 0).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1">{p.paymentmethod || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewAdvanced.results?.errors?.length > 0 && (
            <div className="mt-3">
              <h4 className="font-semibold text-red-700 mb-2 text-sm">Error:</h4>
              <div className="bg-red-50 border border-red-200 rounded p-3 max-h-48 overflow-y-auto">
                {previewAdvanced.results.errors.map((err: any, idx: number) => (
                  <div key={idx} className="text-xs text-red-700 mb-1">
                    <strong>Header row {err.headerRow} (trx: {err.transactioncode || '-'}):</strong> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Hasil Import</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">Total:</span>
              <span className="text-slate-600">
                {result.results.success + result.results.failed} transaksi
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-green-700">Berhasil:</span>
              <span className="text-green-600">{result.results.success} transaksi</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-red-700">Gagal:</span>
              <span className="text-red-600">{result.results.failed} transaksi</span>
            </div>

            {result.results.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
                <div className="bg-red-50 border border-red-200 rounded p-3 max-h-60 overflow-y-auto">
                  {result.results.errors.map((err: any, idx: number) => (
                    <div key={idx} className="text-xs text-red-700 mb-2">
                      <strong>Row {err.row}:</strong> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* (Sederhana) disembunyikan */}

      {/* Format Info Advanced */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 mb-2">📝 Format Excel ADVANCED (2 Sheet):</h3>
        <p className="text-xs text-amber-800 mb-3">File harus memiliki 2 sheet: <strong>Header</strong> dan <strong>Detail</strong></p>
        
        <h4 className="font-semibold text-amber-800 text-sm mb-2">Sheet Header:</h4>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead className="bg-amber-200">
              <tr>
                <th className="px-2 py-1 text-left">Kolom</th>
                <th className="px-2 py-1 text-left">Wajib</th>
                <th className="px-2 py-1 text-left">Contoh</th>
                <th className="px-2 py-1 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody className="text-amber-900">
              <tr className="border-t"><td className="px-2 py-1 font-semibold">transactioncode</td><td className="px-2 py-1">✅</td><td className="px-2 py-1">TRX-001</td><td className="px-2 py-1">Kode unik transaksi</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">tanggalnota</td><td className="px-2 py-1">✅</td><td className="px-2 py-1">13/10/2025</td><td className="px-2 py-1">Tanggal nota (DD/MM/YYYY)</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">jamnota</td><td className="px-2 py-1">-</td><td className="px-2 py-1">12:30</td><td className="px-2 py-1">Jam nota</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">KodeCustomer</td><td className="px-2 py-1">-</td><td className="px-2 py-1">CUST001</td><td className="px-2 py-1">Kode customer</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">warehouse</td><td className="px-2 py-1">-</td><td className="px-2 py-1">WH-01</td><td className="px-2 py-1">Kode gudang</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">kodemeja</td><td className="px-2 py-1">-</td><td className="px-2 py-1">T01</td><td className="px-2 py-1">Kode meja</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">jumlah_tamu</td><td className="px-2 py-1">-</td><td className="px-2 py-1">3</td><td className="px-2 py-1">Jumlah tamu</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">subtotal</td><td className="px-2 py-1">-</td><td className="px-2 py-1">200000</td><td className="px-2 py-1">Subtotal sebelum diskon</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">disc</td><td className="px-2 py-1">-</td><td className="px-2 py-1">10000</td><td className="px-2 py-1">Nominal diskon</td></tr>
              <tr className="border-t bg-amber-100"><td className="px-2 py-1 font-semibold">service_charge</td><td className="px-2 py-1">-</td><td className="px-2 py-1">10000</td><td className="px-2 py-1">Nominal service charge</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">tax</td><td className="px-2 py-1">-</td><td className="px-2 py-1">20000</td><td className="px-2 py-1">Nominal PPN/PB1</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">total</td><td className="px-2 py-1">✅</td><td className="px-2 py-1">220000</td><td className="px-2 py-1">Total akhir</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">Tunai</td><td className="px-2 py-1">-</td><td className="px-2 py-1">100000</td><td className="px-2 py-1">Nominal tunai</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">KartuDebit</td><td className="px-2 py-1">-</td><td className="px-2 py-1">130000</td><td className="px-2 py-1">Nominal kartu debit</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">PenerbitKartuDebit</td><td className="px-2 py-1">-</td><td className="px-2 py-1">BCA</td><td className="px-2 py-1">Penerbit/bank kartu debit</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">NoKartuDebit</td><td className="px-2 py-1">-</td><td className="px-2 py-1">4111 1111 1111 1111</td><td className="px-2 py-1">No kartu debit</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">KartuKredit</td><td className="px-2 py-1">-</td><td className="px-2 py-1">0</td><td className="px-2 py-1">Nominal kartu kredit</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">PenerbitKartuKredit</td><td className="px-2 py-1">-</td><td className="px-2 py-1">BCA</td><td className="px-2 py-1">Penerbit/bank kartu kredit</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">NoKartuKredit</td><td className="px-2 py-1">-</td><td className="px-2 py-1">4111 1111 1111 1111</td><td className="px-2 py-1">No kartu kredit</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">user_create</td><td className="px-2 py-1">-</td><td className="px-2 py-1">kasir@resto.com</td><td className="px-2 py-1">Email/username kasir</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">sales</td><td className="px-2 py-1">-</td><td className="px-2 py-1">SLS001</td><td className="px-2 py-1">Kode waiter/sales</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">keterangan</td><td className="px-2 py-1">-</td><td className="px-2 py-1">Makan siang</td><td className="px-2 py-1">Catatan transaksi</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold text-amber-800 text-sm mb-2">Sheet Detail:</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-amber-200">
              <tr>
                <th className="px-2 py-1 text-left">Kolom</th>
                <th className="px-2 py-1 text-left">Wajib</th>
                <th className="px-2 py-1 text-left">Contoh</th>
                <th className="px-2 py-1 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody className="text-amber-900">
              <tr className="border-t"><td className="px-2 py-1 font-semibold">transactioncode</td><td className="px-2 py-1">✅</td><td className="px-2 py-1">TRX-001</td><td className="px-2 py-1">Harus sama dengan Header</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">KodeBarang</td><td className="px-2 py-1">✅</td><td className="px-2 py-1">MK058</td><td className="px-2 py-1">Kode barang/menu</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">Quantity</td><td className="px-2 py-1">✅</td><td className="px-2 py-1">2</td><td className="px-2 py-1">Jumlah (bisa negatif untuk retur)</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">Harga</td><td className="px-2 py-1">-</td><td className="px-2 py-1">50000</td><td className="px-2 py-1">Harga satuan</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">discount_amount</td><td className="px-2 py-1">-</td><td className="px-2 py-1">5000</td><td className="px-2 py-1">Diskon per item</td></tr>
              <tr className="border-t"><td className="px-2 py-1 font-semibold">total_price</td><td className="px-2 py-1">-</td><td className="px-2 py-1">95000</td><td className="px-2 py-1">Total harga item</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
