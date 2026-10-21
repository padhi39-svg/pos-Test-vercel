import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getAllowBackdate } from '@/lib/settingsHelper'
import { getUserId } from '@/lib/audit'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

const pool = (getDb() as any).$client

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ar_advances (
      id SERIAL PRIMARY KEY,
      kode_nota TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      total_amount REAL NOT NULL DEFAULT 0,
      period_id INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_ar_adv_number UNIQUE (kode_nota)
    )
  `)
  await rawRun('CREATE INDEX IF NOT EXISTS idx_ar_adv_tanggal ON ar_advances(tanggal)').catch(()=>{})
  await rawRun('CREATE INDEX IF NOT EXISTS idx_ar_adv_customer ON ar_advances(customer_id)').catch(()=>{})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ar_advance_lines (
      id SERIAL PRIMARY KEY,
      ar_advance_id INTEGER NOT NULL,
      line_no INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      notes TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ar_advance_id) REFERENCES ar_advances(id) ON DELETE CASCADE
    )
  `)
}

async function nextNumber(dateStr: string): Promise<string> {
  const year = String(dateStr).slice(0,4)
  const rows = await rawAll<any>('SELECT kode_nota FROM ar_advances WHERE kode_nota LIKE $1', [`UC/${year}/%`])
  let max = 0
  for (const r of rows) {
    const m = /^UC\/(\d{4})\/(\d+)$/.exec(r.kode_nota || '')
    if (m) { const n = Number(m[2]); if (!Number.isNaN(n) && n > max) max = n }
  }
  return `UC/${year}/${(max + 1).toString().padStart(6, '0')}`
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables()
    const url = new URL(req.url)
    const q = (url.searchParams.get('q')||'').trim().toLowerCase()
    const start = url.searchParams.get('startDate')
    const end = url.searchParams.get('endDate')
    let where = '1=1'
    const params: any[] = []
    let pidx = 0
    if (q) { pidx++; where += ` AND (lower(kode_nota) LIKE $${pidx})`; params.push(`%${q}%`) }
    if (start) { pidx++; where += ` AND tanggal >= $${pidx}`; params.push(start) }
    if (end) { pidx++; where += ` AND tanggal <= $${pidx}`; params.push(end) }
    const rows = (await rawAll<any>(`SELECT ar.*, c.code as customer_code, c.name as customer_name FROM ar_advances ar LEFT JOIN master_customer c ON c.id = ar.customer_id WHERE ${where} ORDER BY tanggal DESC, id DESC LIMIT 200`, params)).map(r => ({ ...r, void: r.status === 'void' ? 1 : 0 }))
    return NextResponse.json(rows)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message||'Failed to fetch AR advances' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables()
    const body = await req.json().catch(()=>({}))
    const today = new Date().toISOString().slice(0, 10)
    const canBackdate = await getAllowBackdate(pool) || hasPermission(req as any, 'keu_uang_muka_customer', 'backdate')
    const tanggal = ((canBackdate ? (body?.tanggal || today) : today) || today).toString().slice(0, 10)
    const customer_id = Number(body?.customer_id || body?.partnerId || 0)
    const notes = String(body?.notes || body?.catatan || '')
    const detail = Array.isArray(body?.detail) ? body.detail : []
    if (!tanggal || !customer_id || detail.length === 0) {
      return NextResponse.json({ error: 'Payload tidak lengkap' }, { status: 400 })
    }
    const total_amount = detail.reduce((a:number,b:any)=> a + (Number(b.amount)||Number(b.nominal)||0), 0)
    const number = await nextNumber(tanggal)
    const userId = getUserId(req)

    let id: number
    await pool.query('BEGIN')
    try {
      const res = await pool.query(`
        INSERT INTO ar_advances (kode_nota, tanggal, customer_id, notes, total_amount, period_id, status, user_create, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 1, 'active', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [number, tanggal, customer_id, notes, total_amount, userId])
      id = Number(res.rows[0].id)

      for (let idx = 0; idx < detail.length; idx++) {
        const d = detail[idx]
        const amt = Number(d.amount || d.nominal || 0)
        await rawRun(`
          INSERT INTO ar_advance_lines (ar_advance_id, advance_id, line_no, account_id, account_code, amount, notes, created_at, updated_at)
          VALUES ($1, $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, idx + 1, Number(d.account_id||0), String(d.account_code||''), amt, String(d.notes||'')])
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    // Save journal entries for AR advance
    try {
      const advEntries = await generateEntriesForSingleSource('Uang Muka Customer', String(number), tanggal)
      if (advEntries.length > 0) {
        await saveJournalEntriesForSource('Uang Muka Customer', id, String(number), tanggal, advEntries)
      }
    } catch (e) {
      console.warn('[AR Advance] failed to save journal entries:', e)
    }
    return NextResponse.json({ id, kode_nota: number })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message||'Failed to create AR advance' }, { status: 500 })
  }
}
