import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { findSpesifikasiById, updateSpesifikasi, softDeleteSpesifikasi } from '@/lib/repositories/masterRepository'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'spesifikasi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat spesifikasi' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const spesifikasi = await findSpesifikasiById(id)

    if (!spesifikasi || spesifikasi.isdelete) {
      return NextResponse.json({ error: 'Spesifikasi not found' }, { status: 404 })
    }

    return NextResponse.json(spesifikasi)
  } catch (error) {
    console.error('Error fetching spesifikasi:', error)
    return NextResponse.json({ error: 'Failed to fetch spesifikasi' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'spesifikasi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah spesifikasi' }, { status: 403 })
    }
    const data = await request.json()
    const id = parseInt(params.id)

    const existing = await findSpesifikasiById(id)
    if (!existing || existing.isdelete) {
      return NextResponse.json({ error: 'Spesifikasi not found' }, { status: 404 })
    }

    const name = formatName(data.name) || ''

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    await updateSpesifikasi(id, { name, userEdit: userId })

    const updatedSpesifikasi = await findSpesifikasiById(id)

    return NextResponse.json(updatedSpesifikasi)
  } catch (error) {
    console.error('Error updating spesifikasi:', error)
    return NextResponse.json({ error: 'Failed to update spesifikasi' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'spesifikasi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus spesifikasi' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const existing = await findSpesifikasiById(id)
    if (!existing || existing.isdelete) {
      return NextResponse.json({ error: 'Spesifikasi not found' }, { status: 404 })
    }

    const usageCheck = await rawGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM master_barang WHERE spesifikasi_id = ? AND COALESCE(isdelete, 0) = 0',
      [id]
    )

    if (usageCheck && usageCheck.count > 0) {
      return NextResponse.json({
        error: 'Cannot delete spesifikasi that is being used by products'
      }, { status: 400 })
    }

    const userId = getUserId(request)
    await softDeleteSpesifikasi(id, userId)

    return NextResponse.json({ message: 'Spesifikasi deleted successfully' })
  } catch (error) {
    console.error('Error deleting spesifikasi:', error)
    return NextResponse.json({ error: 'Failed to delete spesifikasi' }, { status: 500 })
  }
}
