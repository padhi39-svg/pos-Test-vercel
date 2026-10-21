import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { formatName } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import crypto from 'crypto'
import { hasPermission } from '@/lib/permissions'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS master_users (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT,
      level_id INTEGER,
      aktif INTEGER DEFAULT 1,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  try {
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_users'"
    )
    const names = cols.map(c => c.column_name.toLowerCase())
    const hasEmail = names.includes('email')
    const hasPassword = names.includes('password_hash')
    if (!hasEmail) {
      await rawRun('ALTER TABLE master_users ADD COLUMN email TEXT')
      try { await rawRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_master_users_email ON master_users(email)') } catch {}
    }
    if (!hasPassword) {
      await rawRun('ALTER TABLE master_users ADD COLUMN password_hash TEXT')
    }
  } catch (e) {
    console.warn('ensureTables migration warning (master_users)', e)
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'users', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat user' }, { status: 403 })
    }
    await ensureTables()
    const id = params.id
    const row = await rawGet<any>(
      `SELECT u.*, lm.name as level_name
       FROM master_users u
       LEFT JOIN master_level_manager lm ON lm.id = u.level_id
       WHERE (u.id = $1 OR u.code = $2) AND u.isdelete = 0
       LIMIT 1`,
      [id, id]
    )
    if (!row) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    try {
      const jenisRows = await rawAll<any>('SELECT jenis FROM user_barang_jenis WHERE user_id = $1 ORDER BY jenis', [(row as any).id])
      ;(row as any).allowedJenis = (jenisRows && jenisRows.length) ? jenisRows.map(r => Number(r.jenis)) : [1,2,3]
    } catch {}
    return NextResponse.json(row)
  } catch (e: any) {
    console.error('GET /api/users/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'users', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah user' }, { status: 403 })
    }
    const db = getDb()
    const pool = (db as any).$client
    await ensureTables()
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const body = await req.json()
    let name = (body.name || '').toString().trim()
    if (name) name = formatName(name)
    const levelId = Number(body.level_id ?? body.levelId ?? 0) || null
    const aktif = body.aktif === false ? 0 : 1
    const email = (body.email || '').toString().trim().toLowerCase() || null
    const password = (body.password || '').toString()
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    if (!levelId) return NextResponse.json({ error: 'Level wajib dipilih' }, { status: 400 })

    if (email) {
      const dup = await rawGet<any>('SELECT id FROM master_users WHERE email = $1 AND id <> $2 AND isdelete = 0 LIMIT 1', [email, id])
      if (dup) return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 400 })
    }

    let password_hash: string | undefined
    if (password) {
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = crypto.createHash('sha256').update(salt + password).digest('hex')
      password_hash = `sha256:${salt}:${hash}`
    }

    const editorId = getUserId(req)
    const result = await rawRun(
      'UPDATE master_users SET name = $1, level_id = $2, aktif = $3, email = $4, password_hash = COALESCE($5, password_hash), updated_at = CURRENT_TIMESTAMP, user_edit = $6 WHERE id = $7',
      [name, levelId, aktif, email, password_hash, editorId, id]
    )
    if (result.rowCount === 0) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

    try {
      const allowed = Array.isArray(body.allowedJenis) ? body.allowedJenis.map((n: any) => Number(n)).filter((n: number) => [1,2,3].includes(n)) : null
      if (allowed) {
        await pool.query('BEGIN')
        try {
          await pool.query('DELETE FROM user_barang_jenis WHERE user_id = $1', [id])
          for (const j of allowed) {
            await pool.query('INSERT INTO user_barang_jenis (user_id, jenis) VALUES ($1, $2)', [id, j])
          }
          if (allowed.length === 0) {
            for (const j of [1,2,3]) await pool.query('INSERT INTO user_barang_jenis (user_id, jenis) VALUES ($1, $2)', [id, j])
          }
          await pool.query('COMMIT')
        } catch (e) {
          await pool.query('ROLLBACK')
          throw e
        }
      }
    } catch (e) {
      console.warn('Update allowedJenis failed (ignored):', e)
    }
    const updated = await rawGet<any>('SELECT * FROM master_users WHERE id = $1', [id])
    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PUT /api/users/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(_req as any, 'users', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus user' }, { status: 403 })
    }
    await ensureTables()
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const editorId = getUserId(_req)
    const result = await rawRun('UPDATE master_users SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = $1 WHERE id = $2', [editorId, id])
    if (result.rowCount === 0) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/users/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
