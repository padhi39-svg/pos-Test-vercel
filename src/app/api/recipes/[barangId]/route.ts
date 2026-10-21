import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { barangId: string } }
) {
  try {
    const barangId = parseInt(params.barangId)
    if (isNaN(barangId)) {
      return NextResponse.json({ error: 'Invalid barangId' }, { status: 400 })
    }

    const db = getDb()

    const existing = await rawGet('SELECT 1 FROM barang_recipes WHERE barang_id = ? LIMIT 1', [barangId])
    if (!existing) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    await rawRun('DELETE FROM barang_recipes WHERE barang_id = ?', [barangId])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting recipe:', error)
    return NextResponse.json(
      { error: 'Failed to delete recipe', details: error.message },
      { status: 500 }
    )
  }
}
