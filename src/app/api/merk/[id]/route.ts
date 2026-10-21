import { NextRequest, NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { findMerkById, updateMerk, softDeleteMerk } from '@/lib/repositories/masterRepository'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'merk', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat merk' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const merk = await findMerkById(id)

    if (!merk || merk.isdelete) {
      return NextResponse.json({ error: 'Merk not found' }, { status: 404 })
    }

    return NextResponse.json(merk)
  } catch (error) {
    console.error('Error fetching merk:', error)
    return NextResponse.json({ error: 'Failed to fetch merk' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'merk', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah merk' }, { status: 403 })
    }
    const data = await request.json()
    const id = parseInt(params.id)

    const existing = await findMerkById(id)
    if (!existing || existing.isdelete) {
      return NextResponse.json({ error: 'Merk not found' }, { status: 404 })
    }

    const name = formatName(data.name) || ''

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const userId = getUserId(request)
    await updateMerk(id, { name, userEdit: userId })

    const updatedMerk = await findMerkById(id)

    return NextResponse.json(updatedMerk)
  } catch (error) {
    console.error('Error updating merk:', error)
    return NextResponse.json({ error: 'Failed to update merk' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'merk', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus merk' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const existing = await findMerkById(id)
    if (!existing || existing.isdelete) {
      return NextResponse.json({ error: 'Merk not found' }, { status: 404 })
    }

    const usageCheck = await rawGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM master_barang WHERE merk_id = ? AND COALESCE(isdelete, 0) = 0',
      [id]
    )

    if (usageCheck && usageCheck.count > 0) {
      return NextResponse.json({
        error: 'Cannot delete merk that is being used by products'
      }, { status: 400 })
    }

    const userId = getUserId(request)
    await softDeleteMerk(id, userId)

    return NextResponse.json({ message: 'Merk deleted successfully' })
  } catch (error) {
    console.error('Error deleting merk:', error)
    return NextResponse.json({ error: 'Failed to delete merk' }, { status: 500 })
  }
}
