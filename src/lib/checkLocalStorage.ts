// DEPRECATED: localStorage checking disabled - use SQLite API instead
export function checkLocalStorageData() {
  if (typeof window === 'undefined') return

  console.warn('⚠️ checkLocalStorageData is deprecated - use SQLite database instead!')
  console.log('=== LOCALSTORAGE CHECK DISABLED ===')
  console.log('All data now stored in SQLite database at /data/resto-system.db')
  console.log('Use API endpoints instead:')
  console.log('- GET /api/kategori - for categories')
  console.log('- GET /api/merk - for brands')
  console.log('- GET /api/barang - for products')
  console.log('- GET /api/ingredient - for ingredients')
  console.log('=== END CHECK ===')
}
