import { formatName, formatCode } from './textUtils'

export type Customer = {
  id: number
  code: string
  name: string
  address: string
  phone: string
  npwp: string
  discountPercent: number
  term: number
  salesId?: number | null
  isdelete: boolean
  createdAt: string
  updatedAt: string
}

const KEY = 'master_customer'
const NEXT_ID = 'master_customer_nextId'

function readAll(): Customer[] {
  // DISABLED: No longer using localStorage - all data should come from SQLite API
  console.warn('customerStore.readAll() is deprecated - use SQLite API /api/customer instead')
  return []
}
function save(items: Customer[]) {
  // DISABLED: No longer using localStorage - all data goes to SQLite via API
  console.warn('customerStore.save() is deprecated - use SQLite API instead')
  // localStorage.setItem(KEY, JSON.stringify(items))
}
function writeAll(items: Customer[]) {
  // DISABLED: No longer using localStorage - all data goes to SQLite via API
  console.warn('customerStore.writeAll() is deprecated - use SQLite API instead')
  // localStorage.setItem(KEY, JSON.stringify(items))
}
function readNextId() {
  // DISABLED: No longer using localStorage - all data goes to SQLite via API
  console.warn('customerStore.readNextId() is deprecated - use SQLite API instead')
  return 1
}
function writeNextId(id: number) {
  // DISABLED: No longer using localStorage - all data goes to SQLite via API
  console.warn('customerStore.writeNextId() is deprecated - use SQLite API instead')
}

function pad(n: number, width = 4) {
  return String(n).padStart(width, '0')
}
export function generateCustomerCode(): string {
  const id = readNextId()
  return `CUST-${pad(id)}`
}

export function getAllCustomers(includeDeleted = false): Customer[] {
  const items = readAll()
  return includeDeleted ? items : items.filter((i) => !i.isdelete)
}
export function getCustomerById(id: number): Customer | undefined {
  return readAll().find((i) => i.id === id)
}

export function addCustomer(data: Omit<Customer, 'id' | 'isdelete' | 'createdAt' | 'updatedAt'>): { success: boolean; error?: string; id?: number } {
  try {
    const items = readAll()
    const id = readNextId()
    const now = new Date().toISOString()

    const name = formatName(data.name ?? '')
    if (!name) return { success: false, error: 'Nama customer wajib diisi' }

    const code = formatCode(data.code ?? '') || `CUST-${pad(id)}`
    if (items.some((i) => !i.isdelete && i.code.toLowerCase() === code.toLowerCase())) {
      return { success: false, error: 'Kode customer sudah digunakan' }
    }

    const discount = Number.isFinite(data.discountPercent as any) ? Number(data.discountPercent) : 0
    if (discount < 0 || discount > 100) return { success: false, error: 'Diskon harus 0-100%'}

    const item: Customer = {
      id,
      code,
      name,
      address: formatName(data.address ?? ''),
      phone: (data.phone ?? '').trim(),
      discountPercent: discount,
      isdelete: false,
      createdAt: now,
      updatedAt: now,
    }
    items.push(item)
    writeAll(items)
    writeNextId(id + 1)
    return { success: true, id }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Gagal menambah customer' }
  }
}

export function updateCustomer(id: number, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>): { success: boolean; error?: string } {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return { success: false, error: 'Customer tidak ditemukan' }

  const next = { ...items[idx] }
  if (data.code !== undefined) next.code = formatCode(data.code ?? '')
  if (data.name !== undefined) next.name = formatName(data.name ?? '')
  if (data.address !== undefined) next.address = formatName(data.address ?? '')
  if (data.phone !== undefined) next.phone = (data.phone ?? '').trim()
  if (data.discountPercent !== undefined) next.discountPercent = Number(data.discountPercent) || 0

  if (!next.name) return { success: false, error: 'Nama customer wajib diisi' }
  if (!next.code) return { success: false, error: 'Kode customer wajib diisi' }
  if (items.some((i) => !i.isdelete && i.id !== id && i.code.toLowerCase() === next.code.toLowerCase())) {
    return { success: false, error: 'Kode customer sudah digunakan' }
  }
  if (next.discountPercent < 0 || next.discountPercent > 100) return { success: false, error: 'Diskon harus 0-100%'}

  next.updatedAt = new Date().toISOString()
  items[idx] = next
  writeAll(items)
  return { success: true }
}

export function deleteCustomer(id: number): { success: boolean; error?: string } {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return { success: false, error: 'Customer tidak ditemukan' }
  items[idx].isdelete = true
  items[idx].updatedAt = new Date().toISOString()
  writeAll(items)
  return { success: true }
}

function titleCase(s: string) {
  return (s ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
