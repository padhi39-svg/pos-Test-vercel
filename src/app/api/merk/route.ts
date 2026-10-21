import { NextRequest, NextResponse } from 'next/server'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { findMerkPaginated, findMerkByCode, createMerk } from '@/lib/repositories/masterRepository'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'merk', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat merk' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit') || searchParams.get('page_size')) || 20))
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

    const result = await findMerkPaginated({ q, page, pageSize, sortBy, sortDir })
    return NextResponse.json({ rows: result.rows, total: result.total, page: result.page, pageSize: result.pageSize })
  } catch (error) {
    console.error('Error fetching merk:', error)
    return NextResponse.json({ error: 'Failed to fetch merk' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'merk', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat merk' }, { status: 403 })
    }
    const data = await request.json()

    const code = formatCode(data.code) || ''
    const name = formatName(data.name) || ''

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }

    const existing = await findMerkByCode(code)
    if (existing) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 400 })
    }

    const userId = getUserId(request)
    const newMerk = await createMerk({ code, name, userCreate: userId })

    return NextResponse.json(newMerk)
  } catch (error) {
    console.error('Error creating merk:', error)
    return NextResponse.json({ error: 'Failed to create merk' }, { status: 500 })
  }
}
