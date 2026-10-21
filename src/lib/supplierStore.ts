import { formatName, formatCode } from './textUtils'

export type Supplier = {
  id: number
  code: string
  name: string
  address: string
  phone: string
  npwp: string
  discountPercent: number
  term: number
  isdelete: boolean
  createdAt: string
  updatedAt: string
}

const KEY = 'master_supplier'
const NEXT_ID = 'master_supplier_nextId'

function readAll(): Supplier[] {
  // DISABLED: No longer using localStorage - all data should come from SQLite API
  console.warn('supplierStore.readAll() is deprecated - use SQLite API /api/supplier instead')
  return []
}

function save(items: Supplier[]) {
  // DISABLED: No longer using localStorage - all data goes to SQLite via API
  console.warn('supplierStore.save() is deprecated - use SQLite API instead')
}

function writeAll(items: Supplier[]) {
  // DISABLED: No longer using localStorage - all data goes to SQLite via API
  console.warn('supplierStore.writeAll() is deprecated - use SQLite API instead')
}

function readNextId(): number {
  // DISABLED: No longer using localStorage
  console.warn('supplierStore.readNextId() is deprecated - use SQLite API instead')
  return 1
}

function writeNextId(id: number) {
  // DISABLED: No longer using localStorage
  console.warn('supplierStore.writeNextId() is deprecated - use SQLite API instead')
}

function pad(n: number, width = 4): string {
  return n.toString().padStart(width, '0')
}

export function generateSupplierCode(): string {
  // This is now handled by the API
  console.warn('generateSupplierCode() is deprecated - code generation handled by API')
  return 'SUPP-001'
}

export function getAllSuppliers(includeDeleted = false): Supplier[] {
  // DISABLED: Use SQLite API instead
  console.warn('getAllSuppliers() is deprecated - use SQLite API /api/supplier instead')
  return []
}

export function getSupplierById(id: number): Supplier | undefined {
  // DISABLED: Use SQLite API instead
  console.warn('getSupplierById() is deprecated - use SQLite API /api/supplier/[id] instead')
  return undefined
}

export function addSupplier(data: Omit<Supplier, 'id' | 'isdelete' | 'createdAt' | 'updatedAt'>): { success: boolean; error?: string; id?: number } {
  // DISABLED: Use SQLite API instead
  console.warn('addSupplier() is deprecated - use SQLite API POST /api/supplier instead')
  return { success: false, error: 'Use SQLite API instead' }
}

export function updateSupplier(id: number, data: Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>): { success: boolean; error?: string } {
  // DISABLED: Use SQLite API instead
  console.warn('updateSupplier() is deprecated - use SQLite API PUT /api/supplier/[id] instead')
  return { success: false, error: 'Use SQLite API instead' }
}

export function deleteSupplier(id: number): { success: boolean; error?: string } {
  // DISABLED: Use SQLite API instead
  console.warn('deleteSupplier() is deprecated - use SQLite API DELETE /api/supplier/[id] instead')
  return { success: false, error: 'Use SQLite API instead' }
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
