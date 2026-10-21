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
    return NextResponse.json(db.transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const db = await readDB()
    
    // Payment validation rules (same as POS Resto)
    const method = (data.paymentMethod || 'cash') as 'cash' | 'transfer' | 'card'
    const payAmount = Number(data.paymentAmount) || 0
    const totalAmount = Number(data.total) || 0
    
    if (method === 'cash') {
      if (payAmount < totalAmount) {
        return NextResponse.json({ 
          error: 'Nominal pembayaran cash tidak boleh kurang dari total.' 
        }, { status: 400 })
      }
    } else {
      if (payAmount !== totalAmount) {
        return NextResponse.json({ 
          error: `Nominal pembayaran ${method === 'card' ? 'kartu' : 'transfer'} harus TEPAT sama dengan total.` 
        }, { status: 400 })
      }
    }
    
    const transactionNumber = `TRX-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${db.nextIds.transaction.toString().padStart(4, '0')}`
    
    const changeAmount = method === 'cash' ? payAmount - totalAmount : 0
    
    const newTransaction = {
      id: db.nextIds.transaction,
      transactionNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      customerCode: data.customerCode,
      items: data.items,
      subtotal: data.subtotal,
      discountPercent: data.discountPercent || 0,
      discountAmount: data.discountAmount || 0,
      total: data.total,
      paymentMethod: data.paymentMethod || 'cash',
      paymentAmount: payAmount,
      changeAmount: changeAmount,
      cardNumber: data.cardNumber || null,
      bankId: data.bankId || null,
      transactionType: 2,  // POS Retail
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    db.transactions.push(newTransaction)
    db.nextIds.transaction += 1
    
    await writeDB(db)
    
    return NextResponse.json(newTransaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
