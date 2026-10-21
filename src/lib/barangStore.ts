function toTitleCase(s: string) {
  return (s ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
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
  spesifikasiId: number | null
  merkId: number | null
  accountId: number | null
  accountCode: string | null
  accountName: string | null
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

const KEY = 'master_barang'
const NEXT_ID = 'master_barang_nextId'

function readAll(): Barang[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(KEY)
  return raw ? (JSON.parse(raw) as Barang[]) : []
}

function writeAll(items: Barang[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

function readNextId() {
  const raw = localStorage.getItem(NEXT_ID)
  return raw ? parseInt(raw, 10) : 1
}

function writeNextId(id: number) {
  localStorage.setItem(NEXT_ID, String(id))
}

export function getAllBarang(includeDeleted = false): Barang[] {
  const items = readAll()
  return includeDeleted ? items : items.filter((i) => !i.isdelete)
}

export function getBarangById(id: number): Barang | undefined {
  return readAll().find((i) => i.id === id)
}

export function addBarang(data: Omit<Barang, 'id' | 'isdelete' | 'createdAt' | 'updatedAt'>): Barang {
  const items = readAll()
  const id = readNextId()
  const now = new Date().toISOString()
  const code = (data.code ?? '').trim().toUpperCase()
  const name = toTitleCase((data.name ?? '').trim())
  const units = (data.units ?? []).map((u) => ({ ...u, name: toTitleCase((u.name ?? '').trim()) }))
  // duplicate check among non-deleted
  const dup = items.find((i) => !i.isdelete && i.code.toLowerCase() === code.toLowerCase())
  if (dup) {
    throw new Error('Kode sudah digunakan')
  }
  const item: Barang = { ...data, code, name, units, id, isdelete: false, createdAt: now, updatedAt: now }
  items.push(item)
  writeAll(items)
  writeNextId(id + 1)
  return item
}

export function updateBarang(id: number, patch: Partial<Barang>) {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  const p: Partial<Barang> = { ...patch }
  if (p.code !== undefined) p.code = (p.code ?? '').trim().toUpperCase()
  if (p.name !== undefined) p.name = toTitleCase((p.name ?? '').trim())
  if (p.units !== undefined) p.units = (p.units ?? []).map((u) => ({ ...u, name: toTitleCase((u.name ?? '').trim()) }))
  items[idx] = { ...items[idx], ...p, updatedAt: new Date().toISOString() }
  writeAll(items)
}

export function softDeleteBarang(id: number) {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  items[idx].isdelete = true
  items[idx].updatedAt = new Date().toISOString()
  writeAll(items)
}

export function addBarangPrice(id: number, price: number, effectiveDate: string) {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  const arr = items[idx].prices ?? []
  // prepend newest price
  items[idx].prices = [{ price, effectiveDate }, ...arr]
  items[idx].updatedAt = new Date().toISOString()
  writeAll(items)
}
