import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export async function PUT(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'pos_resto_table', 'view') && !hasPermission(req as any, 'pos_resto', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const layouts: { id: number; pos_x: number; pos_y: number; width: number; height: number; shape: string }[] = body.layouts
    if (!Array.isArray(layouts) || layouts.length === 0) {
      return NextResponse.json({ error: 'layouts array required' }, { status: 400 })
    }

    const pool = (getDb() as any).$client
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const l of layouts) {
        await client.query(
          `UPDATE master_meja SET pos_x = $1, pos_y = $2, width = $3, height = $4, shape = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND isdelete = 0`,
          [l.pos_x, l.pos_y, l.width, l.height, l.shape, l.id]
        )
      }
      await client.query('COMMIT')
      return NextResponse.json({ success: true, updated: layouts.length })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
