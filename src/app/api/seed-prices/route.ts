import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export async function POST() {
  try {
    const db = getDb()
    const pool = (db as any).$client

    console.log('\n=== SEEDING PRICE DATA ===')

    const barang = await rawGet<any>(
      `SELECT id, code, name
       FROM master_barang
       WHERE code = 'BK0022'`
    )

    if (!barang) {
      return NextResponse.json({ 
        error: 'Barang BK0022 not found. Please create it first.' 
      }, { status: 404 })
    }

    console.log('Found barang:', barang)

    const existingUnits = await rawGet<any>('SELECT COUNT(*) as count FROM barang_units WHERE barang_id = $1', [barang.id])

    let unitIds: any = {}

    if (existingUnits?.count === 0) {
      console.log('Creating units...')

      const botolResult = await pool.query(
        'INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3) RETURNING id',
        [barang.id, 'Botol', 1]
      )
      unitIds.botol = Number(botolResult.rows[0].id)
      console.log('Created Botol unit:', unitIds.botol)

      const dusResult = await pool.query(
        'INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3) RETURNING id',
        [barang.id, 'Dus', 24]
      )
      unitIds.dus = Number(dusResult.rows[0].id)
      console.log('Created Dus unit:', unitIds.dus)
    } else {
      console.log('Units already exist, fetching...')
      const units = await rawAll<any>('SELECT id, name, ratio FROM barang_units WHERE barang_id = $1', [barang.id])
      units.forEach((u: any) => {
        if (u.name === 'Botol') unitIds.botol = u.id
        if (u.name === 'Dus') unitIds.dus = u.id
      })
    }

    const existingPrices = await rawGet<any>('SELECT COUNT(*) as count FROM barang_prices WHERE barang_id = $1', [barang.id])

    if (existingPrices?.count === 0) {
      console.log('Creating prices...')

      await pool.query(
        'INSERT INTO barang_prices (barang_id, unit_id, price, effective_date) VALUES ($1, $2, $3, NOW())',
        [barang.id, unitIds.botol, 10000]
      )
      console.log('Created price for Botol: Rp 10,000')

      await pool.query(
        'INSERT INTO barang_prices (barang_id, unit_id, price, effective_date) VALUES ($1, $2, $3, NOW())',
        [barang.id, unitIds.dus, 240000]
      )
      console.log('Created price for Dus: Rp 240,000')
    } else {
      console.log('Prices already exist')
    }

    const verification = await rawAll<any>(
      `SELECT 
        u.id as unit_id,
        u.name as unit_name,
        u.ratio,
        p.price,
        p.effective_date
      FROM barang_units u
      LEFT JOIN barang_prices p ON u.id = p.unit_id AND p.barang_id = $1
      WHERE u.barang_id = $2
      ORDER BY u.ratio ASC`,
      [barang.id, barang.id]
    )

    console.log('Verification:', verification)

    return NextResponse.json({
      success: true,
      message: 'Data seeded successfully',
      barang: barang,
      units: unitIds,
      verification: verification
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ 
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
