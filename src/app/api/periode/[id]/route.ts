import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)

    const periode = await rawGet<any>(
      `SELECT id, code, name, start_date, end_date, is_active, status_buku, isdelete, created_at, updated_at 
       FROM master_periode 
       WHERE id = $1 AND COALESCE(isdelete, 0) = 0`,
      [id]
    )

    if (!periode) {
      return NextResponse.json({ error: 'Periode not found' }, { status: 404 })
    }

    return NextResponse.json(periode)
  } catch (error) {
    console.error('Error fetching periode:', error)
    return NextResponse.json({ error: 'Failed to fetch periode' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const db = getDb()
    const pool = (db as any).$client
    const id = parseInt(params.id)

    const existing = await rawGet<any>('SELECT id FROM master_periode WHERE id = $1 AND COALESCE(isdelete, 0) = 0', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Periode not found' }, { status: 404 })
    }

    const name = formatName(data.name) || ''
    const startDate = data.startDate || ''
    const endDate = data.endDate || ''
    const isActive = data.isActive ? 1 : 0
    const statusBuku = (data.status_buku || data.statusBuku || '').toString().toUpperCase()

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Name, start date, and end date are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    if (isActive === 1) {
      await rawRun(
        `UPDATE master_periode 
         SET is_active = CASE 
           WHEN id <= $1 THEN 1 
           ELSE 0 
         END 
         WHERE COALESCE(isdelete, 0) = 0`,
        [id]
      )
    }

    const userId = getUserId(request)
    if (statusBuku === 'OPEN' || statusBuku === 'CLOSED') {
      await rawRun(
        `UPDATE master_periode 
         SET name = $1, start_date = $2, end_date = $3, is_active = $4, status_buku = $5, updated_at = CURRENT_TIMESTAMP, user_edit = $6 
         WHERE id = $7`,
        [name, startDate, endDate, isActive, statusBuku, userId, id]
      )
    } else {
      await rawRun(
        `UPDATE master_periode 
         SET name = $1, start_date = $2, end_date = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP, user_edit = $5 
         WHERE id = $6`,
        [name, startDate, endDate, isActive, userId, id]
      )
    }

    const updatedPeriode = await rawGet<any>(
      `SELECT id, code, name, start_date, end_date, is_active, status_buku, isdelete, created_at, updated_at 
       FROM master_periode 
       WHERE id = $1`,
      [id]
    )

    return NextResponse.json(updatedPeriode)
  } catch (error) {
    console.error('Error updating periode:', error)
    return NextResponse.json({ error: 'Failed to update periode' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)

    const existing = await rawGet<any>('SELECT id FROM master_periode WHERE id = $1 AND COALESCE(isdelete, 0) = 0', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Periode not found' }, { status: 404 })
    }

    const userId = getUserId(request)
    await rawRun(
      `UPDATE master_periode 
       SET isdelete = 1, is_active = 0, updated_at = CURRENT_TIMESTAMP, user_edit = $1 
       WHERE id = $2`,
      [userId, id]
    )

    return NextResponse.json({ message: 'Periode deleted successfully' })
  } catch (error) {
    console.error('Error deleting periode:', error)
    return NextResponse.json({ error: 'Failed to delete periode' }, { status: 500 })
  }
}
