import { NextRequest, NextResponse } from 'next/server'
import { formatName, formatCode } from '@/lib/textUtils'
import { hasPermission } from '@/lib/permissions'
import { findAllSuppliers, findSuppliersPaginated, createSupplier } from '@/lib/repositories/supplierRepository'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'supplier', 'view') && !hasPermission(req as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat supplier' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit') || searchParams.get('page_size')) || 20))
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

    const result = await findSuppliersPaginated({ q, page, pageSize, sortBy, sortDir })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'supplier', 'create') && !hasPermission(request as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat supplier' }, { status: 403 })
    }
    const data = await request.json()

    const allSuppliers = await findAllSuppliers()
    const generateNextCode = (): string => {
      let maxNum = -1
      let width = 3
      for (const r of allSuppliers) {
        const m = /^SUPP(\d+)$/.exec(r.code || '')
        if (m) {
          const numStr = m[1]
          const num = Number(numStr)
          if (!Number.isNaN(num) && num > maxNum) {
            maxNum = num
            width = Math.max(width, numStr.length)
          }
        }
      }
      const next = (maxNum + 1)
      return `SUPP${next.toString().padStart(width, '0')}`
    }

    const formattedData = {
      code: formatCode(data.code || ''),
      name: formatName(data.name || ''),
      address: (data.address || '').trim(),
      phone: (data.phone || '').trim(),
      npwp: (data.npwp || '').trim(),
      discountPercent: Number(data.discountPercent) || 0,
      term: Number(data.term) || 0,
      accountId: data.accountId ? Number(data.accountId) : null,
      kodeInt: String(data.kodeInt || data.kode_int || '').trim().toUpperCase(),
    }

    const codeExists = formattedData.code ? allSuppliers.some((s: any) => s.code === formattedData.code) : false
    if (!formattedData.code || codeExists) {
      formattedData.code = generateNextCode()
    }

    const supplier = await createSupplier(formattedData)

    return NextResponse.json({
      id: supplier.id,
      ...formattedData,
      message: 'Supplier created successfully',
    })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
