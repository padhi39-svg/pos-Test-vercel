// Simple database initialization without better-sqlite3 for now
// We'll use a hybrid approach: API-based with file storage

export async function initializeDatabase() {
  // For now, we'll create a simple file-based approach that mimics database behavior
  // This ensures the POS system works while we can later upgrade to full SQLite
  
  const dbPath = './data/resto-db.json'
  
  try {
    const fs = require('fs')
    const path = require('path')
    
    // Create data directory
    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    // Initialize empty database structure
    const initialDB = {
      master_barang: [
        {
          id: 1,
          code: 'MN001',
          name: 'Aneka Buah Segar',
          kategori_id: 1,
          kategori_name: 'Makanan Utama',
          spesifikasi_id: null,
          spesifikasi_name: null,
          merk_id: null,
          merk_name: null,
          hpp: 20000,
          jenis: 1,
          aktif: true,
          tampil_menu: true,
          units: [{ name: 'Porsi', ratio: 1 }],
          prices: [{ price: 28000, effectiveDate: new Date().toISOString().split('T')[0] }],
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          code: 'MN002',
          name: 'Sop Buah Klapa Manis',
          kategori_id: 1,
          kategori_name: 'Makanan Utama',
          spesifikasi_id: null,
          spesifikasi_name: null,
          merk_id: null,
          merk_name: null,
          hpp: 25000,
          jenis: 1,
          aktif: true,
          tampil_menu: true,
          units: [{ name: 'Porsi', ratio: 1 }],
          prices: [{ price: 38000, effectiveDate: new Date().toISOString().split('T')[0] }],
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 3,
          code: 'MN003',
          name: 'Jus Jeruk',
          kategori_id: 2,
          kategori_name: 'Minuman',
          spesifikasi_id: null,
          spesifikasi_name: null,
          merk_id: null,
          merk_name: null,
          hpp: 15000,
          jenis: 1,
          aktif: true,
          tampil_menu: true,
          units: [{ name: 'Gelas', ratio: 1 }],
          prices: [{ price: 26000, effectiveDate: new Date().toISOString().split('T')[0] }],
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 4,
          code: 'MN004',
          name: 'Jus Alpukat',
          kategori_id: 2,
          kategori_name: 'Minuman',
          spesifikasi_id: null,
          spesifikasi_name: null,
          merk_id: null,
          merk_name: null,
          hpp: 18000,
          jenis: 1,
          aktif: true,
          tampil_menu: true,
          units: [{ name: 'Gelas', ratio: 1 }],
          prices: [{ price: 28000, effectiveDate: new Date().toISOString().split('T')[0] }],
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 5,
          code: 'MN005',
          name: 'Jus Melon',
          kategori_id: 2,
          kategori_name: 'Minuman',
          spesifikasi_id: null,
          spesifikasi_name: null,
          merk_id: null,
          merk_name: null,
          hpp: 16000,
          jenis: 1,
          aktif: true,
          tampil_menu: true,
          units: [{ name: 'Gelas', ratio: 1 }],
          prices: [{ price: 26000, effectiveDate: new Date().toISOString().split('T')[0] }],
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      master_customer: [
        {
          id: 1,
          code: 'CUST-001',
          name: 'Customer Umum',
          address: 'Alamat Umum',
          phone: '08123456789',
          discountPercent: 0,
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          code: 'CUST-002',
          name: 'John Doe',
          address: 'Jl. Sudirman No. 123',
          phone: '08111222333',
          discountPercent: 10,
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 3,
          code: 'CUST-003',
          name: 'Jane Smith',
          address: 'Jl. Thamrin No. 456',
          phone: '08222333444',
          discountPercent: 5,
          isdelete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      transactions: [],
      nextIds: {
        barang: 6,
        customer: 4,
        transaction: 1
      }
    }
    
    // Write initial database if doesn't exist
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify(initialDB, null, 2))
      console.log('Database initialized with sample data')
    }
    
    return true
  } catch (error) {
    console.error('Database initialization error:', error)
    return false
  }
}
