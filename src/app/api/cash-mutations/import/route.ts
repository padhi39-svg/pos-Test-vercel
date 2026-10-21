import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { getPeriodByDate } from '@/lib/period'

async function ensureTables() {
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`CREATE TABLE IF NOT EXISTS cash_mutations (
    id SERIAL PRIMARY KEY,
    mutation_number TEXT NOT NULL,
    mutation_date TEXT NOT NULL,
    cash_account_id INTEGER NOT NULL,
    cash_account_code TEXT NOT NULL,
    mutation_type TEXT NOT NULL CHECK (mutation_type IN ('MASUK','KELUAR')),
    notes TEXT DEFAULT '',
    total_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_create INTEGER,
    user_update INTEGER,
    CONSTRAINT uq_cash_mutations_number UNIQUE (mutation_number)
  )`)
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cm_date ON cash_mutations (mutation_date)') } catch {}
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cm_cash_acc ON cash_mutations (cash_account_id)') } catch {}
  await pool.query(`CREATE TABLE IF NOT EXISTS cash_mutation_details (
    id SERIAL PRIMARY KEY,
    cash_mutation_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    account_code TEXT NOT NULL,
    notes TEXT DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cash_mutation_id) REFERENCES cash_mutations(id) ON DELETE CASCADE
  )`)
  try { await rawRun('CREATE INDEX IF NOT EXISTS idx_cmd_hdr ON cash_mutation_details (cash_mutation_id)') } catch {}
}

async function nextNumber(): Promise<string> {
  const today = new Date()
  const year = String(today.getFullYear())
  const rows = await rawAll('SELECT mutation_number FROM cash_mutations WHERE mutation_number LIKE ?', [`MT/${year}/%`]) as { mutation_number: string }[]
  let max = 0
  for (const r of rows) {
    const m = /^MT\/(\d{4})\/(\d+)$/.exec(r.mutation_number || '')
    if (m) {
      const n = Number(m[2])
      if (!Number.isNaN(n) && n > max) max = n
    }
  }
  const next = (max + 1).toString().padStart(6, '0')
  return `MT/${year}/${next}`
}

