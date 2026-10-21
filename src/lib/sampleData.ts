// Sample data untuk restore localStorage
export function createSampleData() {
  if (typeof window === 'undefined') return

  // Sample Barang Data
  const sampleBarang = [
    {
      id: 1,
      code: "BJ001",
      name: "Nasi Goreng Spesial",
      kategoriId: 1,
      spesifikasiId: null,
      merkId: null,
      hpp: 15000,
      jenis: 1, // Barang Jadi
      aktif: true,
      tampilMenu: true,
      units: [{ name: "porsi", ratio: 1 }],
      prices: [{ price: 25000, effectiveDate: "2024-01-01" }],
      isdelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      code: "BJ002", 
      name: "Ayam Bakar",
      kategoriId: 1,
      spesifikasiId: null,
      merkId: null,
      hpp: 20000,
      jenis: 1, // Barang Jadi
      aktif: true,
      tampilMenu: true,
      units: [{ name: "porsi", ratio: 1 }],
      prices: [{ price: 35000, effectiveDate: "2024-01-01" }],
      isdelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      code: "BB001",
      name: "Beras Premium",
      kategoriId: 2,
      spesifikasiId: null,
      merkId: null,
      hpp: 12000,
      jenis: 2, // Bahan Baku
      aktif: true,
      tampilMenu: false,
      units: [{ name: "kg", ratio: 1 }],
      prices: [{ price: 12000, effectiveDate: "2024-01-01" }],
      isdelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 4,
      code: "BB002",
      name: "Ayam Segar",
      kategoriId: 2,
      spesifikasiId: null,
      merkId: null,
      hpp: 25000,
      jenis: 2, // Bahan Baku
      aktif: true,
      tampilMenu: false,
      units: [{ name: "kg", ratio: 1 }],
      prices: [{ price: 25000, effectiveDate: "2024-01-01" }],
      isdelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  // Sample Ingredient Data
  const sampleIngredients = [
    {
      id: 1,
      barangJadiId: 1, // Nasi Goreng Spesial
      name: "Resep Nasi Goreng Spesial",
      description: "Resep nasi goreng dengan bumbu spesial",
      portion: 1,
      items: [
        {
          bahanBakuId: 3, // Beras Premium
          quantity: 0.2,
          unitName: "kg",
          notes: "Beras berkualitas baik"
        },
        {
          bahanBakuId: 4, // Ayam Segar
          quantity: 0.1,
          unitName: "kg", 
          notes: "Ayam dipotong dadu"
        }
      ],
      isActive: true,
      isDelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      barangJadiId: 2, // Ayam Bakar
      name: "Resep Ayam Bakar",
      description: "Resep ayam bakar dengan bumbu tradisional",
      portion: 1,
      items: [
        {
          bahanBakuId: 4, // Ayam Segar
          quantity: 0.5,
          unitName: "kg",
          notes: "Ayam utuh untuk dibakar"
        }
      ],
      isActive: true,
      isDelete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  // Sample Master Data
  const sampleKategori = [
    { id: 1, code: "MAKANAN", name: "Makanan", isdelete: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 2, code: "BAHAN", name: "Bahan Baku", isdelete: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ]

  // DEPRECATED: localStorage usage disabled - use SQLite API instead
  console.warn('⚠️ sampleData.ts is deprecated - use SQLite database instead!')
  // localStorage.setItem('master_barang', JSON.stringify(sampleBarang))
  // localStorage.setItem('master_barang_nextId', '5')
  // localStorage.setItem('ingredient_data', JSON.stringify(sampleIngredients))
  // localStorage.setItem('master_kategori', JSON.stringify(sampleKategori))
  // localStorage.setItem('master_kategori_nextId', '3')

  console.log('Sample data created successfully!')
  console.log('Barang:', sampleBarang.length, 'items')
  console.log('Ingredients:', sampleIngredients.length, 'items')
  console.log('Kategori:', sampleKategori.length, 'items')
}
