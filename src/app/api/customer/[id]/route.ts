import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { handleDatabaseError } from '@/lib/database'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { findCustomerById, updateCustomer, softDeleteCustomer } from '@/lib/repositories/customerRepository'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)

    const customer = await findCustomerById(id)

    if (!customer || customer.isdelete) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const result = {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      npwp: customer.npwp || '',
      discountPercent: customer.discountPercent,
      term: customer.term || 0,
      accountId: customer.accountId || null,
      isdelete: Boolean(customer.isdelete),
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      jenisCustomerId: customer.jenisCustomerId || null,
    }

    return NextResponse.json(result)
  } catch (error) {
    handleDatabaseError(error)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
      salesId: data.salesId ? Number(data.salesId) : null,
      jenisCustomerId: data.jenisCustomerId ? Number(data.jenisCustomerId) : null,
    }

    const pool = (getDb() as any).$client
    try {
      const colsResult = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_customer'"
      )
      const cols = colsResult.rows.map((c: any) => c.column_name)
      if (!cols.some((n: string) => n.toLowerCase() === 'sales_id')) {
        await pool.query('ALTER TABLE master_customer ADD COLUMN sales_id INTEGER REFERENCES master_sales(id)')
      }
      if (!cols.some((n: string) => n.toLowerCase() === 'jenis_customer_id')) {
        await pool.query('ALTER TABLE master_customer ADD COLUMN jenis_customer_id INTEGER REFERENCES master_jenis_customer(id)')
      }
    } catch (e) {
      console.warn('[Customer PUT] migration warning:', e)
    }

    const customer = await findCustomerById(id)
    if (!customer || customer.isdelete) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    await updateCustomer(id, formattedData)

    return NextResponse.json({ message: 'Customer updated successfully' })
  } catch (error) {
    handleDatabaseError(error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)

    const customer = await findCustomerById(id)
    if (!customer || customer.isdelete) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    await softDeleteCustomer(id)

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    handleDatabaseError(error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
