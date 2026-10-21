import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureLockTable() {
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resto_table_locks (
      id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );
  `)
  try { await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_table_locks_table ON resto_table_locks(table_id)') } catch {}
}

const DEFAULT_TTL_SECONDS = 120

export async function POST(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureLockTable()

    const body = await req.json().catch(() => ({}))
    const tableId = Number(body?.tableId || body?.table_id || 0) || 0
    const deviceId = String(body?.deviceId || body?.device_id || '').trim()
    const userId = body?.userId ?? null
    const userName = String(body?.userName || body?.user_name || '').trim()
    const ttl = Math.max(30, Math.min(600, Number(body?.ttl || DEFAULT_TTL_SECONDS) || DEFAULT_TTL_SECONDS))

    if (!tableId || !deviceId) {
      return NextResponse.json({ error: 'tableId dan deviceId wajib' }, { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    const lock = await rawGet(`SELECT * FROM resto_table_locks WHERE table_id = ?`, [tableId]) as any

    const formatLock = (l: any) => ({
      table_id: l?.table_id,
      device_id: l?.device_id,
      user_id: l?.user_id ?? null,
      user_name: l?.user_name || '',
      locked_at: l?.locked_at,
      updated_at: l?.updated_at,
      expires_at: l?.expires_at,
    })

    if (lock) {
      const exp = Math.floor(new Date(lock.expires_at || 0).getTime() / 1000)
      if (exp <= now) {
        await rawRun('DELETE FROM resto_table_locks WHERE table_id = ?', [tableId])
      }
    }

    const current = await rawGet('SELECT * FROM resto_table_locks WHERE table_id = ?', [tableId]) as any
    const expiresAtIso = new Date((now + ttl) * 1000).toISOString()

    if (current) {
      if (String(current.device_id) !== deviceId) {
        return NextResponse.json({ ok: false, locked_by: formatLock(current) }, { status: 423 })
      }
      await rawRun(`
        UPDATE resto_table_locks
        SET updated_at = CURRENT_TIMESTAMP, expires_at = ?
        WHERE table_id = ?
      `, [expiresAtIso, tableId])
      const refreshed = await rawGet('SELECT * FROM resto_table_locks WHERE table_id = ?', [tableId]) as any
      return NextResponse.json({ ok: true, lock: formatLock(refreshed) })
    }

    await rawRun(`
      INSERT INTO resto_table_locks(table_id, device_id, user_id, user_name, locked_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `, [tableId, deviceId, userId, userName, expiresAtIso])

    const created = await rawGet('SELECT * FROM resto_table_locks WHERE table_id = ?', [tableId]) as any
    return NextResponse.json({ ok: true, lock: formatLock(created) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memproses lock' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureLockTable()
    const body = await req.json().catch(() => ({}))
    const tableId = Number(body?.tableId || 0) || 0
    const deviceId = String(body?.deviceId || '').trim()
    const ttl = Math.max(30, Math.min(600, Number(body?.ttl || DEFAULT_TTL_SECONDS) || DEFAULT_TTL_SECONDS))
    if (!tableId || !deviceId) return NextResponse.json({ error: 'tableId dan deviceId wajib' }, { status: 400 })

    const current = await rawGet('SELECT * FROM resto_table_locks WHERE table_id = ?', [tableId]) as any
    if (!current) return NextResponse.json({ ok: false, error: 'Lock tidak ditemukan' }, { status: 404 })
    if (String(current.device_id) !== deviceId) return NextResponse.json({ ok: false, error: 'Bukan pemegang lock' }, { status: 403 })

    const now = Math.floor(Date.now() / 1000)
    const expiresAtIso = new Date((now + ttl) * 1000).toISOString()
    await rawRun(`UPDATE resto_table_locks SET updated_at = CURRENT_TIMESTAMP, expires_at = ? WHERE table_id = ?`, [expiresAtIso, tableId])
    const refreshed = await rawGet('SELECT * FROM resto_table_locks WHERE table_id = ?', [tableId]) as any
    return NextResponse.json({ ok: true, lock: {
      table_id: refreshed.table_id,
      device_id: refreshed.device_id,
      user_id: refreshed.user_id ?? null,
      user_name: refreshed.user_name || '',
      locked_at: refreshed.locked_at,
      updated_at: refreshed.updated_at,
      expires_at: refreshed.expires_at,
    } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memperpanjang lock' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await ensureLockTable()
    const url = new URL(req.url)
    const tableId = Number(url.searchParams.get('table_id') || '0') || 0
    const deviceId = String(url.searchParams.get('device_id') || '').trim()
    if (!tableId || !deviceId) return NextResponse.json({ error: 'table_id dan device_id wajib' }, { status: 400 })

    const current = await rawGet('SELECT * FROM resto_table_locks WHERE table_id = ?', [tableId]) as any
    if (current && String(current.device_id) !== deviceId) {
      return NextResponse.json({ ok: false, error: 'Bukan pemegang lock' }, { status: 403 })
    }
    await rawRun('DELETE FROM resto_table_locks WHERE table_id = ?', [tableId])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal melepas lock' }, { status: 500 })
  }
}
