import { getDb } from '../db'

export async function seedDatabase() {
  const db = getDb()
  const pool = (db as any).$client

  try {
    const { rows: barangRows } = await pool.query('SELECT COUNT(*) as count FROM master_barang')
    if (Number(barangRows[0].count) > 0) {
      console.log('Database already has data, skipping seed')
      return
    }

    console.log('Seeding database with sample data...')

    await pool.query('INSERT INTO master_kategori (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['KAT-001', 'Makanan Utama'])
    await pool.query('INSERT INTO master_kategori (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['KAT-002', 'Minuman'])
    await pool.query('INSERT INTO master_kategori (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['KAT-003', 'Snack'])

    await pool.query('INSERT INTO master_customer (code, name, address, phone, discount_percent) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', ['CUST-001', 'Customer Umum', 'Alamat Umum', '08123456789', 0])
    await pool.query('INSERT INTO master_customer (code, name, address, phone, discount_percent) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', ['CUST-002', 'John Doe', 'Jl. Sudirman No. 123', '08111222333', 10])
    await pool.query('INSERT INTO master_customer (code, name, address, phone, discount_percent) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', ['CUST-003', 'Jane Smith', 'Jl. Thamrin No. 456', '08222333444', 5])

    const { rows: makanan1 } = await pool.query(`INSERT INTO master_barang (code, name, kategori_id, hpp, jenis, aktif, tampil_menu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, ['MN001', 'Aneka Buah Segar', 1, 20000, 1, true, true])
    const makananId1 = makanan1[0].id
    const { rows: makanan2 } = await pool.query(`INSERT INTO master_barang (code, name, kategori_id, hpp, jenis, aktif, tampil_menu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, ['MN002', 'Sop Buah Klapa Manis', 1, 25000, 1, true, true])
    const makananId2 = makanan2[0].id
    const { rows: minuman1 } = await pool.query(`INSERT INTO master_barang (code, name, kategori_id, hpp, jenis, aktif, tampil_menu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, ['MN003', 'Jus Jeruk', 2, 15000, 1, true, true])
    const minumanId1 = minuman1[0].id
    const { rows: minuman2 } = await pool.query(`INSERT INTO master_barang (code, name, kategori_id, hpp, jenis, aktif, tampil_menu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, ['MN004', 'Jus Alpukat', 2, 18000, 1, true, true])
    const minumanId2 = minuman2[0].id
    const { rows: minuman3 } = await pool.query(`INSERT INTO master_barang (code, name, kategori_id, hpp, jenis, aktif, tampil_menu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, ['MN005', 'Jus Melon', 2, 16000, 1, true, true])
    const minumanId3 = minuman3[0].id
    const { rows: snack1 } = await pool.query(`INSERT INTO master_barang (code, name, kategori_id, hpp, jenis, aktif, tampil_menu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, ['MN006', 'Keripik Pisang', 3, 12000, 1, true, true])
    const snackId1 = snack1[0].id

    const today = new Date().toISOString().split('T')[0]

    await pool.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [makananId1, 28000, today])
    await pool.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [makananId2, 38000, today])
    await pool.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [minumanId1, 26000, today])
    await pool.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [minumanId2, 28000, today])
    await pool.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [minumanId3, 26000, today])
    await pool.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [snackId1, 18000, today])

    await pool.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [makananId1, 'Porsi', 1])
    await pool.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [makananId2, 'Porsi', 1])
    await pool.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [minumanId1, 'Gelas', 1])
    await pool.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [minumanId2, 'Gelas', 1])
    await pool.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [minumanId3, 'Gelas', 1])
    await pool.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [snackId1, 'Pack', 1])

    console.log('Database seeded successfully!')
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}
