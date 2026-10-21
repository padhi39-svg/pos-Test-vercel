import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function ensureTable() {
  const db = getDb(); const pool = (db as any).$client
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_settings (
      device_id TEXT NOT NULL,
      setting_group TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (device_id, setting_group, setting_key)
    );
  `)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('device_id') || ''
    const group = searchParams.get('group') || ''
    if (!deviceId) return NextResponse.json({ error: 'device_id required' }, { status: 400 })
    await ensureTable()
    let rows: any[] = []
    if (group) {
      rows = await rawAll(`
        SELECT setting_key, setting_value
        FROM client_settings
        WHERE device_id = ? AND setting_group = ?
        ORDER BY setting_key
      `, [deviceId, group])
    } else {
      rows = await rawAll(`
        SELECT setting_group, setting_key, setting_value
        FROM client_settings
        WHERE device_id = ?
        ORDER BY setting_group, setting_key
      `, [deviceId])
    }
    return NextResponse.json({ device_id: deviceId, group, settings: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const deviceId: string = body?.device_id || ''
    const group: string = body?.group || ''
    const settings: Array<{ key: string, value: string }> = Array.isArray(body?.settings) ? body.settings : []
    if (!deviceId || !group || settings.length === 0) {
      return NextResponse.json({ error: 'device_id, group, settings required' }, { status: 400 })
    }
    await ensureTable()
    for (const r of settings) {
      await rawRun(`
        INSERT INTO client_settings (device_id, setting_group, setting_key, setting_value, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (device_id, setting_group, setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      `, [deviceId, group, r.key, r.value])
    }
    return NextResponse.json({ success: true, count: settings.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
