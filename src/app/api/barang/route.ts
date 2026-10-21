import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getAllowedJenisForRequest } from '@/lib/userJenis'
import { findBarangPaginated, findAllBarangWithJoins, findBarangUnits, findLatestPrices, createBarang, countBarang } from '@/lib/repositories/barangRepository'
import { findKategoriById, findSpesifikasiById, findMerkById } from '@/lib/repositories/masterRepository'
import { inArray, desc } from 'drizzle-orm'
import { barangUnits, barangPrices } from '@/db/schema'

export async function GET(req: NextRequest) {
  try {
    const canViewBarang = hasPermission(req, 'barang_menu', 'view')
    const canViewBarangPembantu = hasPermission(req, 'barang_pembantu', 'view')
    const canViewIngredient = hasPermission(req, 'ingredient', 'view')
    const canTransaksi = hasPermission(req, 'transaksi', 'view')
    if (!(canViewBarang || canViewBarangPembantu || canViewIngredient || canTransaksi)) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat barang' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const jenisParam = searchParams.get('jenis')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('limit') || searchParams.get('page_size')) || 20))
    const sortBy = searchParams.get('sort_by') || 'name'
    const sortDir = (searchParams.get('sort_dir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    const allowedJenis = await getAllowedJenisForRequest(req)

    let jenisFilter: number[] | undefined
    if (jenisParam !== null && jenisParam !== '') {
      const jenisValues = jenisParam.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v))
      const valid = jenisValues.filter(v => allowedJenis.includes(v))
      jenisFilter = valid.length > 0 ? valid : undefined
    } else if (Array.isArray(allowedJenis) && allowedJenis.length > 0) {
      jenisFilter = allowedJenis
    }

    const isPaginated = searchParams.has('page') || searchParams.has('limit') || searchParams.has('page_size')

    let total = 0
    let barang: any[]
    if (isPaginated) {
      const result = await findBarangPaginated({ q, jenis: jenisFilter, sortBy, sortDir, page, pageSize })
      barang = result.rows
      total = result.total
    } else {
      barang = await findAllBarangWithJoins({ q, jenis: jenisFilter })
    }

    const ids = barang.map((b: any) => b.id)
    const db = getDb()
    const [allUnits, allPrices] = ids.length === 0 ? [[], []] : await Promise.all([
      db.select().from(barangUnits).where(inArray(barangUnits.barangId, ids)).orderBy(barangUnits.ratio),
      db.select().from(barangPrices).where(inArray(barangPrices.barangId, ids)).orderBy(desc(barangPrices.effectiveDate)),
    ])

    const unitsByBarang = new Map<number, typeof allUnits>()
    for (const u of allUnits) {
      const list = unitsByBarang.get(u.barangId) || []
      list.push(u)
      unitsByBarang.set(u.barangId, list)
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const pricesByBarang = new Map<number, typeof allPrices>()
    for (const p of allPrices) {
      if (p.effectiveDate && p.effectiveDate > todayStr) continue
      const list = pricesByBarang.get(p.barangId) || []
      list.push(p)
      pricesByBarang.set(p.barangId, list)
    }

    const rows = barang.map((item: any) => {
      const units = unitsByBarang.get(item.id) || []
      const baseUnitId = units[0]?.id || null
      const allPrices = pricesByBarang.get(item.id) || []
      const latestBase = baseUnitId ? allPrices.find(p => Number(p.unitId) === Number(baseUnitId)) : null
      const other = allPrices.filter(p => !latestBase || p !== latestBase)
      const prices = latestBase ? [latestBase, ...other] : other

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        photoUrl: item.photoUrl || null,
        accountId: item.accountId || null,
        accountCode: item.accountCode || null,
        accountName: item.accountName || null,
        kategoriId: item.kategoriId,
        kategoriName: item.kategoriName,
        spesifikasiId: item.spesifikasiId,
        spesifikasiName: item.spesifikasiName,
        merkId: item.merkId,
        merkName: item.merkName,
        hpp: item.hpp,
        jenis: item.jenis,
        aktif: Boolean(item.aktif),
        tampilMenu: Boolean(item.tampilMenu),
        units: units.map(u => ({ id: u.id, name: u.name, ratio: u.ratio })),
        prices: prices.map(p => ({ unit_id: p.unitId, price: p.price, effectiveDate: p.effectiveDate })),
        isdelete: Boolean(item.isdelete),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    })

    if (isPaginated) {
      return NextResponse.json({ rows, total, page, pageSize })
    }
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching barang:', error)
    return NextResponse.json({ error: 'Failed to fetch barang' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request, 'barang_menu', 'create') && !hasPermission(request, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat barang' }, { status: 403 })
    }
    const data = await request.json()

    const formattedData = {
      code: formatCode(data.code || ''),
      name: formatName(data.name || ''),
      kategoriId: data.kategoriId || null,
      spesifikasiId: data.spesifikasiId || null,
      merkId: data.merkId || null,
      hpp: Number(data.hpp) || 0,
      jenis: Number(data.jenis) || 1,
      aktif: Boolean(data.aktif ?? true),
      tampilMenu: Boolean(data.tampilMenu ?? true),
      photoUrl: data.photoUrl ?? null,
      accountId: data.accountId ? Number(data.accountId) : null,
      units: data.units || [],
      prices: data.prices || [],
    }

    try {
      console.log('[POST /api/barang] payload:', formattedData)
    } catch {}

    if (!formattedData.code) {
      const total = await countBarang()
      formattedData.code = `BRG-${(total + 1).toString().padStart(3, '0')}`
    }

    if (formattedData.kategoriId && !(await findKategoriById(formattedData.kategoriId))) {
      return NextResponse.json({ error: `Invalid master_kategori id: ${formattedData.kategoriId}` }, { status: 400 })
    }
    if (formattedData.spesifikasiId && !(await findSpesifikasiById(formattedData.spesifikasiId))) {
      return NextResponse.json({ error: `Invalid master_spesifikasi id: ${formattedData.spesifikasiId}` }, { status: 400 })
    }
    if (formattedData.merkId && !(await findMerkById(formattedData.merkId))) {
      return NextResponse.json({ error: `Invalid master_merk id: ${formattedData.merkId}` }, { status: 400 })
    }

    const userId = getUserId(request)
    const pool = (getDb() as any).$client
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const barang = await createBarang({
        code: formattedData.code,
        name: formattedData.name,
        kategoriId: formattedData.kategoriId,
        spesifikasiId: formattedData.spesifikasiId,
        merkId: formattedData.merkId,
        hpp: formattedData.hpp,
        jenis: formattedData.jenis,
        aktif: formattedData.aktif,
        tampilMenu: formattedData.tampilMenu,
        photoUrl: formattedData.photoUrl,
        accountId: formattedData.accountId,
      })
      const barangId = barang.id

      if (formattedData.units.length > 0) {
        for (const unit of formattedData.units) {
          await client.query('INSERT INTO barang_units (barang_id, name, ratio) VALUES ($1, $2, $3)', [barangId, unit.name, unit.ratio])
        }
      }
      if (formattedData.prices.length > 0) {
        for (const price of formattedData.prices) {
          const rounded = Math.round(Number(price.price || 0) * 100) / 100
          await client.query('INSERT INTO barang_prices (barang_id, price, effective_date) VALUES ($1, $2, $3)', [barangId, rounded, price.effectiveDate])
        }
      }
      await client.query('COMMIT')

      return NextResponse.json({ id: barangId, ...formattedData, message: 'Barang created successfully' })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating barang:', error)
    const message = (error as any)?.message || 'Failed to create barang'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
