import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'keu_perkiraan', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses import perkiraan' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[]

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }

    const db = getDb(); const pool = (db as any).$client
    const errors: string[] = []
    const results: { row: number; kode: string; nama: string; status: string }[] = []

    const headers = Object.keys(rawData[0])
    const colMap: Record<string, string> = {}
    for (const h of headers) {
      const hl = h.toLowerCase().trim()
      if (hl.includes('kode')) colMap.kode = h
      else if (hl.includes('nama')) colMap.nama = h
      else if (hl.includes('parent')) colMap.parent = h
      else if (hl.includes('normal') || hl.includes('balance') || hl.includes('saldo')) colMap.balance = h
      else if (hl.includes('tipe') || hl.includes('jenis') || hl.includes('type')) colMap.tipe = h
      else if (hl.includes('golongan') || hl.includes('gol')) colMap.golongan = h
      else if (hl === 'kas') colMap.kas = h
      else if (hl === 'bank') colMap.bank = h
    }

    if (!colMap.kode || !colMap.nama || !colMap.balance || !colMap.tipe) {
      return NextResponse.json({
        error: 'Format kolom tidak sesuai. Minimal harus ada: Kode, Nama, Normal Balance, Tipe',
        detected: colMap,
      }, { status: 400 })
    }

    const validRows: {
      row: number
      kode: string
      nama: string
      parentCode: string | null
      balance: string
      isHeader: boolean
      golongan: string | null
      isCash: boolean
      isBank: boolean
    }[] = []

    for (let i = 0; i < rawData.length; i++) {
      const r = rawData[i]
      const rowNum = i + 2

      const kode = String(r[colMap.kode] || '').trim()
      const nama = String(r[colMap.nama] || '').trim()
      const parentCode = String(r[colMap.parent] || '').trim() || null
      const balanceRaw = String(r[colMap.balance] || '').trim().toUpperCase()
      const tipeRaw = String(r[colMap.tipe] || '').trim().toLowerCase()
      const golonganRaw = colMap.golongan ? String(r[colMap.golongan] || '').trim() || null : null
      const kasRaw = String(r[colMap.kas] || '').trim().toLowerCase()
      const bankRaw = String(r[colMap.bank] || '').trim().toLowerCase()

      if (!kode) { errors.push(`Baris ${rowNum}: Kode kosong`); continue }
      if (!nama) { errors.push(`Baris ${rowNum} (${kode}): Nama kosong`); continue }
      if (!['D', 'C'].includes(balanceRaw)) { errors.push(`Baris ${rowNum} (${kode}): Normal Balance harus D atau C`); continue }
      if (!['header', 'detail'].includes(tipeRaw)) { errors.push(`Baris ${rowNum} (${kode}): Tipe harus header atau detail`); continue }

      const isHeader = tipeRaw === 'header'
      const isCash = kasRaw === 'ya' || kasRaw === 'yes' || kasRaw === '1' || kasRaw === 'true'
      const isBank = bankRaw === 'ya' || bankRaw === 'yes' || bankRaw === '1' || bankRaw === 'true'

      if (parentCode) {
        const parentExists = await rawGet('SELECT 1 FROM accounts WHERE code = ?', [parentCode])
        if (!parentExists) {
          const parentInImport = rawData.some((x: any) => String(x[colMap.kode] || '').trim() === parentCode)
          if (!parentInImport) {
            errors.push(`Baris ${rowNum} (${kode}): Parent code "${parentCode}" tidak ditemukan di database atau file`)
            continue
          }
        }
      }

      validRows.push({ row: rowNum, kode, nama, parentCode, balance: balanceRaw, isHeader, golongan: golonganRaw, isCash, isBank })
    }

    if (errors.length > 0 && validRows.length === 0) {
      return NextResponse.json({ success: false, total: rawData.length, imported: 0, errors, results: [] }, { status: 400 })
    }

    const hasTransactions = (() => {
      try {
        const count = rawGet(`
          SELECT COUNT(*) as c FROM (
            SELECT 1 FROM journal_entries LIMIT 1
            UNION ALL
            SELECT 1 FROM transactions LIMIT 1
            UNION ALL
            SELECT 1 FROM memorial_journal_details LIMIT 1
            UNION ALL
            SELECT 1 FROM purchases LIMIT 1
            UNION ALL
            SELECT 1 FROM gl_journal_lines LIMIT 1
          ) x
        `) as any
        return Number(count?.c) > 0
      } catch { return true }
    })()

    if (!(await hasTransactions)) {
      await rawRun('DELETE FROM accounts')
    }

    await pool.query('BEGIN')
    try {
      for (const v of validRows) {
        try {
          let parentId: number | null = null
          let level = 1
          if (v.parentCode) {
            const parent = await rawGet('SELECT id, level FROM accounts WHERE code = ?', [v.parentCode]) as any
            if (parent) {
              parentId = parent.id
              level = Number(parent.level) + 1
              if (level > 4) { errors.push(`Baris ${v.row} (${v.kode}): Level maksimal 4`); continue }
            } else {
              const parent2 = await rawGet('SELECT id, level FROM accounts WHERE code = ?', [v.parentCode]) as any
              if (parent2) {
                parentId = parent2.id
                level = Number(parent2.level) + 1
              }
            }
          }

          const postingAllowed = v.isHeader ? 0 : 1

          const existing = await rawGet('SELECT id, parent_id FROM accounts WHERE code = ?', [v.kode]) as any

          if (existing) {
            await rawRun(`
              UPDATE accounts SET name = ?, parent_id = ?, level = ?, is_header = ?,
                normal_balance = ?, golongan = ?, is_cash = ?, is_bank_account = ?,
                posting_allowed = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [v.nama, parentId, level, v.isHeader ? 1 : 0, v.balance,
              v.golongan, v.isCash ? 1 : 0, v.isBank ? 1 : 0, postingAllowed, existing.id])
          } else {
            await pool.query(`
              INSERT INTO accounts (code, name, parent_id, level, is_header, normal_balance,
                golongan, is_active, is_cash, is_bank_account, posting_allowed, currency, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, 'IDR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [v.kode, v.nama, parentId, level, v.isHeader ? 1 : 0, v.balance,
              v.golongan, v.isCash ? 1 : 0, v.isBank ? 1 : 0, postingAllowed])
          }

          if (parentId) {
            await rawRun('UPDATE accounts SET is_header = 1, posting_allowed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_header = 0', [parentId])
          }

          results.push({ row: v.row, kode: v.kode, nama: v.nama, status: existing ? 'updated' : 'created' })
        } catch (err: any) {
          errors.push(`Baris ${v.row} (${v.kode}): ${err.message}`)
        }
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({
      success: true,
      total: rawData.length,
      imported: results.length,
      failed: errors.length,
      errors,
      results,
    })
  } catch (e: any) {
    console.error('POST /api/accounts/import error:', e)
    return NextResponse.json({ error: 'Gagal import data', details: e?.message }, { status: 500 })
  }
}
