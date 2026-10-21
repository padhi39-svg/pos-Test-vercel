import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawGet } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { formatName, formatCode } from '@/lib/textUtils'
import { hasPermission } from '@/lib/permissions'
import { findKategoriById, updateKategori, softDeleteKategori } from '@/lib/repositories/masterRepository'

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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'kategori', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat kategori' }, { status: 403 })
    }
    await addAuditColumns()
    await ensurePrintTargetColumn()
    const id = parseInt(params.id)

    const kategori = await findKategoriById(id)

    if (!kategori || kategori.isdelete) {
      return NextResponse.json({ error: 'Kategori not found' }, { status: 404 })
    }

    return NextResponse.json(kategori)
  } catch (error) {
    console.error('Error fetching kategori:', error)
    return NextResponse.json({ error: 'Failed to fetch kategori' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'kategori', 'edit') && !hasPermission(request as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah kategori' }, { status: 403 })
    }
    const data = await request.json()
    await addAuditColumns()
    await ensurePrintTargetColumn()
    const id = parseInt(params.id)

    const existing = await findKategoriById(id)
    if (!existing || existing.isdelete) {
      return NextResponse.json({ error: 'Kategori not found' }, { status: 404 })
    }

    const name = formatName(data.name) || ''
    const print_target = data.print_target || null

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const userId = getUserId(request) || null
    await updateKategori(id, { name, printTarget: print_target, userEdit: userId })

    const updatedKategori = await findKategoriById(id)

    return NextResponse.json(updatedKategori)
  } catch (error) {
    console.error('Error updating kategori:', error)
    return NextResponse.json({ error: 'Failed to update kategori' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'kategori', 'delete') && !hasPermission(request as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus kategori' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const existing = await findKategoriById(id)
    if (!existing || existing.isdelete) {
      return NextResponse.json({ error: 'Kategori not found' }, { status: 404 })
    }

    const usageCheck = await rawGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM master_barang WHERE kategori_id = ? AND COALESCE(isdelete, 0) = 0',
      [id]
    )

    if (usageCheck && usageCheck.count > 0) {
      return NextResponse.json({
        error: 'Cannot delete kategori that is being used by products'
      }, { status: 400 })
    }

    const userId = getUserId(request) || null
    await softDeleteKategori(id, userId)

    return NextResponse.json({ message: 'Kategori deleted successfully' })
  } catch (error) {
    console.error('Error deleting kategori:', error)
    return NextResponse.json({ error: 'Failed to delete kategori' }, { status: 500 })
  }
}
