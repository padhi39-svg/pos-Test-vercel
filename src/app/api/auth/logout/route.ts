import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { deleteSessionByToken } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const pool = (db as any).$client

    const cookie = req.headers.get('cookie') || ''
    const token = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('session_token='))?.split('=')[1]
    if (token) {
      await deleteSessionByToken(pool, token)
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set('session_token', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return res
  } catch (e: any) {
    console.error('POST /api/auth/logout error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal logout' }, { status: 500 })
  }
}
