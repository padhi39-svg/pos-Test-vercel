"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
// Migrate to server API for recipes; local ingredientStore is deprecated
// IMPORTANT: use DB-backed barang provider so codes match server master
import { getAllBarang } from '@/lib/barangStoreDB'
import { parseRegionalNumber } from '@/lib/regionalNumber'
import Button from '@/components/ui/Button'
import * as XLSX from 'xlsx'

function titleCase(s: string) {
  return (s ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function ImportIngredient({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const downloadTemplate = () => {
    const template = [
      {
        'Kode Barang Jadi': 'BRG001',
        'Porsi': 4,
        'Kode Bahan 1': 'BHN001',
        'Qty Bahan 1': '0,5',
        'Unit Bahan 1': 'kg',
        'Kode Bahan 2': 'BHN002',
        'Qty Bahan 2': '2',
        'Unit Bahan 2': 'pcs',
        'Kode Bahan 3': 'BHN003',
        'Qty Bahan 3': '0,25',
        'Unit Bahan 3': 'kg',
        'Kode Bahan 4': 'BHN004',
        'Qty Bahan 4': '0,1',
        'Unit Bahan 4': 'kg',
        'Kode Bahan 5': 'BHN005',
        'Qty Bahan 5': '0,05',
        'Unit Bahan 5': 'kg',
        'Kode Bahan 6': 'BHN006',
        'Qty Bahan 6': '2',
        'Unit Bahan 6': 'sdm',
        'Kode Bahan 7': 'BHN007',
        'Qty Bahan 7': '1',
        'Unit Bahan 7': 'sdt',
        'Kode Bahan 8': 'BHN008',
        'Qty Bahan 8': '0,02',
        'Unit Bahan 8': 'kg',
        'Kode Bahan 9': '',
        'Qty Bahan 9': '',
        'Unit Bahan 9': '',
        'Kode Bahan 10': '',
        'Qty Bahan 10': '',
        'Unit Bahan 10': '',
        'Aktif': 'Ya'
      },
      {
        'Kode Barang Jadi': 'BRG002',
        'Porsi': 2,
        'Kode Bahan 1': 'BHN009',
        'Qty Bahan 1': '1',
        'Unit Bahan 1': 'kg',
        'Kode Bahan 2': 'BHN010',
        'Qty Bahan 2': '0,5',
        'Unit Bahan 2': 'kg',
        'Kode Bahan 3': 'BHN011',
        'Qty Bahan 3': '2',
        'Unit Bahan 3': 'liter',
        'Kode Bahan 4': 'BHN012',
        'Qty Bahan 4': '0,05',
        'Unit Bahan 4': 'kg',
        'Kode Bahan 5': 'BHN013',
        'Qty Bahan 5': '0,02',
        'Unit Bahan 5': 'kg',
        'Kode Bahan 6': 'BHN014',
        'Qty Bahan 6': '1',
        'Unit Bahan 6': 'sdm',
        'Kode Bahan 7': 'BHN015',
        'Qty Bahan 7': '0,5',
        'Unit Bahan 7': 'sdt',
        'Kode Bahan 8': '',
        'Qty Bahan 8': '',
        'Unit Bahan 8': '',
        'Kode Bahan 9': '',
        'Qty Bahan 9': '',
        'Unit Bahan 9': '',
        'Kode Bahan 10': '',
        'Qty Bahan 10': '',
        'Unit Bahan 10': '',
        'Aktif': 'Ya'
      },
      {
        'Kode Barang Jadi': 'BRG003',
        'Porsi': 3,
        'Kode Bahan 1': 'BHN016',
        'Qty Bahan 1': '1',
        'Unit Bahan 1': 'ekor',
        'Kode Bahan 2': 'BHN017',
        'Qty Bahan 2': '0,2',
        'Unit Bahan 2': 'kg',
        'Kode Bahan 3': 'BHN018',
        'Qty Bahan 3': '0,1',
        'Unit Bahan 3': 'liter',
        'Kode Bahan 4': 'BHN019',
        'Qty Bahan 4': '0,05',
        'Unit Bahan 4': 'kg',
        'Kode Bahan 5': 'BHN020',
        'Qty Bahan 5': '0,02',
        'Unit Bahan 5': 'kg',
        'Kode Bahan 6': 'BHN021',
        'Qty Bahan 6': '3',
        'Unit Bahan 6': 'sdm',
        'Kode Bahan 7': 'BHN022',
        'Qty Bahan 7': '1',
        'Unit Bahan 7': 'sdt',
        'Kode Bahan 8': 'BHN023',
        'Qty Bahan 8': '0,01',
        'Unit Bahan 8': 'kg',
        'Kode Bahan 9': '',
        'Qty Bahan 9': '',
        'Unit Bahan 9': '',
        'Kode Bahan 10': '',
        'Qty Bahan 10': '',
        'Unit Bahan 10': '',
        'Aktif': 'Ya'
      },
      {
        'Kode Barang Jadi': 'BRG004',
        'Porsi': 5,
        'Kode Bahan 1': 'BHN024',
        'Qty Bahan 1': '0,02',
        'Unit Bahan 1': 'kg',
        'Kode Bahan 2': 'BHN025',
        'Qty Bahan 2': '0,15',
        'Unit Bahan 2': 'kg',
        'Kode Bahan 3': 'BHN026',
        'Qty Bahan 3': '1',
        'Unit Bahan 3': 'liter',
        'Kode Bahan 4': 'BHN027',
        'Qty Bahan 4': '2',
        'Unit Bahan 4': 'buah',
        'Kode Bahan 5': 'BHN028',
        'Qty Bahan 5': '0,01',
        'Unit Bahan 5': 'kg',
        'Kode Bahan 6': 'BHN029',
        'Qty Bahan 6': '5',
        'Unit Bahan 6': 'buah',
        'Kode Bahan 7': 'BHN030',
        'Qty Bahan 7': '0,05',
        'Unit Bahan 7': 'liter',
        'Kode Bahan 8': '',
        'Qty Bahan 8': '',
        'Unit Bahan 8': '',
        'Kode Bahan 9': '',
        'Qty Bahan 9': '',
        'Unit Bahan 9': '',
        'Kode Bahan 10': '',
        'Qty Bahan 10': '',
        'Unit Bahan 10': '',
        'Aktif': 'Ya'
      }
    ]
    
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Ingredient')
    XLSX.writeFile(wb, 'template_ingredient.xlsx')
  }

  const handleImport = async () => {
    if (!file) {
      alert('Pilih file Excel terlebih dahulu')
      return
    }

    setLoading(true)
    
    try {
      // Add delay to show spinner
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        throw new Error('File Excel kosong atau tidak valid')
      }

      // Get existing data for validation (from API)
      const existingRes = await fetch('/api/recipes')
      const existingList = existingRes.ok ? await existingRes.json() : []
      const existingByBarang = new Set<number>((existingList || []).map((r: any) => Number(r.barang_id)))
      const allBarang = await getAllBarang()
      
      // Create maps for quick lookup
      // Helper to normalize code: lowercase, remove non-alphanumeric
      const normalizeCode = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const barangJadiMap = new Map<string, any>()
      const barangJadiNormMap = new Map<string, any>()
      const bahanBakuMap = new Map<string, any>()
      const bahanBakuNormMap = new Map<string, any>()
      
      allBarang.forEach(b => {
        const codeLc = String(b.code||'').toLowerCase()
        const codeNorm = normalizeCode(b.code||'')
        if (b.jenis === 1) { // Barang Jadi
          barangJadiMap.set(codeLc, b)
          barangJadiNormMap.set(codeNorm, b)
        } else if (b.jenis === 2) { // Bahan Baku
          bahanBakuMap.set(codeLc, b)
          bahanBakuNormMap.set(codeNorm, b)
        } else if (b.jenis === 3) { // Barang Setengah Jadi
          barangJadiMap.set(codeLc, b)
          barangJadiNormMap.set(codeNorm, b)
          bahanBakuMap.set(codeLc, b)
          bahanBakuNormMap.set(codeNorm, b)
        }
      })

      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (let i = 0; i < jsonData.length; i++) {
        const r = jsonData[i] as any
        const rowNum = i + 2 // Excel row number (1-indexed + header)
        
        try {
          // Validate required fields
          const barangJadiCode = String(r['Kode Barang Jadi'] ?? '').trim().toLowerCase()
          const description = String(r['Deskripsi'] ?? '').trim()
          const portion = Number(r['Porsi'] ?? 1) || 1
          const aktif = String(r['Aktif'] ?? '').toLowerCase().startsWith('y')

          if (!barangJadiCode) {
            errors.push(`Baris ${rowNum}: Kode Barang Jadi wajib diisi`)
            errorCount++
            continue
          }

          // Check if barang jadi exists
          let barangJadi = barangJadiMap.get(barangJadiCode)
          if (!barangJadi) {
            // Try normalized match: ignore non-alphanumeric and prefixes
            const codeNorm = normalizeCode(barangJadiCode)
            barangJadi = barangJadiNormMap.get(codeNorm)
          }
          if (!barangJadi) {
            // Try suffix match (e.g., DB code '01/MK218' vs input 'mk218')
            const candidate = Array.from(barangJadiMap.entries()).find(([k]) => k.endsWith(barangJadiCode))
            if (candidate) barangJadi = candidate[1]
          }
          if (!barangJadi) {
            errors.push(`Baris ${rowNum}: Kode Barang Jadi '${barangJadiCode}' tidak ditemukan`)
            errorCount++
            continue
          }

          // Use barang jadi name as the ingredient name (since we removed separate name field)
          const name = barangJadi.name

          // Check for duplicate ingredient (same barang jadi) from server data
          const already = existingByBarang.has(Number(barangJadi.id))
          if (already) {
            errors.push(`Baris ${rowNum}: Resep untuk '${barangJadi.name}' sudah ada`)
            errorCount++
            continue
          }

          // Parse ingredient items (up to 10 bahan)
          const items = []
          for (let j = 1; j <= 10; j++) {
            const bahanCode = String(r[`Kode Bahan ${j}`] ?? '').trim().toLowerCase()
            const qty = parseRegionalNumber(r[`Qty Bahan ${j}`])
            const unit = String(r[`Unit Bahan ${j}`] ?? '').trim()

            if (bahanCode) {
              // Validate bahan baku exists
              let bahanBaku = bahanBakuMap.get(bahanCode)
              if (!bahanBaku) {
                const codeNorm = normalizeCode(bahanCode)
                bahanBaku = bahanBakuNormMap.get(codeNorm)
              }
              if (!bahanBaku) {
                const candidate = Array.from(bahanBakuMap.entries()).find(([k]) => k.endsWith(bahanCode))
                if (candidate) bahanBaku = candidate[1]
              }
              if (!bahanBaku) {
                errors.push(`Baris ${rowNum}: Kode Bahan '${bahanCode}' tidak ditemukan`)
                errorCount++
                continue
              }

              if (qty <= 0) {
                errors.push(`Baris ${rowNum}: Qty Bahan ${j} harus lebih dari 0`)
                errorCount++
                continue
              }

              if (!unit) {
                errors.push(`Baris ${rowNum}: Unit Bahan ${j} wajib diisi`)
                errorCount++
                continue
              }

              // Check if unit exists in barang units
              const validUnit = bahanBaku.units.find((u: any) => u.name.toLowerCase() === unit.toLowerCase())
              if (!validUnit) {
                errors.push(`Baris ${rowNum}: Unit '${unit}' tidak valid untuk bahan '${bahanBaku.name}'. Unit yang tersedia: ${bahanBaku.units.map((u: any) => u.name).join(', ')}`)
                errorCount++
                continue
              }

              items.push({
                bahanBakuId: bahanBaku.id,
                quantity: qty,
                unitName: validUnit.name,
                notes: undefined // No longer needed, set to undefined
              })
            }
          }

          if (items.length === 0) {
            errors.push(`Baris ${rowNum}: Minimal 1 bahan harus diisi`)
            errorCount++
            continue
          }

          // Create recipe via API
          try {
            const resp = await fetch('/api/recipes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ barangJadiId: barangJadi.id, items })
            })
            const data = await resp.json().catch(()=>({}))
            if (!resp.ok || data?.error) {
              errors.push(`Baris ${rowNum}: ${data?.error || 'Gagal menyimpan resep'}`)
              errorCount++
            } else {
              successCount++
              existingByBarang.add(Number(barangJadi.id))
            }
          } catch (e:any) {
            errors.push(`Baris ${rowNum}: ${e?.message || 'Gagal menyimpan resep'}`)
            errorCount++
          }

        } catch (err) {
          errors.push(`Baris ${rowNum}: ${err instanceof Error ? err.message : 'Error tidak dikenal'}`)
          errorCount++
        }
      }

      // Show results
      let message = `Import selesai!\n\n`
      message += `✅ Berhasil: ${successCount} resep\n`
      if (errorCount > 0) {
        message += `❌ Gagal: ${errorCount} resep\n\n`
        message += `Error:\n${errors.slice(0, 10).join('\n')}`
        if (errors.length > 10) {
          message += `\n... dan ${errors.length - 10} error lainnya`
        }
      }
      
      alert(message)
      
      if (successCount > 0) {
        onDone()
      }

    } catch (error) {
      console.error('Import error:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Terjadi kesalahan'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-10">
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <span className="text-sm">Mengimport data...</span>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-4">Import Ingredient Excel</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              File Excel
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              disabled={loading}
            />
          </div>

          <div className="bg-slate-50 p-3 rounded text-sm">
            <p className="font-medium mb-2">Format Excel:</p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>• Kode Barang Jadi (wajib)</li>
              <li>• Porsi (angka, default: 1)</li>
              <li>• Kode Bahan 1-10 (sesuai kebutuhan)</li>
              <li>• Qty Bahan 1-10 (gunakan koma untuk desimal)</li>
              <li>• Unit Bahan 1-10 (sesuai unit yang ada di master)</li>
              <li>• Aktif (Ya/Tidak, default: Ya)</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={downloadTemplate}
              className="flex-1 bg-slate-600 hover:bg-slate-700"
              disabled={loading}
            >
              Download Template
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1"
            >
              {loading ? 'Importing...' : 'Import'}
            </Button>
            <Button
              onClick={onDone}
              className="flex-1 bg-slate-600 hover:bg-slate-700"
              disabled={loading}
            >
              Batal
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
