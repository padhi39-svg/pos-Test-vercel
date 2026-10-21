import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterUsers, masterLevelManager } from '@/db/schema'
import { eq, and, or, like, asc, desc, sql } from 'drizzle-orm'
import { formatName } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import crypto from 'crypto'
import { hasPermission } from '@/lib/permissions'

async function ensureTables(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS master_users (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT,
      level_id INTEGER,
      aktif INTEGER DEFAULT 1,
      isdelete INTEGER DEFAULT 0,
      email TEXT,
      password_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS master_level_manager (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT,
      isdelete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  try {
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS email TEXT`)
    try { await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_master_users_email ON master_users(email)`) } catch {}
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS password_hash TEXT`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS aktif INTEGER DEFAULT 1`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS isdelete INTEGER DEFAULT 0`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
  } catch (e) {
    console.warn('ensureTables migration warning (master_users):', e)
  }
}

async function generateCode(db: ReturnType<typeof getDb>) {
  const lastArr = await db.select({ code: masterUsers.code })
    .from(masterUsers)
    .where(like(masterUsers.code, 'USR/%'))
    .orderBy(desc(masterUsers.id))
    .limit(1)
  const last = lastArr[0] as { code: string } | undefined
  let n = 0
  if (last?.code) {
    const m = /USR\/(\d{6})$/.exec(last.code)
    if (m) n = parseInt(m[1], 10)
  }
  const next = (n + 1).toString().padStart(6, '0')
  return `USR/${next}`
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'users', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat user' }, { status: 403 })
    }
    const db = getDb()
    const pool = (db as any).$client
    await ensureTables(pool)
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const conditions = [eq(masterUsers.isdelete, 0)]
    if (q) {
      conditions.push(
        or(
          like(masterUsers.code, `%${q}%`),
          like(masterUsers.name, `%${q}%`)
        )
      )
    }
    const rows = await db.select({
      id: masterUsers.id,
      code: masterUsers.code,
      name: masterUsers.name,
      levelId: masterUsers.levelId,
      aktif: masterUsers.aktif,
      isdelete: masterUsers.isdelete,
      email: masterUsers.email,
      passwordHash: masterUsers.passwordHash,
      userCreate: masterUsers.userCreate,
      createdAt: masterUsers.createdAt,
      updatedAt: masterUsers.updatedAt,
      levelName: masterLevelManager.name,
    })
      .from(masterUsers)
      .leftJoin(masterLevelManager, eq(masterLevelManager.id, masterUsers.levelId))
      .where(and(...conditions))
      .orderBy(desc(masterUsers.id))
    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/users error:', e)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'users', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat user' }, { status: 403 })
    }
    const db = getDb()
    const pool = (db as any).$client
    await ensureTables(pool)
    const body = await req.json()
    let name = (body.name || '').toString().trim()
    if (name) name = formatName(name)
    const levelId = Number(body.level_id ?? body.levelId ?? 0) || null
    const aktif = body.aktif === false ? 0 : 1
    const emailRaw = (body.email || '').toString().trim()
    const email = emailRaw ? emailRaw.toLowerCase() : ''
    const password = (body.password || '').toString()
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    if (!levelId) return NextResponse.json({ error: 'Level wajib dipilih' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password wajib diisi (min 6 karakter)' }, { status: 400 })
    const dupArr = await db.select({ id: masterUsers.id })
      .from(masterUsers)
      .where(and(eq(masterUsers.email, email), eq(masterUsers.isdelete, 0)))
      .limit(1)
    const dup = dupArr[0]
    if (dup) return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 400 })

    const code = await generateCode(db)
    let password_hash: string | null = null
    if (password) {
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = crypto.createHash('sha256').update(salt + password).digest('hex')
      password_hash = `sha256:${salt}:${hash}`
    }
    const creatorId = getUserId(req)
    const [inserted] = await db.insert(masterUsers).values({
      code,
      name,
      levelId,
      aktif,
      email,
      passwordHash: password_hash,
      userCreate: creatorId,
      createdAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).returning()
    const userId = inserted.id
    try {
      const allowed = Array.isArray(body.allowedJenis) ? body.allowedJenis.map((n: any) => Number(n)).filter((n: number) => [1,2,3].includes(n)) : [1,2,3]
      for (const j of (allowed.length ? allowed : [1,2,3])) {
        await pool.query(`INSERT INTO user_barang_jenis (user_id, jenis) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, j])
      }
    } catch (e) {
      console.warn('Insert allowedJenis (create user) failed (ignored):', e)
    }
    return NextResponse.json(inserted)
  } catch (e: any) {
    console.error('POST /api/users error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal membuat user' }, { status: 500 })
  }
}
