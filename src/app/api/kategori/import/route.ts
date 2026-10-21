import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'
import { formatName, formatCode } from '@/lib/textUtils'
import { addAuditColumns, getUserId } from '@/lib/audit'

async function ensurePrintTargetColumn() {
  const pool = (getDb() as any).$client
  const colsResult = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_kategori'"
  )
  const cols = colsResult.rows.map((c: any) => c.column_name)
  if (!cols.some((n: string) => n.toLowerCase() === 'print_target')) {
    await pool.query('ALTER TABLE master_kategori ADD COLUMN print_target TEXT DEFAULT NULL')
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'kategori', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses import kategori' }, { status: 403 })
    }

    const body = await req.json()
    const rows = Array.isArray(body) ? body : body?.rows
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Data kosong' }, { status: 400 })
    }

    await addAuditColumns()
    await ensurePrintTargetColumn()

    const existingRows = await rawAll<{ code: string; id: number }>(
      'SELECT code, id FROM master_kategori WHERE COALESCE(isdelete, 0) = 0'
    )
    const existingCodes = new Map(
      existingRows.map((r: any) => [String(r.code).toLowerCase(), r.id])
    )

    let imported = 0
    const errors: Array<{ row: number; code?: string; message: string }> = []

    const pool = (getDb() as any).$client
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const rowNo = i + 2
        try {
          const code = formatCode(r.code || r.Kode || r.Code || '') || ''
          const name = formatName(r.name || r.Nama || r.Name || '') || ''
          if (!code || !name) {
            errors.push({ row: rowNo, code, message: 'Kode dan Nama wajib diisi' })
            continue
          }
          if (existingCodes.has(code.toLowerCase())) {
            errors.push({ row: rowNo, code, message: `Kode "${code}" sudah ada` })
            continue
          }
          const printTarget = r.print_target || r.printTarget || r.PrintTarget || null
          const userId = getUserId(req) || null
          await client.query(
            'INSERT INTO master_kategori (code, name, print_target, created_at, updated_at, user_create) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4)',
            [code, name, printTarget, userId]
          )
          existingCodes.set(code.toLowerCase(), true)
          imported++
        } catch (e: any) {
          errors.push({ row: rowNo, code: r.code, message: e?.message || 'Gagal memproses' })
        }
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return NextResponse.json({ imported, errors, total: rows.length })
  } catch (e: any) {
    console.error('Import kategori error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal import kategori' }, { status: 500 })
  }
}
