import { NextRequest, NextResponse } from 'next/server'
import { formatName, formatCode } from '@/lib/textUtils'
import { hasPermission } from '@/lib/permissions'
import { findSupplierWithAccount, updateSupplier, softDeleteSupplier } from '@/lib/repositories/supplierRepository'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'supplier', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat supplier' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const supplier = await findSupplierWithAccount(id)

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      address: supplier.address,
      phone: supplier.phone,
      npwp: supplier.npwp,
      discountPercent: supplier.discountPercent,
      term: supplier.term || 0,
      accountId: supplier.accountId || null,
      accountCode: supplier.accountCode || null,
      accountName: supplier.accountName || null,
      isdelete: Boolean(supplier.isdelete),
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'supplier', 'edit') && !hasPermission(request as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah supplier' }, { status: 403 })
    }
    const data = await request.json()
    const id = parseInt(params.id)

    const formattedData = {
      code: formatCode(data.code || ''),
      name: formatName(data.name || ''),
      address: (data.address || '').trim(),
      phone: (data.phone || '').trim(),
      npwp: (data.npwp || '').trim(),
      discountPercent: Number(data.discountPercent) || 0,
      term: Number(data.term) || 0,
      accountId: data.accountId ? Number(data.accountId) : null,
    }

    const result = await updateSupplier(id, formattedData)

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Supplier updated successfully' })
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'supplier', 'delete') && !hasPermission(request as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus supplier' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const result = await softDeleteSupplier(id)

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
