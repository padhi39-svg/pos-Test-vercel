import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'resto-db.json')

async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    const { initializeDatabase } = await import('@/lib/initDB')
    await initializeDatabase()
    const data = await fs.readFile(DB_PATH, 'utf8')
    return JSON.parse(data)
  }
}

async function writeDB(data: any) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2))
}

export async function GET() {
  try {
    const db = await readDB()
    const customers = db.master_customer.filter((item: any) => !item.isdelete)
    
    return NextResponse.json(customers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const db = await readDB()
    
    const newCustomer = {
      id: db.nextIds.customer,
      code: data.code || `CUST-${db.nextIds.customer.toString().padStart(3, '0')}`,
      name: data.name,
      address: data.address || '',
      phone: data.phone || '',
      discountPercent: data.discountPercent || 0,
      isdelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    db.master_customer.push(newCustomer)
    db.nextIds.customer += 1
    
    await writeDB(db)
    
    return NextResponse.json(newCustomer)
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
