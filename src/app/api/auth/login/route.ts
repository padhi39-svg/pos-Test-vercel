import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterUsers, masterLevelManager, settings } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { createSession, verifyPasswordHash } from '@/lib/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client
    await createSession(pool, 0, 1) // trigger session table creation
    // Pastikan tabel dan kolom master_users tersedia (pg syntax)
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
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS email TEXT`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS password_hash TEXT`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS aktif INTEGER DEFAULT 1`)
    await pool.query(`ALTER TABLE master_users ADD COLUMN IF NOT EXISTS isdelete INTEGER DEFAULT 0`)
    try { await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_master_users_email ON master_users(email)`) } catch {}

    const body = await req.json().catch(() => ({})) as any
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan Password wajib diisi' }, { status: 400 })
    }

    // Auto seed admin default jika belum ada user aktif sama sekali
    const cntArr = await db.select({ c: sql<number>`COUNT(*)::int` }).from(masterUsers)
      .where(eq(masterUsers.isdelete, 0))
    const cnt = cntArr[0]
    if (!cnt || Number(cnt.c) === 0) {
      let next = 1
      const lastArr = await db.select({ code: masterUsers.code }).from(masterUsers)
        .orderBy(desc(masterUsers.id))
        .limit(1)
      const last = lastArr[0] as { code: string } | undefined
      if (last?.code && /\d{6}$/.test(last.code)) next = Math.max(next, Number((last.code as string).slice(-6)) + 1)
      const code = `USR/${String(next).padStart(6,'0')}`
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = crypto.createHash('sha256').update(salt + '123456').digest('hex')
      const password_hash = `sha256:${salt}:${hash}`

      // Buat level Admin dulu, lalu assign ke user
      await pool.query(`INSERT INTO master_level_manager(code,name) VALUES($1,$2) ON CONFLICT(code) DO NOTHING`, ['ADMIN', 'Admin'])
      const levelRowArr = await db.select({ id: masterLevelManager.id }).from(masterLevelManager)
        .where(eq(masterLevelManager.code, 'ADMIN'))
        .limit(1)
      const levelRow = levelRowArr[0] as { id: number } | undefined
      const levelId = levelRow?.id || null

      await db.insert(masterUsers).values({
        code,
        name: 'Admin',
        levelId,
        aktif: 1,
        isdelete: 0,
        email: 'admin@yopmail.com',
        passwordHash: password_hash,
      })
    }

    const userArr = await db.select().from(masterUsers)
      .where(and(
        eq(masterUsers.email, email),
        eq(masterUsers.isdelete, 0),
        eq(masterUsers.aktif, 1)
      ))
      .limit(1)
    const user = userArr[0] as any

    if (!user) {
      return NextResponse.json({ error: 'User tidak terdaftar' }, { status: 401 })
    }

    const ok = verifyPasswordHash(user.passwordHash, password)
    if (!ok) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 })
    }

    // Ambil TTL session dari settings (auth_session_ttl_hours), default 2 jam
    let ttlHours = 2
    try {
      const rowArr = await db.select({ settingValue: settings.settingValue })
        .from(settings)
        .where(eq(settings.settingKey, 'auth_session_ttl_hours'))
      const row = rowArr[0] as { settingValue: string } | undefined
      const parsed = Number(row?.settingValue)
      if (Number.isFinite(parsed) && parsed > 0) ttlHours = parsed
    } catch {}

    const { token, expires } = await createSession(pool, user.id, ttlHours)
    console.log('[Login] Session created for user:', user.id, 'token:', token.substring(0, 8) + '...', 'expires:', expires)

    const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } })
    res.cookies.set('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * ttlHours,
    })
    res.cookies.set('x-user-id', String(user.id), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * ttlHours,
    })
    return res
  } catch (e: any) {
    console.error('POST /api/auth/login error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal login' }, { status: 500 })
  }
}
