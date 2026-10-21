// Utility untuk mengosongkan seluruh data di "database" (localStorage)
export function clearAllData() {
  if (typeof window === 'undefined') return

  const keys = [
    // Master Barang
    'master_barang',
    'master_barang_nextId',

    // Ingredient / Resep
    'ingredient_data',

    // Master Kategori/Merk/Spesifikasi
    'master_kategori',
    'master_kategori_nextId',
    'master_merk',
    'master_merk_nextId',
    'master_spesifikasi',
    'master_spesifikasi_nextId',
  ]

  keys.forEach((k) => localStorage.removeItem(k))

  // Opsi: bersihkan semua key yang diawali dengan 'master_' untuk berjaga-jaga
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith('master_')) {
      localStorage.removeItem(k)
    }
  })

  console.log('All app data cleared from localStorage!')
}
