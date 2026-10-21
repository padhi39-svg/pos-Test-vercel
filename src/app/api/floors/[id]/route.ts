import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { floors as floorTable } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const row = await db.select().from(floorTable)
      .where(and(eq(floorTable.id, Number(params.id)), eq(floorTable.isdelete, 0)))
      .then(r => r[0] ?? null)
    if (!row) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data lantai' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'lantai', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json().catch(() => ({})) as any
    let { code, name, level_no, is_active } = body
    code = code != null ? String(code).trim().toUpperCase() : undefined
    name = name != null ? String(name).trim() : undefined
    const levelNo = level_no != null ? Number(level_no) : undefined
    const isActive = is_active != null ? (is_active === 0 || is_active === false ? 0 : 1) : undefined

    const db = getDb()
    const exists = await db.select().from(floorTable)
      .where(and(eq(floorTable.id, id), eq(floorTable.isdelete, 0)))
      .then(r => r[0] ?? null)
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    if (code) {
      const dup = await db.select({ id: floorTable.id }).from(floorTable)
        .where(and(eq(floorTable.code, code), eq(floorTable.isdelete, 0)))
        .limit(1)
        .then(r => r[0] ?? null)
      if (dup && dup.id !== id) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 400 })
    }

    const sets: any[] = []
    if (code !== undefined) sets.push(sql`code = ${code}`)
    if (name !== undefined) sets.push(sql`name = ${name}`)
    if (levelNo !== undefined) sets.push(sql`level_no = ${levelNo}`)
    if (isActive !== undefined) sets.push(sql`is_active = ${isActive}`)
    if (sets.length === 0) return NextResponse.json(exists)

    const userId = getUserId(req)
    sets.push(sql`user_edit = ${userId}`)

    await db.execute(sql`
      UPDATE floors
      SET ${sql.join(sets, sql`, `)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `)

    const updated = await db.select().from(floorTable).where(eq(floorTable.id, id)).then(r => r[0] ?? null)
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah lantai' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'lantai', 'delete') && !hasPermission(req as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const db = getDb()
    const exists = await db.select({ id: floorTable.id }).from(floorTable)
      .where(and(eq(floorTable.id, id), eq(floorTable.isdelete, 0)))
      .then(r => r[0] ?? null)
    if (!exists) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    const userId = getUserId(req)
    await db.execute(sql`
      UPDATE floors
      SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = ${userId}
      WHERE id = ${id}
    `)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menghapus lantai' }, { status: 500 })
  }
}
