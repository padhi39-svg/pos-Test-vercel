import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterMeja } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { findMejaById } from '@/lib/repositories/reservationRepository'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await findMejaById(Number(params.id))
    if (!row || row.isdelete) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengambil data meja' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'meja', 'edit') && !hasPermission(req as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json().catch(() => ({})) as any
    let { code, name, floor_id, zone, capacity, is_active, is_mergeable, is_smoking, notes } = body
    code = code != null ? String(code).trim().toUpperCase() : undefined
    name = name != null ? String(name).trim() : undefined
    const floorId = floor_id != null ? Number(floor_id) : undefined
    const cap = capacity != null ? Number(capacity) : undefined
    const isActive = is_active != null ? (is_active === 0 || is_active === false ? 0 : 1) : undefined
    const isMergeable = is_mergeable != null ? (is_mergeable === 0 || is_mergeable === false ? 0 : 1) : undefined
    const isSmoking = is_smoking != null ? (is_smoking === 1 || is_smoking === true ? 1 : 0) : undefined
    notes = notes !== undefined ? (notes != null ? String(notes) : null) : undefined

    const db = getDb()
    const exists = await findMejaById(id)
    if (!exists || exists.isdelete) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    if (code) {
      const dup = await db.select({ id: masterMeja.id }).from(masterMeja)
        .where(and(eq(masterMeja.code, code), eq(masterMeja.isdelete, 0)))
        .limit(1)
        .then(r => r[0] ?? null)
      if (dup && dup.id !== id) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 400 })
    }

    const sets: any[] = []
    if (code !== undefined) sets.push(sql`code = ${code}`)
    if (name !== undefined) sets.push(sql`name = ${name}`)
    if (floorId !== undefined) sets.push(sql`floor_id = ${floorId}`)
    if (zone !== undefined) sets.push(sql`zone = ${zone}`)
    if (cap !== undefined) sets.push(sql`capacity = ${cap}`)
    if (isActive !== undefined) sets.push(sql`is_active = ${isActive}`)
    if (isMergeable !== undefined) sets.push(sql`is_mergeable = ${isMergeable}`)
    if (isSmoking !== undefined) sets.push(sql`is_smoking = ${isSmoking}`)
    if (notes !== undefined) sets.push(sql`notes = ${notes}`)
    if (sets.length === 0) return NextResponse.json(exists)

    const userId = getUserId(req)
    await db.execute(sql`
      UPDATE master_meja
      SET ${sql.join(sets, sql`, `)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `)

    const updated = await db.select({
      id: masterMeja.id,
      code: masterMeja.code,
      name: masterMeja.name,
      floorId: masterMeja.floorId,
      zone: masterMeja.zone,
      capacity: masterMeja.capacity,
      isActive: masterMeja.isActive,
      isMergeable: masterMeja.isMergeable,
      isSmoking: masterMeja.isSmoking,
      notes: masterMeja.notes,
      isdelete: masterMeja.isdelete,
      createdAt: masterMeja.createdAt,
      updatedAt: masterMeja.updatedAt,
    }).from(masterMeja).where(eq(masterMeja.id, id)).then(r => r[0] ?? null)

    try { await (db as any).$client.query("SELECT pg_notify('meja_changed', '')") } catch {}
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah meja' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'meja', 'delete') && !hasPermission(req as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const db = getDb()
    const exists = await findMejaById(id)
    if (!exists || exists.isdelete) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    await db.execute(sql`
      UPDATE master_meja
      SET isdelete = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `)

    try { await (db as any).$client.query("SELECT pg_notify('meja_changed', '')") } catch {}
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menghapus meja' }, { status: 500 })
  }
}
