import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { addAuditColumns, applyCreateAudit, applyUpdateAudit, getUserId } from '@/lib/audit'

async function ensureTempOrdersTable() {
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resto_temp_orders (
      id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      waiter_id INTEGER,
      waiter_name TEXT,
      guest_count INTEGER DEFAULT 1,
      void INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  try {
    await pool.query(`ALTER TABLE resto_temp_orders ADD COLUMN IF NOT EXISTS void INTEGER DEFAULT 0`)
  } catch (e) {
  }

  try {
    await pool.query(`ALTER TABLE resto_temp_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'walkin'`)
  } catch (e) {
  }

  try {
    await pool.query(`ALTER TABLE resto_temp_orders ADD COLUMN IF NOT EXISTS qr_token TEXT`)
  } catch (e) {
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resto_temp_order_items (
      id SERIAL PRIMARY KEY,
      temp_order_id INTEGER NOT NULL,
      barang_id INTEGER NOT NULL,
      barang_code TEXT NOT NULL,
      barang_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      modifier TEXT,
      kategori_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (temp_order_id) REFERENCES resto_temp_orders(id) ON DELETE CASCADE
    );
  `)
}

const TS_COLS = `id, table_id, customer_id, customer_name, waiter_id, waiter_name,
  guest_count, void, status, notes, source, qr_token,
  TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at,
  TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as updated_at`

async function notifyTempChanged() {
  try {
    const db = getDb()
    const pool = (db as any).$client
    await pool.query("SELECT pg_notify('resto_temp_changed', '')")
  } catch {}
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureTempOrdersTable()

    const url = new URL(req.url)
    const idParam = Number(url.searchParams.get('id') || '0') || 0
    const tableId = Number(url.searchParams.get('table_id') || '0') || 0

    if (idParam) {
      const row = await rawGet(`SELECT ${TS_COLS} FROM resto_temp_orders WHERE id = ?`, [idParam]) as any
      if (!row) return NextResponse.json(null)
      const items = await rawAll(`SELECT * FROM resto_temp_order_items WHERE temp_order_id = ? ORDER BY id ASC`, [row.id]) as any[]
      return NextResponse.json({ ...row, items })
    }

    if (!tableId) {
      const rows = await rawAll(`
        SELECT ${TS_COLS}
        FROM resto_temp_orders
        WHERE (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0)
        ORDER BY created_at DESC
      `) as any[]
      return NextResponse.json(rows)
    }

    const row = await rawGet(`
      SELECT ${TS_COLS}
      FROM resto_temp_orders
      WHERE table_id = ? AND (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0)
      ORDER BY id DESC
      LIMIT 1
    `, [tableId]) as any

    if (!row) {
      return NextResponse.json(null)
    }

    const items = await rawAll(`
      SELECT * FROM resto_temp_order_items
      WHERE temp_order_id = ?
      ORDER BY id ASC
    `, [row.id]) as any[]

    return NextResponse.json({ ...row, items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil temp order' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureTempOrdersTable()
    addAuditColumns(db)
    const userId = getUserId(req)

    const body = await req.json()
    const tableId = Number(body.tableId || body.table_id || 0) || 0
    if (!tableId) {
      return NextResponse.json({ error: 'tableId wajib diisi' }, { status: 400 })
    }

    const customerId = body.customerId ?? body.customer_id ?? null
    const customerName = body.customerName ?? body.customer_name ?? ''
    const waiterId = body.waiterId ?? body.waiter_id ?? null
    const waiterName = body.waiterName ?? body.waiter_name ?? ''
    const guestCount = Number(body.guestCount ?? body.guest_count ?? 1) || 1

    const existing = await rawGet(`
      SELECT * FROM resto_temp_orders
      WHERE table_id = ? AND (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0)
      ORDER BY id DESC
      LIMIT 1
    `, [tableId]) as any

    let id: number
    if (existing) {
      await rawRun(`
        UPDATE resto_temp_orders
        SET
          customer_id = COALESCE(?, customer_id),
          customer_name = COALESCE(NULLIF(?, ''), customer_name),
          waiter_id = COALESCE(?, waiter_id),
          waiter_name = COALESCE(NULLIF(?, ''), waiter_name),
          guest_count = COALESCE(?, guest_count),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [customerId, customerName, waiterId, waiterName, guestCount, existing.id])
      id = existing.id
      applyUpdateAudit(db, 'resto_temp_orders', id, userId)
    } else {
      const r = await pool.query(`
        INSERT INTO resto_temp_orders (table_id, customer_id, customer_name, waiter_id, waiter_name, guest_count, status, void)
        VALUES ($1, $2, $3, $4, $5, $6, 'open', 0)
        RETURNING id
      `, [tableId, customerId, customerName, waiterId, waiterName, guestCount])
      id = Number(r.rows[0].id)
      applyCreateAudit(db, 'resto_temp_orders', id, userId)
    }

    const items = Array.isArray((body as any).items) ? (body as any).items : []
    if (items.length > 0) {
      await rawRun('DELETE FROM resto_temp_order_items WHERE temp_order_id = ?', [id])

      for (const it of items) {
        const barangId = Number(it.barangId || it.barang_id || 0) || 0
        const code = String(it.code || it.barang_code || '')
        const name = String(it.name || it.barang_name || '')
        const qty = Number(it.quantity || 0) || 0
        const unitPrice = Number(it.unitPrice || it.unit_price || 0) || 0
        const totalPrice = Number(it.totalPrice || it.total_price || (qty * unitPrice)) || 0
        const modifier = it.modifier ?? null
        const kategoriId = it.kategoriId ?? it.kategori_id ?? null
        if (!barangId || !code || !name || qty <= 0) continue
        await rawRun(`
          INSERT INTO resto_temp_order_items (temp_order_id, barang_id, barang_code, barang_name, quantity, unit_price, total_price, modifier, kategori_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, barangId, code, name, qty, unitPrice, totalPrice, modifier, kategoriId])
      }
    }

    const row = await rawGet(`SELECT ${TS_COLS} FROM resto_temp_orders WHERE id = ?`, [id])
    await notifyTempChanged()
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan temp order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureTempOrdersTable()
    addAuditColumns(db)
    const userId = getUserId(req)

    const body = await req.json()
    const tempId = Number(body.id || body.tempId || body.temp_id || 0) || 0
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : null
    const newTableId = Number(body.newTableId || body.new_table_id || 0) || 0
    const reasonRaw = body.reason ?? body.alasan ?? null
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : null
    if (!tempId) {
      return NextResponse.json({ error: 'tempId wajib diisi' }, { status: 400 })
    }

    const existing = await rawGet(`SELECT * FROM resto_temp_orders WHERE id = ?`, [tempId]) as any
    if (!existing) {
      return NextResponse.json({ error: 'Temp order tidak ditemukan' }, { status: 404 })
    }

    if (newTableId) {
      const target = await rawGet(
        `SELECT * FROM resto_temp_orders WHERE table_id = ? AND (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0) AND id <> ? ORDER BY id DESC LIMIT 1`,
        [newTableId, tempId],
      ) as any
      if (target) {
        return NextResponse.json({ error: 'Meja tujuan sudah memiliki order aktif' }, { status: 400 })
      }
      await rawRun(`
        UPDATE resto_temp_orders
        SET table_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newTableId, tempId])
      applyUpdateAudit(db, 'resto_temp_orders', tempId, userId)
    } else if (status === 'bill') {
      await rawRun(`
        UPDATE resto_temp_orders
        SET status = 'bill', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [tempId])
      applyUpdateAudit(db, 'resto_temp_orders', tempId, userId)
    } else if (status || reason) {
      if (reason) {
        await rawRun(`
          UPDATE resto_temp_orders
          SET status = 'canceled', void = 1, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [reason, tempId])
      } else {
        await rawRun(`
          UPDATE resto_temp_orders
          SET status = 'canceled', void = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [tempId])
      }
      applyUpdateAudit(db, 'resto_temp_orders', tempId, userId)
    }

    const row = await rawGet(`SELECT ${TS_COLS} FROM resto_temp_orders WHERE id = ?`, [tempId])
    await notifyTempChanged()
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal membatalkan temp order' }, { status: 500 })
  }
}
