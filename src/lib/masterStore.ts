function toTitleCase(s: string) {
  return (s ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
export type MasterKey = 'kategori' | 'merk' | 'spesifikasi'

export type MasterItem = {
  id: number
  code: string
  name: string
  isdelete: boolean
  createdAt: string
  updatedAt: string
}

function storageKey(key: MasterKey) {
  return `master_${key}`
}

function nextIdKey(key: MasterKey) {
  return `master_${key}_nextId`
}

function readAll(key: MasterKey): MasterItem[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(storageKey(key))
  return raw ? (JSON.parse(raw) as MasterItem[]) : []
}

function writeAll(key: MasterKey, items: MasterItem[]) {
  localStorage.setItem(storageKey(key), JSON.stringify(items))
}

function readNextId(key: MasterKey) {
  const raw = localStorage.getItem(nextIdKey(key))
  return raw ? parseInt(raw, 10) : 1
}

function writeNextId(key: MasterKey, id: number) {
  localStorage.setItem(nextIdKey(key), String(id))
}

export function getAll(key: MasterKey, includeDeleted = false): MasterItem[] {
  const items = readAll(key)
  return includeDeleted ? items : items.filter((i) => !i.isdelete)
}

export function getById(key: MasterKey, id: number): MasterItem | undefined {
  return readAll(key).find((i) => i.id === id)
}

export function addItem(key: MasterKey, data: { code: string; name: string }): MasterItem {
  const items = readAll(key)
  const id = readNextId(key)
  const now = new Date().toISOString()
  const code = (data.code ?? '').trim().toUpperCase()
  const name = toTitleCase((data.name ?? '').trim())
  // duplicate check among non-deleted
  const dup = items.find((i) => !i.isdelete && i.code.toLowerCase() === code.toLowerCase())
  if (dup) {
    throw new Error('Kode sudah digunakan')
  }
  const item: MasterItem = { id, code, name, isdelete: false, createdAt: now, updatedAt: now }
  items.push(item)
  writeAll(key, items)
  writeNextId(key, id + 1)
  return item
}

export function updateItem(key: MasterKey, id: number, data: Partial<Pick<MasterItem, 'code' | 'name'>>) {
  const items = readAll(key)
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  const patch: Partial<MasterItem> = { ...data }
  if (patch.code !== undefined) patch.code = (patch.code ?? '').trim().toUpperCase()
  if (patch.name !== undefined) patch.name = toTitleCase((patch.name ?? '').trim())
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() }
  writeAll(key, items)
}

export function softDeleteItem(key: MasterKey, id: number) {
  const items = readAll(key)
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  items[idx].isdelete = true
  items[idx].updatedAt = new Date().toISOString()
  writeAll(key, items)
}
