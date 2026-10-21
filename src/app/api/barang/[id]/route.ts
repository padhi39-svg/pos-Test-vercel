import { NextRequest, NextResponse } from 'next/server'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getAllowedJenisForRequest } from '@/lib/userJenis'
import { findBarangById, findBarangUnits, findBarangPrices, updateBarang, softDeleteBarang } from '@/lib/repositories/barangRepository'
import { findKategoriById, findSpesifikasiById, findMerkById } from '@/lib/repositories/masterRepository'
import { findAccountById } from '@/lib/repositories/accountRepository'
import { getDb } from '@/db'
import { barangUnits, barangPrices } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const canViewBarang = hasPermission(request as any, 'barang_menu', 'view')
    const canViewBarangPembantu = hasPermission(request as any, 'barang_pembantu', 'view')
    const canViewIngredient = hasPermission(request as any, 'ingredient', 'view')
    const canTransaksi = hasPermission(request as any, 'transaksi', 'view')
    if (!(canViewBarang || canViewBarangPembantu || canViewIngredient || canTransaksi)) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat barang' }, { status: 403 })
    }
    const id = parseInt(params.id)
    const allowedJenis = getAllowedJenisForRequest(request)

    const barang = await findBarangById(id)
    if (!barang || barang.isdelete) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }

    if (Array.isArray(allowedJenis) && allowedJenis.length > 0) {
      const j = Number(barang.jenis)
      if (!allowedJenis.includes(j)) {
        return NextResponse.json({ error: 'Forbidden: jenis barang tidak diizinkan' }, { status: 403 })
      }
    }

    const kategori = barang.kategoriId ? await findKategoriById(barang.kategoriId) : null
    const spesifikasi = barang.spesifikasiId ? await findSpesifikasiById(barang.spesifikasiId) : null
    const merk = barang.merkId ? await findMerkById(barang.merkId) : null
    const account = barang.accountId ? await findAccountById(barang.accountId) : null
    const units = await findBarangUnits(id)
    const prices = await findBarangPrices(id)

    const result = {
      id: barang.id,
      code: barang.code,
      name: barang.name,
      kategoriId: barang.kategoriId,
      kategoriName: kategori?.name ?? null,
      spesifikasiId: barang.spesifikasiId,
      spesifikasiName: spesifikasi?.name ?? null,
      merkId: barang.merkId,
      merkName: merk?.name ?? null,
      accountId: barang.accountId ?? null,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      hpp: barang.hpp,
      jenis: barang.jenis,
      aktif: Boolean(barang.aktif),
      tampilMenu: Boolean(barang.tampilMenu),
      units: units.map(u => ({
        name: u.name,
        ratio: u.ratio
      })),
      prices: prices.map(p => ({
        price: p.price,
        effectiveDate: p.effectiveDate
      })),
      isdelete: Boolean(barang.isdelete),
      createdAt: barang.createdAt,
      updatedAt: barang.updatedAt
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching barang by id:', error)
    return NextResponse.json({ error: 'Failed to fetch barang' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'barang_menu', 'edit') && !hasPermission(request as any, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah barang' }, { status: 403 })
    }
    const data = await request.json()
    const id = parseInt(params.id)

    const barang = await findBarangById(id)
    if (!barang || barang.isdelete) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }

    const formattedData = {
      code: formatCode(data.code || ''),
      name: formatName(data.name || ''),
      kategoriId: data.kategoriId ?? null,
      spesifikasiId: data.spesifikasiId ?? null,
      merkId: data.merkId ?? null,
      hpp: Number(data.hpp) || 0,
      jenis: Number(data.jenis) || 1,
      aktif: Boolean(data.aktif ?? true),
      tampilMenu: Boolean(data.tampilMenu ?? true),
      photoUrl: data.photoUrl ?? null,
      accountId: data.accountId ? Number(data.accountId) : null,
    }

    updateBarang(id, formattedData)

    // Replace units if provided (idempotent)
    if (data.units) {
      getDb().delete(barangUnits).where(eq(barangUnits.barangId, id))
      if (data.units.length > 0) {
        for (const unit of data.units) {
          getDb().insert(barangUnits).values({ barangId: id, name: unit.name, ratio: unit.ratio })
        }
      }
    }

    // Append price history if provided (do not delete existing)
    if (data.prices) {
      if (data.prices.length > 0) {
        for (const price of data.prices) {
          const rounded = Math.round(Number(price.price || 0) * 100) / 100
          getDb().insert(barangPrices).values({ barangId: id, price: rounded, effectiveDate: price.effectiveDate })
        }
      }
    }

    return NextResponse.json({ message: 'Barang updated successfully' })
  } catch (error) {
    console.error('Error updating barang:', error)
    return NextResponse.json({ error: 'Failed to update barang' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'barang_menu', 'delete') && !hasPermission(request as any, 'transaksi', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus barang' }, { status: 403 })
    }
    const id = parseInt(params.id)

    const barang = await findBarangById(id)
    if (!barang || barang.isdelete) {
      return NextResponse.json({ error: 'Barang not found' }, { status: 404 })
    }

    await softDeleteBarang(id)

    return NextResponse.json({ message: 'Barang deleted successfully' })
  } catch (error) {
    console.error('Error deleting barang:', error)
    return NextResponse.json({ error: 'Failed to delete barang' }, { status: 500 })
  }
}
