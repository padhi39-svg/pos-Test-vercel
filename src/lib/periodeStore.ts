import { formatName, formatCode } from './textUtils'

export type Periode = {
  id: number
  code: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  isActive: boolean
  isdelete: boolean
  createdAt: string
  updatedAt: string
}

const KEY = 'master_periode'
const NEXT_ID = 'master_periode_nextId'

function readAll(): Periode[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(KEY)
  return raw ? (JSON.parse(raw) as Periode[]) : []
}
function writeAll(items: Periode[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}
function readNextId() {
  const raw = localStorage.getItem(NEXT_ID)
  return raw ? parseInt(raw, 10) : 1
}
function writeNextId(id: number) {
  localStorage.setItem(NEXT_ID, String(id))
}

export function getAllPeriode(includeDeleted = false): Periode[] {
  const items = readAll()
  return includeDeleted ? items : items.filter((i) => !i.isdelete)
}
export function getPeriodeById(id: number): Periode | undefined {
  return readAll().find((i) => i.id === id)
}

// Helpers
export function getActivePeriode(): Periode | undefined {
  return getAllPeriode().find((p) => p.isActive)
}

export function setActivePeriode(id: number): { success: boolean; error?: string } {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id && !i.isdelete)
  if (idx === -1) return { success: false, error: 'Periode tidak ditemukan' }
  // deactivate others, activate selected
  const now = new Date().toISOString()
  for (let i = 0; i < items.length; i++) {
    if (items[i].isdelete) continue
    if (items[i].id === id) {
      items[i].isActive = true
      items[i].updatedAt = now
    } else if (items[i].isActive) {
      items[i].isActive = false
      items[i].updatedAt = now
    }
  }
  writeAll(items)
  return { success: true }
}

export function isDateWithinActivePeriode(date: string): boolean {
  const p = getActivePeriode()
  if (!p) return false
  return date >= p.startDate && date <= p.endDate
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

export function addPeriode(data: Omit<Periode, 'id' | 'isdelete' | 'createdAt' | 'updatedAt'>): { success: boolean; error?: string; id?: number } {
  try {
    const items = readAll()
    const id = readNextId()
    const now = new Date().toISOString()
    // validations
    const code = formatCode(data.code ?? '')
    if (!code) return { success: false, error: 'Kode wajib diisi' }
    if (items.some((i) => !i.isdelete && i.code.toLowerCase() === code.toLowerCase())) {
      return { success: false, error: 'Kode periode sudah digunakan' }
    }
    const start = data.startDate
    const end = data.endDate
    if (!start || !end) return { success: false, error: 'Tanggal awal/akhir wajib diisi' }
    if (start > end) return { success: false, error: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir' }

    // prevent overlapping ranges (optional but recommended)
    for (const it of items.filter((x) => !x.isdelete)) {
      if (overlaps(start, end, it.startDate, it.endDate)) {
        // allow overlap? For now, block to keep reporting simpler
        return { success: false, error: 'Rentang tanggal tumpang tindih dengan periode lain' }
      }
    }

    const item: Periode = {
      id,
      code,
      name: formatName(data.name || ''),
      startDate: start,
      endDate: end,
      isActive: !!data.isActive,
      isdelete: false,
      createdAt: now,
      updatedAt: now,
    }
    items.push(item)
    // ensure single active
    if (item.isActive) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id !== item.id && items[i].isActive) items[i].isActive = false
      }
    }
    writeAll(items)
    writeNextId(id + 1)
    return { success: true, id }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Gagal menambah periode' }
  }
}

export function updatePeriode(id: number, data: Partial<Omit<Periode, 'id' | 'createdAt' | 'updatedAt'>>): { success: boolean; error?: string } {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return { success: false, error: 'Periode tidak ditemukan' }

  const next = { ...items[idx] }
  if (data.code !== undefined) next.code = formatCode(data.code ?? '')
  if (data.name !== undefined) next.name = formatName(data.name || '')
  if (data.startDate !== undefined) next.startDate = data.startDate
  if (data.endDate !== undefined) next.endDate = data.endDate
  if (data.isActive !== undefined) next.isActive = !!data.isActive

  if (!next.code) return { success: false, error: 'Kode wajib diisi' }
  if (!next.startDate || !next.endDate) return { success: false, error: 'Tanggal awal/akhir wajib diisi' }
  if (next.startDate > next.endDate) return { success: false, error: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir' }
  if (items.some((i) => !i.isdelete && i.id !== id && i.code.toLowerCase() === next.code.toLowerCase())) {
    return { success: false, error: 'Kode periode sudah digunakan' }
  }

  // prevent overlapping with others
  for (const it of items.filter((x) => !x.isdelete && x.id !== id)) {
    if (overlaps(next.startDate, next.endDate, it.startDate, it.endDate)) {
      return { success: false, error: 'Rentang tanggal tumpang tindih dengan periode lain' }
    }
  }

  // ensure single active
  if (next.isActive) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id !== id && items[i].isActive) items[i].isActive = false
    }
  }

  next.updatedAt = new Date().toISOString()
  items[idx] = next
  writeAll(items)
  return { success: true }
}

export function deletePeriode(id: number): { success: boolean; error?: string } {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return { success: false, error: 'Periode tidak ditemukan' }
  items[idx].isdelete = true
  items[idx].updatedAt = new Date().toISOString()
  writeAll(items)
  return { success: true }
}

function toTitleCase(s: string) {
  return (s ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