function parseExcelDate(value: any): string | null {
  if (!value) return null
  if (typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + value * 86400000)
    return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const cleaned = value.trim()
    const dm = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dm) {
      const d = parseInt(dm[1], 10)
      const m = parseInt(dm[2], 10)
      const y = parseInt(dm[3], 10)
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return cleaned
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    await ensureTables()
    const db = getDb(); const pool = (db as any).$client
    const body = await request.json()
    const rows = Array.isArray(body.data) ? body.data : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diimport' }, { status: 400 })
    }

    const userId = getUserId(request)
    const errors: string[] = []
    const successRows: string[] = []
    let imported = 0

    const groups: { key: string; items: any[] }[] = []
    let autoKeyCounter = 0
    for (const row of rows) {
      const mutationKey = String(row['No Mutasi'] || '').trim() || `__auto_${++autoKeyCounter}`
      const existing = groups.find(g => g.key === mutationKey)
      if (existing) {
        existing.items.push(row)
      } else {
        groups.push({ key: mutationKey, items: [row] })
      }
    }

    await pool.query('BEGIN')
    try {
      for (const group of groups) {
        const items = group.items
        const firstRow = items[0]
        const rowNumBase = rows.indexOf(firstRow) + 2

        try {
          const tanggal = parseExcelDate(firstRow['Tanggal'] || firstRow['tanggal'] || firstRow['DATE'])
          if (!tanggal) {
            errors.push(`Baris ${rowNumBase}: Tanggal tidak valid`)
            continue
          }

          const cashAccountCode = String(firstRow['Kode Kas/Bank'] || firstRow['Kode Kas'] || firstRow['kode_kas_bank'] || '').trim()
          if (!cashAccountCode) {
            errors.push(`Baris ${rowNumBase}: Kode Kas/Bank kosong`)
            continue
          }

          const mutationTypeRaw = String(firstRow['Jenis'] || firstRow['jenis'] || firstRow['TYPE'] || '').trim().toUpperCase()
          const mutationType = mutationTypeRaw === 'KELUAR' ? 'KELUAR' : 'MASUK'

          const account = await rawGet(
            'SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE code = ? AND is_active = 1 AND posting_allowed = 1',
            [cashAccountCode]
          ) as any
          if (!account) {
            errors.push(`Baris ${rowNumBase}: Kode Kas/Bank "${cashAccountCode}" tidak ditemukan di database`)
            continue
          }
          if (!account.is_cash && !account.is_bank_account) {
            errors.push(`Baris ${rowNumBase}: Akun "${cashAccountCode}" bukan akun kas/bank`)
            continue
          }

          const period = await getPeriodByDate(tanggal)
          if (!period) {
            errors.push(`Baris ${rowNumBase}: Tidak ada periode aktif untuk tanggal ${tanggal}`)
            continue
          }
          if (Number(period.is_closed) === 1) {
            errors.push(`Baris ${rowNumBase}: Periode "${period.name}" sudah ditutup`)
            continue
          }

          const detail: { account_id: number; account_code: string; notes: string; amount: number }[] = []
          let detailError = false

          for (let i = 0; i < items.length; i++) {
            const row = items[i]
            const actualRowNum = rows.indexOf(row) + 2
            const akunKode = String(row['Kode Akun'] || row['kode_akun'] || row['AKUN'] || '').trim()
            const amount = parseFloat(String(row['Jumlah'] || row['jumlah'] || row['AMOUNT'] || '0').replace(/,/g, ''))
            const notes = String(row['Keterangan'] || row['keterangan'] || row['NOTES'] || '').trim()

            if (!akunKode) {
              errors.push(`Baris ${actualRowNum}: Kode Akun kosong`)
              detailError = true
              continue
            }

            const akun = await rawGet(
              'SELECT id, code, name FROM accounts WHERE code = ? AND is_active = 1 AND posting_allowed = 1',
              [akunKode]
            ) as any
            if (!akun) {
              errors.push(`Baris ${actualRowNum}: Kode Akun "${akunKode}" tidak ditemukan di database`)
              detailError = true
              continue
            }

            if (isNaN(amount) || amount <= 0) {
              errors.push(`Baris ${actualRowNum}: Jumlah tidak valid (${row['Jumlah'] || row['jumlah']})`)
              detailError = true
              continue
            }

            detail.push({ account_id: akun.id, account_code: akun.code, notes, amount })
          }

          if (detailError || detail.length === 0) {
            if (detail.length === 0 && !detailError) {
              errors.push(`Baris ${rowNumBase}: Tidak ada detail yang valid`)
            }
            continue
          }

          const totalAmount = detail.reduce((sum, d) => sum + d.amount, 0)

          const mutationNumber = await nextNumber()

          const createdAt = tanggal + ' 00:00:00'
          const hdrResult = await pool.query(`
            INSERT INTO cash_mutations (mutation_number, mutation_date, cash_account_id, cash_account_code, mutation_type, notes, total_amount, status, created_at, updated_at, user_create)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8, $9)
            RETURNING id
          `, [mutationNumber, tanggal, account.id, account.code, mutationType, '', totalAmount, createdAt, userId])
          const mutationId = Number(hdrResult.rows[0].id)

          for (let i = 0; i < detail.length; i++) {
            await rawRun(`
              INSERT INTO cash_mutation_details (cash_mutation_id, line_no, account_id, account_code, notes, amount, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [mutationId, i + 1, detail[i].account_id, detail[i].account_code, detail[i].notes, detail[i].amount, createdAt, createdAt])
          }

          successRows.push(`Baris ${rowNumBase}: ${mutationNumber} - ${tanggal} - ${account.code} - ${mutationType} - Rp ${totalAmount.toLocaleString()} (${detail.length} item)`)
          imported++
        } catch (err: any) {
          errors.push(`Baris ${rowNumBase}: ${err.message}`)
        }
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({
      success: true,
      imported,
      total: groups.length,
      failed: errors.length,
      errors,
      successMessages: successRows,
    })
  } catch (error: any) {
    console.error('Error importing cash mutations:', error)
    return NextResponse.json({ error: 'Gagal import data: ' + error.message }, { status: 500 })
  }
}
