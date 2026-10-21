import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import * as XLSX from 'xlsx'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS floors (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      level_no INTEGER,
      is_active INTEGER DEFAULT 1,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS master_meja (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      floor_id INTEGER REFERENCES floors(id) ON DELETE SET NULL,
      zone TEXT,
      capacity INTEGER DEFAULT 2,
      is_active INTEGER DEFAULT 1,
      is_mergeable INTEGER DEFAULT 1,
      is_smoking INTEGER DEFAULT 0,
      isdelete INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  try {
    const cols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_schema='public' AND table_name='master_meja'`) as any[]
    const hasIsdelete = cols.some((c: any) => c.name === 'isdelete')
    if (!hasIsdelete) await rawRun('ALTER TABLE master_meja ADD COLUMN isdelete INTEGER DEFAULT 0')
  } catch (e) {
    console.warn('Skipping master_meja migration:', e)
  }
}

function normStr(v: any) {
  if (v == null) return ''
  return String(v).trim()
}

function boolFrom(v: any) {
  if (v == null || v === '') return undefined
  const s = String(v).trim().toLowerCase()
  return ['1','ya','true','y','yes'].includes(s) ? 1 : 0
}

function zoneFrom(v: any) {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'outdoor' || s === 'out door' || s === 'luar') return 'Outdoor'
  return 'Indoor'
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 400 })
    const ws = wb.Sheets[sheetName]

    // Get rows with header row
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any
    if (!rows.length) return NextResponse.json({ error: 'Data kosong' }, { status: 400 })
    const headers = (rows[0] || []).map((h: any) => String(h || '').trim().toLowerCase())

    const findIdx = (names: string[]) => headers.findIndex(h => names.includes(h))
    const idx = {
      code: findIdx(['code','kode','kode meja','kode_meja']),
      floor_code: findIdx(['floor_code','lantai','lantai_kode','kode_lantai','floor']),
      zone: findIdx(['zone','zonasi','indoor/outdoor','indoor_outdoor','indoor outdoor']),
      smoking: findIdx(['smoking','is_smoking','smoke','smoking_flag']),
      mergeable: findIdx(['mergeable','is_mergeable','dapat_digabung','dapat digabung','merge']),
      capacity: findIdx(['capacity','kapasitas','jumlah_kursi','jumlah kursi']),
      active: findIdx(['active','is_active','aktif']),
      notes: findIdx(['notes','keterangan'])
    }

    const db = getDb()
    const pool = (db as any).$client
    await ensureTables()

    let inserted = 0, updated = 0
    const errors: Array<{row:number; code?:string; message:string}> = []
    const warnings: Array<{row:number; code?:string; message:string}> = []

    await pool.query('BEGIN')
    try {
      for (const r of rows.slice(1).map((row, i) => ({
        __row: i + 2,
        code: idx.code >= 0 ? row[idx.code] : '',
        name: '',
        floor_code: idx.floor_code >= 0 ? row[idx.floor_code] : '',
        zone: idx.zone >= 0 ? row[idx.zone] : '',
        smoking: idx.smoking >= 0 ? row[idx.smoking] : '',
        mergeable: idx.mergeable >= 0 ? row[idx.mergeable] : '',
        capacity: idx.capacity >= 0 ? row[idx.capacity] : '',
        active: idx.active >= 0 ? row[idx.active] : '',
        notes: idx.notes >= 0 ? row[idx.notes] : '',
      }))) {
        const rowNo = r.__row
        try {
          const code = normStr(r.code).toUpperCase()
          if (!code) { errors.push({ row: rowNo, message: 'Kode kosong' }); continue }
          const name = normStr(r.name || code)
          const floorCode = normStr(r.floor_code).toUpperCase()
          let floorId: number | null = null
          if (floorCode) {
            const f = await rawGet(`SELECT id FROM floors WHERE code=? AND COALESCE(isdelete,0)=0 LIMIT 1`, [floorCode]) as any
            if (f) floorId = Number(f.id)
          }
          const zone = zoneFrom(r.zone)
          const capacity = r.capacity != null && r.capacity !== '' ? Number(r.capacity) : 2
          const isActive = r.active != null && r.active !== '' ? (boolFrom(r.active) ? 1 : 0) : 1
          const isSmoking = r.smoking != null && r.smoking !== '' ? (boolFrom(r.smoking) ? 1 : 0) : 0
          const isMergeable = r.mergeable != null && r.mergeable !== '' ? (boolFrom(r.mergeable) ? 1 : 0) : 1
          const notes = r.notes != null && r.notes !== '' ? String(r.notes) : null

          const existed = await rawGet(`SELECT id FROM master_meja WHERE code=? AND COALESCE(isdelete,0)=0 LIMIT 1`, [code]) as any
          if (existed) {
            await rawRun(`UPDATE master_meja SET name=?, floor_id=?, zone=?, capacity=?, is_active=?, is_mergeable=?, is_smoking=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
              [name, floorId, zone, capacity, isActive, isMergeable, isSmoking, notes, existed.id])
            updated++
          } else {
            await rawRun(`INSERT INTO master_meja(code,name,floor_id,zone,capacity,is_active,is_mergeable,is_smoking,notes) VALUES(?,?,?,?,?,?,?,?,?)`,
              [code, name, floorId, zone, capacity, isActive, isMergeable, isSmoking, notes])
            inserted++
          }
        } catch (e: any) {
          errors.push({ row: rowNo, code: r.code, message: e?.message || 'Gagal memproses baris' })
        }
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ inserted, updated, errors, warnings })
  } catch (e: any) {
    console.error('Import meja failed', e)
    return NextResponse.json({ error: e?.message || 'Gagal import meja' }, { status: 500 })
  }
}
