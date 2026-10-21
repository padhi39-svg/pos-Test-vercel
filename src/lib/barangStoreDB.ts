// Database-based Barang Store
export type JenisBarang = 1 | 2 | 3 // 1: Barang Jadi, 2: Bahan Baku, 3: Barang Setengah Jadi

export type BarangUnit = {
  name: string
  ratio: number
}

export type BarangPrice = {
  price: number
  effectiveDate: string // ISO date (YYYY-MM-DD)
}

export type Barang = {
  id: number
  code: string
  name: string
  kategoriId: number | null
  kategoriName?: string
  spesifikasiId: number | null
  spesifikasiName?: string
  merkId: number | null
  merkName?: string
  hpp: number
  jenis: JenisBarang
  aktif: boolean
  tampilMenu: boolean
  units: BarangUnit[]
  prices: BarangPrice[]
  isdelete: boolean
  createdAt: string
  updatedAt: string
}

const API_BASE = '/api'

// Get all barang
export async function getAllBarang(includeDeleted = false): Promise<Barang[]> {
  try {
    const response = await fetch(`${API_BASE}/barang`)
    if (!response.ok) throw new Error('Failed to fetch barang')
    
    const data = await response.json()
    return includeDeleted ? data : data.filter((item: Barang) => !item.isdelete)
  } catch (error) {
    console.error('Error fetching barang:', error)
    return []
  }
}

// Get barang by ID
export async function getBarangById(id: number): Promise<Barang | undefined> {
  try {
    const response = await fetch(`${API_BASE}/barang/${id}`)
    if (!response.ok) return undefined
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching barang by ID:', error)
    return undefined
  }
}

// Add new barang
export async function addBarang(data: Omit<Barang, 'id' | 'isdelete' | 'createdAt' | 'updatedAt'>): Promise<Barang> {
  try {
    const response = await fetch(`${API_BASE}/barang`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) throw new Error('Failed to create barang')
    
    return await response.json()
  } catch (error) {
    console.error('Error creating barang:', error)
    throw error
  }
}

// Update barang
export async function updateBarang(id: number, data: Partial<Barang>): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/barang/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) throw new Error('Failed to update barang')
  } catch (error) {
    console.error('Error updating barang:', error)
    throw error
  }
}

// Soft delete barang
export async function softDeleteBarang(id: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/barang/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) throw new Error('Failed to delete barang')
  } catch (error) {
    console.error('Error deleting barang:', error)
    throw error
  }
}

// Add price to barang
export async function addBarangPrice(id: number, price: number, effectiveDate: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/barang/${id}/price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price, effectiveDate }),
    })
    
    if (!response.ok) throw new Error('Failed to add barang price')
  } catch (error) {
    console.error('Error adding barang price:', error)
    throw error
  }
}
