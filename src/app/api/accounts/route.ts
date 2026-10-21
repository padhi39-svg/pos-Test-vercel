import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filter = String(searchParams.get('filter') || '')
    const q = (searchParams.get('q') || '').toLowerCase()

    const db = getDb(); const pool = (db as any).$client
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        parent_id INTEGER NULL,
        level INTEGER NOT NULL DEFAULT 1,
        is_header INTEGER NOT NULL DEFAULT 0,
        normal_balance TEXT NOT NULL CHECK (normal_balance IN ('D','C')),
        is_active INTEGER NOT NULL DEFAULT 1,
        is_cash INTEGER NOT NULL DEFAULT 0,
        is_bank_account INTEGER NOT NULL DEFAULT 0,
        is_control_account INTEGER NOT NULL DEFAULT 0,
        posting_allowed INTEGER NOT NULL DEFAULT 1,
        currency TEXT DEFAULT 'IDR',
        golongan TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    try { await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS golongan TEXT DEFAULT NULL`); } catch {}

    try {
      const cnt = await rawGet('SELECT COUNT(1) AS c FROM accounts') as any
      if (!cnt || Number(cnt.c) === 0) {
        await rawRun('INSERT INTO accounts (code, name, normal_balance, is_active, is_cash, is_bank_account, posting_allowed) VALUES (?, ?, ?, 1, ?, ?, 1) ON CONFLICT (code) DO NOTHING', ['1101', 'Kas Kecil', 'D', 1, 0])
        await rawRun('INSERT INTO accounts (code, name, normal_balance, is_active, is_cash, is_bank_account, posting_allowed) VALUES (?, ?, ?, 1, ?, ?, 1) ON CONFLICT (code) DO NOTHING', ['1102', 'Bank BCA', 'D', 0, 1])
      }
    } catch {}

    let rows: any[] = []
    if (filter === 'kas_bank') {
      rows = await rawAll(`
        SELECT id, code, name, golongan
        FROM accounts
        WHERE is_active = 1
          AND posting_allowed = 1
          AND (is_cash = 1 OR is_bank_account = 1)
          ${q ? 'AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ?)' : ''}
        ORDER BY code ASC
      `, q ? [`%${q}%`, `%${q}%`] : undefined) as any[]
      if (!rows || rows.length === 0) {
        try {
          await rawRun('INSERT INTO accounts (code, name, normal_balance, is_active, is_cash, is_bank_account, posting_allowed) VALUES (?, ?, ?, 1, ?, ?, 1) ON CONFLICT (code) DO NOTHING', ['1101', 'Kas Kecil', 'D', 1, 0])
          await rawRun('INSERT INTO accounts (code, name, normal_balance, is_active, is_cash, is_bank_account, posting_allowed) VALUES (?, ?, ?, 1, ?, ?, 1) ON CONFLICT (code) DO NOTHING', ['1102', 'Bank BCA', 'D', 0, 1])
        } catch {}
        rows = await rawAll(`
          SELECT id, code, name, golongan
          FROM accounts
          WHERE (is_cash = 1 OR is_bank_account = 1)
          ORDER BY code ASC
          LIMIT 50
        `) as any[]
      }
    } else if (filter === 'payable_methods') {
      rows = await rawAll(`
        SELECT id, code, name, golongan
        FROM accounts
        WHERE is_active = 1
          AND posting_allowed = 1
          AND (is_cash = 1 OR is_bank_account = 1)
          ${q ? 'AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ?)' : ''}
        ORDER BY code ASC
      `, q ? [`%${q}%`, `%${q}%`] : undefined) as any[]
      if (!rows || rows.length === 0) {
        rows = await rawAll(`
          SELECT id, code, name, golongan
          FROM accounts
          WHERE is_active = 1 AND posting_allowed = 1
          ${q ? 'AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ?)' : ''}
          ORDER BY code ASC
          LIMIT 50
        `, q ? [`%${q}%`, `%${q}%`] : undefined) as any[]
      }
      if (!rows || rows.length === 0) {
        try {
          await rawRun('INSERT INTO accounts (code, name, normal_balance, is_active, is_cash, is_bank_account, posting_allowed) VALUES (?, ?, ?, 1, ?, ?, 1) ON CONFLICT (code) DO NOTHING', ['1101', 'Kas Kecil', 'D', 1, 0])
          await rawRun('INSERT INTO accounts (code, name, normal_balance, is_active, is_cash, is_bank_account, posting_allowed) VALUES (?, ?, ?, 1, ?, ?, 1) ON CONFLICT (code) DO NOTHING', ['1102', 'Bank BCA', 'D', 0, 1])
        } catch {}
        rows = await rawAll(`
          SELECT id, code, name, golongan
          FROM accounts
          WHERE (is_cash = 1 OR is_bank_account = 1)
          ORDER BY code ASC
          LIMIT 50
        `) as any[]
      }
    } else {
      rows = await rawAll(`
        SELECT id, code, name, golongan FROM accounts
        WHERE is_active = 1 AND posting_allowed = 1
        ${q ? 'AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ?)' : ''}
        ORDER BY code ASC
      `, q ? [`%${q}%`, `%${q}%`] : undefined) as any[]
    }

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to list accounts', details: e?.message }, { status: 500 })
  }
}
