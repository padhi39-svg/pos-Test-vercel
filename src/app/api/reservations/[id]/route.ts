import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId, applyUpdateAudit, applyUpdateAuditWhere } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

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
  try {
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'reservations'"
    )
    const hasUpdatedAt = cols.some(c => c.column_name.toLowerCase() === 'updated_at')
    if (!hasUpdatedAt) {
      await rawRun('ALTER TABLE reservations ADD COLUMN updated_at TIMESTAMP')
      await rawRun('UPDATE reservations SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)')
    }
  } catch {}
  try {
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'reservations'"
    )
    const hasPic = cols.some(c => c.column_name.toLowerCase() === 'pic')
    const hasCompany = cols.some(c => c.column_name.toLowerCase() === 'company')
    const hasTransferName = cols.some(c => c.column_name.toLowerCase() === 'transfer_name')
    if (!hasPic) await rawRun('ALTER TABLE reservations ADD COLUMN pic TEXT')
    if (!hasCompany) await rawRun('ALTER TABLE reservations ADD COLUMN company TEXT')
    if (!hasTransferName) await rawRun('ALTER TABLE reservations ADD COLUMN transfer_name TEXT')
  } catch {}
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd <= bStart || aStart >= bEnd)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req, 'reservasi_booking', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat reservasi' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    await ensureTables()
    const header = await rawGet<any>('SELECT * FROM reservations WHERE id=$1', [id])
    if (!header) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
    const tables = await rawAll<any>(
      `SELECT m.* FROM reservation_tables rt
       JOIN master_meja m ON m.id = rt.table_id
       WHERE rt.reservation_id = $1`,
      [id]
    )
    return NextResponse.json({ ...header, tables })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req, 'reservasi_booking', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah reservasi' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json().catch(()=>({})) as any
    const date = body.date != null ? String(body.date).slice(0,10) : undefined
    const start_time = body.start_time != null ? String(body.start_time) : undefined
    const end_time = body.end_time != null ? String(body.end_time) : undefined
    const pax = body.pax != null ? Number(body.pax) : undefined
    const customer_name = body.customer_name !== undefined ? (body.customer_name ? String(body.customer_name).trim() : null) : undefined
    const pic = body.pic !== undefined ? (body.pic ? String(body.pic).trim() : null) : undefined
    const company = body.company !== undefined ? (body.company ? String(body.company).trim() : null) : undefined
    const phone = body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : undefined
    const notes = body.notes !== undefined ? (body.notes != null ? String(body.notes) : null) : undefined
    const transfer_name = body.transfer_name !== undefined ? (body.transfer_name ? String(body.transfer_name).trim() : null) : undefined
    const dp_amount = body.dp_amount !== undefined ? (body.dp_amount !== '' && body.dp_amount != null ? Number(body.dp_amount) : null) : undefined
    const dp_paid = body.dp_paid !== undefined ? (body.dp_paid ? 1 : 0) : undefined
    const table_ids: number[] | undefined = Array.isArray(body.table_ids) ? body.table_ids.map((x:any)=>Number(x)).filter(Boolean) : undefined

    const db = getDb()
    const pool = (db as any).$client
    await ensureTables()

    const exists = await rawGet<any>('SELECT * FROM reservations WHERE id=$1', [id])
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    const nextDate = date !== undefined ? date : exists.date
    const nextStart = start_time !== undefined ? start_time : exists.start_time
    const nextEnd = end_time !== undefined ? end_time : exists.end_time
    const nextPax = pax !== undefined ? pax : exists.pax

    const nextTableIds = table_ids !== undefined
      ? table_ids
      : (await rawAll<any>('SELECT table_id FROM reservation_tables WHERE reservation_id=$1', [id])).map(r=> Number(r.table_id))

    if (!nextDate || !nextStart || !nextEnd || !nextTableIds.length) {
      return NextResponse.json({ error: 'Tanggal, waktu, dan meja wajib' }, { status: 400 })
    }
    if (nextStart >= nextEnd) return NextResponse.json({ error: 'Rentang waktu tidak valid' }, { status: 400 })

    const placeholders = nextTableIds.map((_, i) => `$${i + 3}`).join(',')
    const existing = await rawAll<any>(
      `SELECT r.*, rt.table_id
       FROM reservations r
       JOIN reservation_tables rt ON rt.reservation_id = r.id
       WHERE r.date = $1
         AND r.id <> $2
         AND r.status NOT IN ('canceled','completed','no_show')
         AND rt.table_id IN (${placeholders})`,
      [nextDate, id, ...nextTableIds]
    )

    const hasConflict = existing.some(r => overlaps(nextStart, nextEnd, String(r.start_time), String(r.end_time)))
    if (hasConflict) return NextResponse.json({ error: 'Jadwal bertabrakan dengan reservasi lain di meja terpilih' }, { status: 400 })

    await pool.query('BEGIN')
    try {
      const setClauses: string[] = []
      const params: any[] = []
      let paramIdx = 1
      if (date !== undefined) { setClauses.push(`date=$${paramIdx++}`); params.push(date) }
      if (start_time !== undefined) { setClauses.push(`start_time=$${paramIdx++}`); params.push(start_time) }
      if (end_time !== undefined) { setClauses.push(`end_time=$${paramIdx++}`); params.push(end_time) }
      if (pax !== undefined) { setClauses.push(`pax=$${paramIdx++}`); params.push(pax) }
      if (customer_name !== undefined) { setClauses.push(`customer_name=$${paramIdx++}`); params.push(customer_name) }
      if (pic !== undefined) { setClauses.push(`pic=$${paramIdx++}`); params.push(pic) }
      if (company !== undefined) { setClauses.push(`company=$${paramIdx++}`); params.push(company) }
      if (phone !== undefined) { setClauses.push(`phone=$${paramIdx++}`); params.push(phone) }
      if (notes !== undefined) { setClauses.push(`notes=$${paramIdx++}`); params.push(notes) }
      if (transfer_name !== undefined) { setClauses.push(`transfer_name=$${paramIdx++}`); params.push(transfer_name) }
      if (dp_amount !== undefined) { setClauses.push(`dp_amount=$${paramIdx++}`); params.push(dp_amount) }
      if (dp_paid !== undefined) { setClauses.push(`dp_paid=$${paramIdx++}`); params.push(dp_paid) }
      if (setClauses.length) {
        params.push(id)
        await pool.query(`UPDATE reservations SET ${setClauses.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${paramIdx}`, params)
      }

      if (table_ids !== undefined) {
        await pool.query('DELETE FROM reservation_tables WHERE reservation_id=$1', [id])
        for (const tid of table_ids) {
          await pool.query('INSERT INTO reservation_tables(reservation_id, table_id) VALUES($1,$2)', [id, tid])
        }
      }

      const updated = await rawGet<any>('SELECT * FROM reservations WHERE id=$1', [id])
      await pool.query('COMMIT')

      const userId = getUserId(req)
      try {
        applyUpdateAudit(db as any, 'reservations', id, userId)
        if (Array.isArray(table_ids)) {
          applyUpdateAuditWhere(db as any, 'reservation_tables', 'reservation_id = ?', [id], userId)
        }
      } catch {}
      return NextResponse.json(updated)
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah reservasi' }, { status: 500 })
  }
}
