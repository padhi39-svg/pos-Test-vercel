import { NextRequest, NextResponse } from 'next/server'
import { getUserId, applyCreateAudit, applyCreateAuditWhere } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { findAllReservations } from '@/lib/repositories/reservationRepository'
import { getDb } from '@/db'
import { rawAll, rawRun, rawGet } from '@/db/raw'
import { reservationTables, masterMeja } from '@/db/schema'
import { inArray } from 'drizzle-orm'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      pic TEXT,
      company TEXT,
      phone TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      pax INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      dp_amount REAL,
      dp_paid INTEGER DEFAULT 0,
      notes TEXT,
      transfer_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_meja (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      floor_id INTEGER,
      zone TEXT,
      capacity INTEGER DEFAULT 2,
      is_active INTEGER DEFAULT 1,
      is_mergeable INTEGER DEFAULT 1,
      is_smoking INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await rawRun(`
    CREATE TABLE IF NOT EXISTS reservation_tables (
      id SERIAL PRIMARY KEY,
      reservation_id INTEGER NOT NULL,
      table_id INTEGER NOT NULL,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES master_meja(id) ON DELETE CASCADE
    );
  `)

  const cols = await rawAll<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'reservations'"
  )
  const has = (n: string) => cols.some(c => c.column_name.toLowerCase() === n.toLowerCase())
  if (!has('pic')) { try { await rawRun('ALTER TABLE reservations ADD COLUMN pic TEXT') } catch {} }
  if (!has('company')) { try { await rawRun('ALTER TABLE reservations ADD COLUMN company TEXT') } catch {} }
  if (!has('transfer_name')) { try { await rawRun('ALTER TABLE reservations ADD COLUMN transfer_name TEXT') } catch {} }
}

async function generateNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BK/${year}/`
  const last = await rawGet<{ number: string }>('SELECT number FROM reservations WHERE number LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`])
  let seq = 1
  if (last?.number) {
    const m = String(last.number).match(/(\d{6})$/)
    if (m) seq = Number(m[1]) + 1
  }
  return prefix + String(seq).padStart(6, '0')
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd <= bStart || aStart >= bEnd)
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req, 'reservasi_booking', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat reservasi' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || ''
    const status = searchParams.get('status') || ''
    const q = (searchParams.get('q') || '').toLowerCase()

    const reservations = await findAllReservations({ status: status || undefined, from: date || undefined, to: date || undefined })
    const ids = reservations.map(r => r.id)

    const db = getDb()
    const allRt = ids.length
      ? await db.select().from(reservationTables).where(inArray(reservationTables.reservationId, ids))
      : []
    const tableIdsByRes: Record<number, number[]> = {}
    for (const rt of allRt) {
      if (!tableIdsByRes[rt.reservationId]) tableIdsByRes[rt.reservationId] = []
      tableIdsByRes[rt.reservationId].push(rt.tableId)
    }

    const allTableIds = [...new Set(allRt.map(rt => rt.tableId))]
    const mejaMap: Record<number, string> = {}
    if (allTableIds.length) {
      const mejaList = await db.select({ id: masterMeja.id, code: masterMeja.code })
        .from(masterMeja)
        .where(inArray(masterMeja.id, allTableIds))
        
      for (const m of mejaList) mejaMap[m.id] = m.code
    }

    const rowsWithTables = reservations.map(r => {
      const tIds = tableIdsByRes[r.id] || []
      const tableCodes = tIds.map(id => mejaMap[id]).filter(Boolean).join(' , ')
      return { ...r, table_codes: tableCodes }
    })

    const filtered = q
      ? rowsWithTables.filter(r => `${r.number} ${r.customerName||''} ${r.phone||''} ${r.table_codes||''}`.toLowerCase().includes(q))
      : rowsWithTables

    return NextResponse.json({ rows: filtered })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil reservasi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req, 'reservasi_booking', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat reservasi' }, { status: 403 })
    }
    const body = await req.json().catch(()=>({})) as any
    const date = String(body.date || '').slice(0,10)
    const start_time = String(body.start_time || '')
    const end_time = String(body.end_time || '')
    const pax = Number(body.pax || 0)
    const customer_name = body.customer_name ? String(body.customer_name).trim() : null
    const pic = body.pic ? String(body.pic).trim() : null
    const company = body.company ? String(body.company).trim() : null
    const phone = body.phone ? String(body.phone).trim() : null
    const notes = body.notes != null ? String(body.notes) : null
    const transfer_name = body.transfer_name ? String(body.transfer_name).trim() : null
    const dp_amount = body.dp_amount != null && body.dp_amount !== '' ? Number(body.dp_amount) : null
    const dp_paid = body.dp_paid ? 1 : 0
    const table_ids: number[] = Array.isArray(body.table_ids) ? body.table_ids.map((x:any)=>Number(x)).filter(Boolean) : []

    if (!date) return NextResponse.json({ error: 'Tanggal wajib' }, { status: 400 })
    if (!start_time || !end_time) return NextResponse.json({ error: 'Waktu mulai & selesai wajib' }, { status: 400 })
    if (start_time >= end_time) return NextResponse.json({ error: 'Rentang waktu tidak valid' }, { status: 400 })
    if (!pax || pax <= 0) return NextResponse.json({ error: 'Jumlah tamu (pax) wajib' }, { status: 400 })
    if (!table_ids.length) return NextResponse.json({ error: 'Pilih meja minimal 1' }, { status: 400 })

    await ensureTables()

    const placeholders = table_ids.map((_, i) => `$${i + 2}`).join(',')
    const existing = await rawAll<any>(
      `SELECT r.*, rt.table_id
      FROM reservations r
      JOIN reservation_tables rt ON rt.reservation_id = r.id
      WHERE r.date = $1
        AND r.status NOT IN ('canceled','completed','no_show')
        AND rt.table_id IN (${placeholders})`,
      [date, ...table_ids]
    )

    const hasConflict = existing.some(r => overlaps(start_time, end_time, String(r.start_time), String(r.end_time)))
    if (hasConflict) return NextResponse.json({ error: 'Jadwal bertabrakan dengan reservasi lain di meja terpilih' }, { status: 400 })

    const number = await generateNumber()
    const pool = (getDb() as any).$client
    const client = await pool.connect()
    let result: any
    try {
      await client.query('BEGIN')
      const insResult = await client.query(
        `INSERT INTO reservations(number, customer_name, pic, company, phone, date, start_time, end_time, pax, status, dp_amount, dp_paid, notes, transfer_name)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [number, customer_name, pic, company, phone, date, start_time, end_time, pax, 'pending', dp_amount, dp_paid, notes, transfer_name]
      )
      const resId = Number(insResult.rows[0].id)

      for (const tid of table_ids) {
        await client.query('INSERT INTO reservation_tables(reservation_id, table_id) VALUES($1,$2)', [resId, tid])
      }

      const created = insResult.rows[0]
      result = { id: resId, number, reservation: created }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const userId = getUserId(req)
    try {
      if (result?.id) {
        await applyCreateAudit('reservations', Number(result.id), userId)
        await applyCreateAuditWhere('reservation_tables', 'reservation_id = ?', [Number(result.id)], userId)
      }
    } catch {}
    return NextResponse.json(result)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal membuat reservasi' }, { status: 500 })
  }
}
