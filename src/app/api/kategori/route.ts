import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { formatName, formatCode } from '@/lib/textUtils'
import { hasPermission } from '@/lib/permissions'
import { findKategoriPaginated, findKategoriByCode, createKategori } from '@/lib/repositories/masterRepository'

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

export async function GET(req: NextRequest) {
  try {
    const canKategori = hasPermission(req as any, 'kategori', 'view')
    const canPosResto = hasPermission(req as any, 'pos_resto', 'view')
    const canSalesList = hasPermission(req as any, 'sales_list', 'view')
    const canTransaksi = hasPermission(req as any, 'transaksi', 'view')
    if (!canKategori && !canPosResto && !canSalesList && !canTransaksi) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat kategori' }, { status: 403 })
    }
    await ensurePrintTargetColumn()

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit') || searchParams.get('page_size')) || 20))
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

    const result = await findKategoriPaginated({ q, page, pageSize, sortBy, sortDir })
    const mapped = result.rows.map((r: any) => ({
      ...r,
      print_display: r.printTarget
        ? r.printTarget.charAt(0).toUpperCase() + r.printTarget.slice(1)
        : '-',
    }))

    return NextResponse.json({ rows: mapped, total: result.total, page: result.page, pageSize: result.pageSize })
  } catch (error) {
    console.error('Error fetching kategori:', error)
    return NextResponse.json({ error: 'Failed to fetch kategori' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'kategori', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat kategori' }, { status: 403 })
    }
    const data = await request.json()
    await addAuditColumns()
    await ensurePrintTargetColumn()

    const code = formatCode(data.code) || ''
    const name = formatName(data.name) || ''
    const print_target = data.print_target || null

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }

    const existing = await findKategoriByCode(code)
    if (existing) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 400 })
    }

    const userId = getUserId(request) || null
    const newKategori = await createKategori({ code, name, printTarget: print_target, userCreate: userId })

    return NextResponse.json(newKategori)
  } catch (error) {
    console.error('Error creating kategori:', error)
    return NextResponse.json({ error: 'Failed to create kategori' }, { status: 500 })
  }
}
