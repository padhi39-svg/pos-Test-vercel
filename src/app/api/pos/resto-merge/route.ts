import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { addAuditColumns, applyUpdateAudit, getUserId } from '@/lib/audit'

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
  try { await rawRun(`ALTER TABLE resto_temp_orders ADD COLUMN IF NOT EXISTS void INTEGER DEFAULT 0`) } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceTableId = Number(body?.sourceTableId || body?.source_table_id || 0) || 0
    const targetTableId = Number(body?.targetTableId || body?.target_table_id || 0) || 0
    if (!sourceTableId || !targetTableId || sourceTableId === targetTableId) {
      return NextResponse.json({ error: 'sourceTableId dan targetTableId wajib dan tidak boleh sama' }, { status: 400 })
    }

    const db = getDb(); const pool = (db as any).$client
    await ensureTempOrdersTable()
    addAuditColumns(db)
    const userId = getUserId(req)

    const getOpenByTable = async (tid: number) => rawGet(`
      SELECT * FROM resto_temp_orders
      WHERE table_id = ? AND (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0)
      ORDER BY id DESC
      LIMIT 1
    `, [tid]) as any

    const source = await getOpenByTable(sourceTableId)
    if (!source) {
      return NextResponse.json({ error: 'Order sumber tidak ditemukan atau sudah tidak aktif' }, { status: 404 })
    }
    const target = await getOpenByTable(targetTableId)

    await pool.query('BEGIN')
    try {
      if (target && target.id) {
        await rawRun('UPDATE resto_temp_order_items SET temp_order_id = ? WHERE temp_order_id = ?', [target.id, source.id])
        const newGuest = Math.max(0, Number(target.guest_count || 0)) + Math.max(0, Number(source.guest_count || 0))
        await rawRun(`
          UPDATE resto_temp_orders
          SET guest_count = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newGuest, target.id])
        await rawRun(`
          UPDATE resto_temp_orders
          SET status = 'canceled', void = 1, notes = COALESCE(notes,'') || ' [merged to ' || ? || ']', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [String(targetTableId), source.id])
        applyUpdateAudit(db, 'resto_temp_orders', target.id, userId)
        applyUpdateAudit(db, 'resto_temp_orders', source.id, userId)
      } else {
        await rawRun(`
          UPDATE resto_temp_orders
          SET table_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [targetTableId, source.id])
        applyUpdateAudit(db, 'resto_temp_orders', source.id, userId)
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    const targetAfter = await getOpenByTable(targetTableId)
    const sourceAfter = await getOpenByTable(sourceTableId)
    const targetItems = targetAfter ? (await rawGet(`SELECT COUNT(1) AS c FROM resto_temp_order_items WHERE temp_order_id = ?`, [targetAfter.id]) as any)?.c || 0 : 0

    return NextResponse.json({ success: true, targetTableId, targetTempId: targetAfter?.id || null, targetItems, sourceStillOpen: !!sourceAfter })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menggabungkan meja' }, { status: 500 })
  }
}
