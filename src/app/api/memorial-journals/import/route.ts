import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

const pool = (getDb() as any).$client

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memorial_journals (
      id SERIAL PRIMARY KEY,
      journal_number TEXT NOT NULL,
      journal_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      total_debit REAL NOT NULL DEFAULT 0,
      total_credit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_update INTEGER,
      CONSTRAINT uq_memorial_journals_number UNIQUE (journal_number)
    )
  `)
  await rawRun('CREATE INDEX IF NOT EXISTS idx_mj_date ON memorial_journals (journal_date)').catch(()=>{})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memorial_journal_details (
      id SERIAL PRIMARY KEY,
      memorial_journal_id INTEGER NOT NULL,
      line_no INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      notes TEXT DEFAULT '',
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (memorial_journal_id) REFERENCES memorial_journals(id) ON DELETE CASCADE
    )
  `)
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
    return cleaned
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    await ensureTables()
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
      const journalKey = String(row['No Jurnal'] || '').trim() || `__auto_${++autoKeyCounter}`
      const existing = groups.find(g => g.key === journalKey)
      if (existing) {
        existing.items.push(row)
      } else {
        groups.push({ key: journalKey, items: [row] })
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

          const period = await getPeriodByDate(tanggal)
          if (!period) {
            errors.push(`Baris ${rowNumBase}: Tidak ada periode aktif untuk tanggal ${tanggal}`)
            continue
          }
          if (Number(period.is_closed) === 1) {
            errors.push(`Baris ${rowNumBase}: Periode "${period.name}" sudah ditutup`)
            continue
          }

          const detail: { account_id: number; account_code: string; description: string; debit: number; credit: number }[] = []
          let detailError = false

          for (let i = 0; i < items.length; i++) {
            const row = items[i]
            const actualRowNum = rows.indexOf(row) + 2
            const akunKode = String(row['Kode Akun'] || row['kode_akun'] || row['AKUN'] || '').trim()
            const debit = parseFloat(String(row['Debit'] || row['debit'] || '0').replace(/,/g, ''))
            const credit = parseFloat(String(row['Kredit'] || row['kredit'] || '0').replace(/,/g, ''))
            const notes = String(row['Keterangan'] || row['keterangan'] || row['NOTES'] || '').trim()

            if (!akunKode) {
              errors.push(`Baris ${actualRowNum}: Kode Akun kosong`)
              detailError = true
              continue
            }

            const akun = await rawGet<any>('SELECT id, code, name FROM accounts WHERE code = $1 AND is_active = 1 AND posting_allowed = 1', [akunKode])
            if (!akun) {
              errors.push(`Baris ${actualRowNum}: Kode Akun "${akunKode}" tidak ditemukan di database`)
              detailError = true
              continue
            }

            const hasDebit = debit > 0
            const hasCredit = credit > 0
            if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
              errors.push(`Baris ${actualRowNum}: Set salah satu Debit atau Kredit (isi salah satu, bukan keduanya)`)
              detailError = true
              continue
            }

            detail.push({ account_id: akun.id, account_code: akun.code, description: notes, debit: hasDebit ? debit : 0, credit: hasCredit ? credit : 0 })
          }

          if (detailError || detail.length === 0) {
            if (detail.length === 0 && !detailError) {
              errors.push(`Baris ${rowNumBase}: Tidak ada detail yang valid`)
            }
            continue
          }

          const total_debit = detail.reduce((a, d) => a + d.debit, 0)
          const total_credit = detail.reduce((a, d) => a + d.credit, 0)

          if (Math.abs(total_debit - total_credit) > 0.0001) {
            errors.push(`Baris ${rowNumBase}: Total debit (${total_debit}) dan kredit (${total_credit}) tidak balance`)
            continue
          }

          const lastRow = await rawGet<any>(`SELECT journal_number FROM memorial_journals WHERE journal_number LIKE $1 ORDER BY id DESC LIMIT 1`, [`JM/${new Date().getFullYear()}/%`])
          let maxSeq = 0
          if (lastRow) {
            const m = /^JM\/(\d{4})\/(\d+)$/.exec(lastRow.journal_number || '')
            if (m) maxSeq = Number(m[2]) || 0
          }
          const journalNumber = `JM/${new Date().getFullYear()}/${(maxSeq + 1).toString().padStart(6, '0')}`

          const notesVal = String(firstRow['Keterangan'] || firstRow['keterangan'] || firstRow['NOTES'] || '').trim() || `Import jurnal memorial ${tanggal}`
          const createdAt = tanggal + ' 00:00:00'

          const hdrResult = await pool.query(`
            INSERT INTO memorial_journals (
              journal_number, journal_date, notes, total_debit, total_credit, status, created_at, updated_at, user_create
            ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8)
            RETURNING id
          `, [journalNumber, tanggal, notesVal, total_debit, total_credit, createdAt, createdAt, userId])
          const journalId = Number(hdrResult.rows[0].id)

          for (let i = 0; i < detail.length; i++) {
            await rawRun(`
              INSERT INTO memorial_journal_details (
                memorial_journal_id, line_no, account_id, account_code, notes, debit, credit, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [journalId, i + 1, detail[i].account_id, detail[i].account_code, detail[i].description, detail[i].debit, detail[i].credit, createdAt, createdAt])
          }

          // Generate journal entries for imported memorial journal
          try {
            const mjEntries = await generateEntriesForSingleSource('Jurnal Memorial', String(journalNumber), tanggal)
            if (mjEntries.length > 0) {
              await saveJournalEntriesForSource('Jurnal Memorial', journalId, String(journalNumber), tanggal, mjEntries)
            }
          } catch (e) {
            console.warn('[Import Memorial Journal] failed to save journal entries:', e)
          }

          successRows.push(`Baris ${rowNumBase}: ${journalNumber} - ${tanggal} - Rp ${total_debit.toLocaleString()} (${detail.length} item)`)
          imported++
        } catch (err: any) {
          errors.push(`Baris ${rowNumBase}: ${err.message}`)
        }
      }
      await pool.query('COMMIT')
    } catch (e) {
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
    console.error('Error importing memorial journals:', error)
    return NextResponse.json({ error: 'Gagal import data: ' + error.message }, { status: 500 })
  }
}
