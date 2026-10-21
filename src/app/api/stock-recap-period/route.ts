import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'stock_recap_period', 'view') && !hasPermission(request as any, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat Laporan Rekap Stok per Periode' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    const pool = (getDb() as any).$client

    if (mode === 'meta') {
      const periods = await rawAll(`
        SELECT id, code, name, start_date, end_date, status_buku, is_active
        FROM master_periode
        WHERE COALESCE(isdelete, 0) = 0
        ORDER BY start_date DESC
      `)
      const kategori = await rawAll('SELECT id, name FROM master_kategori WHERE COALESCE(isdelete, 0) = 0 ORDER BY name ASC')
      const spesifikasi = await rawAll('SELECT id, name FROM master_spesifikasi WHERE COALESCE(isdelete, 0) = 0 ORDER BY name ASC')
      const merk = await rawAll('SELECT id, name FROM master_merk WHERE COALESCE(isdelete, 0) = 0 ORDER BY name ASC')
      const warehouses = await rawAll('SELECT id, code, name FROM master_gudang WHERE COALESCE(isdelete,0)=0 ORDER BY code ASC')
      return NextResponse.json({ periods, kategori, spesifikasi, merk, warehouses })
    }

    const periodId = Number(searchParams.get('periodId') || 0)
    if (!periodId) {
      return NextResponse.json({ error: 'Periode wajib dipilih' }, { status: 400 })
    }
    const periode = await rawGet<any>('SELECT id, start_date, end_date, status_buku FROM master_periode WHERE id = $1 AND COALESCE(isdelete, 0) = 0', [periodId])
    if (!periode) {
      return NextResponse.json({ error: 'Periode tidak ditemukan' }, { status: 404 })
    }

    const kategoriId = Number(searchParams.get('kategoriId') || 0) || null
    const spesifikasiId = Number(searchParams.get('spesifikasiId') || 0) || null
    const merkId = Number(searchParams.get('merkId') || 0) || null
    const warehouseId = Number(searchParams.get('warehouseId') || 0) || null

    const wheres: string[] = ['COALESCE(b.isdelete,0)=0']
    const params: any[] = []
    if (kategoriId) { wheres.push('b.kategori_id = $' + (params.length + 1)); params.push(kategoriId) }
    if (spesifikasiId) { wheres.push('b.spesifikasi_id = $' + (params.length + 1)); params.push(spesifikasiId) }
    if (merkId) { wheres.push('b.merk_id = $' + (params.length + 1)); params.push(merkId) }

    const barangList = await rawAll<any>(`
      SELECT b.id, b.code, b.name, b.hpp, b.jenis,
             b.kategori_id, k.name as kategori_name,
             b.spesifikasi_id, s.name as spesifikasi_name,
             b.merk_id, m.name as merk_name
      FROM master_barang b
      LEFT JOIN master_kategori k ON b.kategori_id = k.id
      LEFT JOIN master_spesifikasi s ON b.spesifikasi_id = s.id
      LEFT JOIN master_merk m ON b.merk_id = m.id
      ${wheres.length?`WHERE ${wheres.join(' AND ')}`:''}
      ORDER BY b.name ASC
    `, params.length > 0 ? params : undefined)

    const stmtUnits = (barangId: number) => rawAll<any>('SELECT id, name, ratio FROM barang_units WHERE barang_id = $1 ORDER BY ratio ASC', [barangId])
    const stmtLastAvgWh = (ingId: number, endDate: string, whId: number) => rawGet<any>(`
      SELECT balance_avg_cost
      FROM stock_movements
      WHERE ingredient_id = $1
        AND DATE(COALESCE(transaction_date::text, created_at::text)) <= DATE($2)
        AND warehouse_id = $3
      ORDER BY DATE(COALESCE(transaction_date::text, created_at::text)) DESC, id DESC
      LIMIT 1
    `, [ingId, endDate, whId])
    const stmtQtyWh = (ingId: number, endDate: string, whId: number) => rawGet<any>(`
      SELECT SUM(
        CASE 
          WHEN LOWER(COALESCE(movement_type,'')) = 'in' THEN quantity
          WHEN LOWER(COALESCE(movement_type,'')) = 'out' THEN -ABS(quantity)
          WHEN LOWER(COALESCE(movement_type,'')) = 'adjustment' THEN quantity
          ELSE 0
        END
      ) as qty
      FROM stock_movements
      WHERE ingredient_id = $1
        AND DATE(COALESCE(transaction_date::text, created_at::text)) <= DATE($2)
        AND warehouse_id = $3
    `, [ingId, endDate, whId])
    const stmtQtyBeforeWh = (ingId: number, startDate: string, whId: number) => rawGet<any>(`
      SELECT SUM(
        CASE 
          WHEN LOWER(COALESCE(movement_type,'')) = 'in' THEN quantity
          WHEN LOWER(COALESCE(movement_type,'')) = 'out' THEN -ABS(quantity)
          WHEN LOWER(COALESCE(movement_type,'')) = 'adjustment' THEN quantity
          ELSE 0
        END
      ) as qty
      FROM stock_movements
      WHERE ingredient_id = $1
        AND DATE(COALESCE(transaction_date::text, created_at::text)) < DATE($2)
        AND warehouse_id = $3
    `, [ingId, startDate, whId])
    const stmtLastAvgBeforeWh = (ingId: number, startDate: string, whId: number) => rawGet<any>(`
      SELECT balance_avg_cost
      FROM stock_movements
      WHERE ingredient_id = $1
        AND DATE(COALESCE(transaction_date::text, created_at::text)) <= DATE($2)
        AND warehouse_id = $3
      ORDER BY DATE(COALESCE(transaction_date::text, created_at::text)) DESC, id DESC
      LIMIT 1
    `, [ingId, startDate, whId])
    const stmtOpeningFromBalance = (ingId: number, whId: number) => rawGet<any>(`
      SELECT COALESCE(SUM(quantity),0) AS qty
      FROM stock_balance
      WHERE ingredient_id = $1 AND warehouse_id = $2
    `, [ingId, whId])
    const stmtSumPeriodWh = (ingId: number, moveType: string, refType: string, startDate: string, endDate: string, whId: number) => rawGet<any>(`
      SELECT COALESCE(SUM(quantity),0) AS qty
      FROM stock_movements
      WHERE ingredient_id = $1
        AND LOWER(COALESCE(movement_type,'')) = LOWER($2)
        AND LOWER(COALESCE(reference_type,'')) = LOWER($3)
        AND DATE(COALESCE(transaction_date::text, created_at::text)) BETWEEN DATE($4) AND DATE($5)
        AND warehouse_id = $6
    `, [ingId, moveType, refType, startDate, endDate, whId])

    let warehousesToUse: Array<{id:number; name:string}> = []
    if (warehouseId) {
      const g = await rawGet<any>('SELECT id, name FROM master_gudang WHERE id = $1', [warehouseId])
      if (g) warehousesToUse = [{ id: Number(g.id), name: String(g.name || '') }]
    } else {
      warehousesToUse = await rawAll<any>('SELECT id, name FROM master_gudang WHERE COALESCE(isdelete,0)=0 ORDER BY id ASC')
    }

    const rows = [] as any[]
    for (const b of barangList) {
      for (const gw of warehousesToUse) {
        let openingQty = 0
        let openingAvg = 0
        if (Number(periode.id) === 1) {
          const openingFromBal = await stmtOpeningFromBalance(b.id, gw.id)
          openingQty = Number(openingFromBal?.qty || 0)
          openingAvg = Number(b.hpp || 0)
        } else {
          const openingQtyRow = await stmtQtyBeforeWh(b.id, periode.start_date, gw.id)
          openingQty = Number(openingQtyRow?.qty || 0)
          const openingAvgRow = await stmtLastAvgBeforeWh(b.id, periode.start_date, gw.id)
          openingAvg = Number(openingAvgRow?.balance_avg_cost ?? b.hpp ?? 0)
        }
        const openingValue = openingQty * openingAvg

        const qtyRow = await stmtQtyWh(b.id, periode.end_date, gw.id)
        const qtySmall = Number(qtyRow?.qty || 0)

        const avgRow = await stmtLastAvgWh(b.id, periode.end_date, gw.id)
        const hpp = Number(avgRow?.balance_avg_cost ?? b.hpp ?? 0)

        const units = await stmtUnits(b.id)
        const baseUnit = units.find((u: any) => Number(u.ratio) === 1) || units[0] || { name: 'Unit', ratio: 1 }
        const bigUnit = [...units].sort((a: any, b: any)=>Number(b.ratio)-Number(a.ratio)).find((u: any) => Number(u.ratio) > 1) || null
        const bigRatio = bigUnit ? Number(bigUnit.ratio) : 1
        const stockBig = bigRatio > 1 ? (qtySmall / bigRatio) : qtySmall

        const nilaiPersediaan = qtySmall * hpp

        const sumP = async (move: 'in'|'out', ref: string) => {
          const r = await stmtSumPeriodWh(b.id, move, ref, periode.start_date, periode.end_date, gw.id)
          return Number(r?.qty || 0)
        }
        const pembelian = await sumP('in','purchase')
        const returJual = await sumP('in','sale_return')
        const transferMasuk = await sumP('in','stock_transfer')
        const penjualan = await sumP('out','sale')
        const returBeli = await sumP('out','purchase_return')
        const transferKeluar = await sumP('out','stock_transfer')
        const pemakaianBahan = await sumP('out','usage')
        const lainMasuk = 0
        const lainKeluar = 0

        rows.push({
          barang_id: b.id,
          code: b.code,
          name: b.name,
          kategori: b.kategori_name || '',
          spesifikasi: b.spesifikasi_name || '',
          merk: b.merk_name || '',
          gudang: gw.name || '',
          unit_kecil: baseUnit.name,
          qty_kecil: qtySmall,
          unit_besar: bigUnit?.name || baseUnit.name,
          qty_besar: stockBig,
          hpp,
          nilai_persediaan: nilaiPersediaan,
          saldo_awal_qty: openingQty,
          saldo_awal_nilai: openingValue,
          pembelian,
          retur_jual: returJual,
          transfer_masuk: transferMasuk,
          lain_lain_masuk: lainMasuk,
          penjualan,
          retur_beli: returBeli,
          transfer_keluar: transferKeluar,
          lain_lain_keluar: lainKeluar,
          pemakaian_bahan: pemakaianBahan,
          stok_akhir_qty: qtySmall,
          stok_akhir_nilai: nilaiPersediaan,
        })
      }
    }

    return NextResponse.json({ rows, periode: { id: periode.id, start_date: periode.start_date, end_date: periode.end_date } })
  } catch (error: any) {
    console.error('Error fetching stock recap period:', error)
    return NextResponse.json({ error: 'Failed to fetch report', details: error.message }, { status: 500 })
  }
}
