import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'resto-db.json')

async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    // Initialize DB if doesn't exist
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
    const barang = db.master_barang.filter((item: any) => !item.isdelete)
    
    return NextResponse.json(barang)
  } catch (error) {
    console.error('Error fetching barang:', error)
    return NextResponse.json({ error: 'Failed to fetch barang' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const db = await readDB()
    
    const newBarang = {
      id: db.nextIds.barang,
      code: data.code || `BRG-${db.nextIds.barang.toString().padStart(3, '0')}`,
      name: data.name,
      kategori_id: data.kategoriId || null,
      kategori_name: data.kategoriName || null,
      spesifikasi_id: data.spesifikasiId || null,
      spesifikasi_name: data.spesifikasiName || null,
      merk_id: data.merkId || null,
      merk_name: data.merkName || null,
      hpp: data.hpp || 0,
      jenis: data.jenis || 1,
      aktif: data.aktif ?? true,
      tampil_menu: data.tampilMenu ?? true,
      units: data.units || [{ name: 'Pcs', ratio: 1 }],
      prices: data.prices || [{ price: 0, effectiveDate: new Date().toISOString().split('T')[0] }],
      isdelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    db.master_barang.push(newBarang)
    db.nextIds.barang += 1
    
    await writeDB(db)
    
    return NextResponse.json(newBarang)
  } catch (error) {
    console.error('Error creating barang:', error)
    return NextResponse.json({ error: 'Failed to create barang' }, { status: 500 })
  }
}
