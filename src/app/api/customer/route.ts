import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll } from '@/db/raw'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { findCustomersPaginated, findCustomerByCode, findAllCustomers } from '@/lib/repositories/customerRepository'

let schemaEnsured = false
async function ensureCustomerSchema() {
  if (schemaEnsured) return
  schemaEnsured = true
  const pool = (getDb() as any).$client
  try {
    const colsResult = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'master_customer'"
    )
    const cols = colsResult.rows.map((c: any) => c.column_name)
    const mig: string[] = []
    if (!cols.some((n: string) => n.toLowerCase() === 'sales_id')) {
      mig.push('ALTER TABLE master_customer ADD COLUMN sales_id INTEGER REFERENCES master_sales(id)')
    }
    if (!cols.some((n: string) => n.toLowerCase() === 'jenis_customer_id')) {
      mig.push('ALTER TABLE master_customer ADD COLUMN jenis_customer_id INTEGER REFERENCES master_jenis_customer(id)')
    }
    for (const sql of mig) {
      try { await pool.query(sql) } catch {}
    }
  } catch (e) {
    console.warn('[Customer] migration warning:', e)
  }
}

export async function GET(req: NextRequest) {
  try {
    const canCustomer = hasPermission(req as any, 'customer', 'view')
    const canPosResto = hasPermission(req as any, 'pos_resto', 'view')
    const canSalesList = hasPermission(req as any, 'sales_list', 'view')
    const canTransaksi = hasPermission(req as any, 'transaksi', 'view')
    if (!canCustomer && !canPosResto && !canSalesList && !canTransaksi) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat customer' }, { status: 403 })
    }

    await ensureCustomerSchema()

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit') || searchParams.get('page_size')) || 20))
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

    // Backward compat: return array when no explicit pagination params
    if (!searchParams.has('page') && !searchParams.has('limit') && !searchParams.has('page_size')) {
      const rows = await findAllCustomers({ q: q || undefined })
      return NextResponse.json(rows)
    }

    const result = await findCustomersPaginated({ q, page, pageSize, sortBy, sortDir })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'customer', 'create') && !hasPermission(request as any, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat customer' }, { status: 403 })
    }
    const data = await request.json()

    const pool = (getDb() as any).$client
    await ensureCustomerSchema()

    const generateNextCode = async (): Promise<string> => {
      const rows = await rawAll<{ code: string }>("SELECT code FROM master_customer WHERE code LIKE 'CUST%'")
      let maxNum = -1
      let width = 3
      for (const r of rows) {
        const m = /^CUST(\d+)$/.exec(r.code || '')
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
      return `CUST${next.toString().padStart(width, '0')}`
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
      kodeInt: data.kodeInt ?? data.kode_int ?? '',
      salesId: data.salesId ? Number(data.salesId) : null,
      jenisCustomerId: data.jenisCustomerId ? Number(data.jenisCustomerId) : null,
    }

    const codeExists = formattedData.code ? Boolean(await findCustomerByCode(formattedData.code)) : false
    if (!formattedData.code || codeExists) {
      formattedData.code = await generateNextCode()
    }

    const userId = getUserId(request)
    const result = await pool.query(
      `INSERT INTO master_customer (
        code, name, address, phone, npwp, discount_percent, term, account_id, kode_int, sales_id, jenis_customer_id, created_at, updated_at, user_create
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $12) RETURNING id`,
      [
        formattedData.code,
        formattedData.name,
        formattedData.address,
        formattedData.phone,
        formattedData.npwp,
        formattedData.discountPercent,
        formattedData.term,
        formattedData.accountId,
        formattedData.kodeInt,
        formattedData.salesId,
        formattedData.jenisCustomerId,
        userId,
      ]
    )

    const customerId = result.rows[0].id

    return NextResponse.json({
      id: customerId,
      ...formattedData,
      message: 'Customer created successfully',
      kode_int: formattedData.kodeInt,
    })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
