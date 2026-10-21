export type IngredientItem = {
  bahanBakuId: number   // FK ke master barang (jenis = Bahan Baku)
  quantity: number      // Jumlah yang dibutuhkan
  unitName: string      // Unit yang digunakan (dari master barang)
  notes?: string        // Catatan khusus
}

export type Ingredient = {
  id: number
  barangJadiId: number  // FK ke master barang (jenis = Barang Jadi)
  name: string          // Nama resep (misal: "Resep Nasi Goreng Spesial")
  description?: string  // Deskripsi resep
  portion: number       // Untuk berapa porsi resep ini
  items: IngredientItem[]
  isActive: boolean
  isDelete: boolean
  createdAt: string
  updatedAt: string
}

export type IngredientFormData = {
  barangJadiId: number | null
  name: string
  description: string
  portion: number
  items: IngredientItem[]
  isActive: boolean
}

const STORAGE_KEY = 'ingredient_data'

// Helper function untuk Title Case
const titleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Get all ingredients (non-deleted)
export function getAllIngredients(): Ingredient[] {
  // DISABLED: No longer using localStorage - all data should come from SQLite API
  console.warn('ingredientStore.getAllIngredients() is deprecated - use SQLite API /api/ingredient instead')
  return []
}

// Get ingredient by ID
export function getIngredientById(id: number): Ingredient | null {
  const ingredients = getAllIngredients()
  return ingredients.find(item => item.id === id) || null
}

// Get ingredient by barang jadi ID
export function getIngredientByBarangJadiId(barangJadiId: number): Ingredient | null {
  const ingredients = getAllIngredients()
  return ingredients.find(item => item.barangJadiId === barangJadiId) || null
}

// Add new ingredient
export function addIngredient(data: IngredientFormData): { success: boolean; error?: string; id?: number } {
  try {
    const ingredients = getAllIngredients()
    
    // Check if barang jadi already has ingredient
    if (data.barangJadiId && getIngredientByBarangJadiId(data.barangJadiId)) {
      return { success: false, error: 'Barang jadi sudah memiliki resep ingredient' }
    }

    // Validate required fields
    if (!data.barangJadiId || !data.name.trim()) {
      return { success: false, error: 'Barang jadi dan nama resep wajib diisi' }
    }

    if (data.items.length === 0) {
      return { success: false, error: 'Minimal harus ada 1 bahan baku' }
    }

    // Validate items
    for (const item of data.items) {
      if (!item.bahanBakuId || item.quantity <= 0 || !item.unitName.trim()) {
        return { success: false, error: 'Semua bahan baku harus lengkap (bahan, quantity > 0, unit)' }
      }
    }

    const newId = Math.max(0, ...ingredients.map(i => i.id)) + 1
    const now = new Date().toISOString()

    const newIngredient: Ingredient = {
      id: newId,
      barangJadiId: data.barangJadiId,
      name: titleCase(data.name.trim()),
      description: data.description?.trim() || '',
      portion: data.portion || 1,
      items: data.items.map(item => ({
        ...item,
        unitName: titleCase(item.unitName.trim()),
        notes: item.notes?.trim() || ''
      })),
      isActive: data.isActive,
      isDelete: false,
      createdAt: now,
      updatedAt: now
    }

    // DISABLED: No longer using localStorage - all data goes to SQLite via API
    // const allIngredients = [...JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'), newIngredient]
    // localStorage.setItem(STORAGE_KEY, JSON.stringify(allIngredients))
    console.warn('ingredientStore.addIngredient() is deprecated - use SQLite API instead')

    return { success: true, id: newId }
  } catch (error) {
    return { success: false, error: 'Gagal menyimpan data ingredient' }
  }
}

// Update ingredient
export function updateIngredient(id: number, data: IngredientFormData): { success: boolean; error?: string } {
  try {
    const allIngredients: Ingredient[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const index = allIngredients.findIndex(item => item.id === id)
    
    if (index === -1) {
      return { success: false, error: 'Ingredient tidak ditemukan' }
    }

    const existing = allIngredients[index]

    // Check if barang jadi already has ingredient (exclude current)
    if (data.barangJadiId && data.barangJadiId !== existing.barangJadiId) {
      const existingIngredient = getIngredientByBarangJadiId(data.barangJadiId)
      if (existingIngredient && existingIngredient.id !== id) {
        return { success: false, error: 'Barang jadi sudah memiliki resep ingredient' }
      }
    }

    // Validate required fields
    if (!data.barangJadiId || !data.name.trim()) {
      return { success: false, error: 'Barang jadi dan nama resep wajib diisi' }
    }

    if (data.items.length === 0) {
      return { success: false, error: 'Minimal harus ada 1 bahan baku' }
    }

    // Validate items
    for (const item of data.items) {
      if (!item.bahanBakuId || item.quantity <= 0 || !item.unitName.trim()) {
        return { success: false, error: 'Semua bahan baku harus lengkap (bahan, quantity > 0, unit)' }
      }
    }

    allIngredients[index] = {
      ...existing,
      barangJadiId: data.barangJadiId,
      name: titleCase(data.name.trim()),
      description: data.description?.trim() || '',
      portion: data.portion || 1,
      items: data.items.map(item => ({
        ...item,
        unitName: titleCase(item.unitName.trim()),
        notes: item.notes?.trim() || ''
      })),
      isActive: data.isActive,
      updatedAt: new Date().toISOString()
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIngredients))
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Gagal mengupdate data ingredient' }
  }
}

// Soft delete ingredient
export function deleteIngredient(id: number): { success: boolean; error?: string } {
  try {
    const allIngredients: Ingredient[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const index = allIngredients.findIndex(item => item.id === id)
    
    if (index === -1) {
      return { success: false, error: 'Ingredient tidak ditemukan' }
    }

    allIngredients[index] = {
      ...allIngredients[index],
      isDelete: true,
      updatedAt: new Date().toISOString()
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIngredients))
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Gagal menghapus data ingredient' }
  }
}
