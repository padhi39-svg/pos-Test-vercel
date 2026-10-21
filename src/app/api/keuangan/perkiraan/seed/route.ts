import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

async function add(code: string, name: string, parentCode: string | null, level: number, isHeader: boolean, normalBalance: 'D' | 'C', getIdByCode: (c: string)=>number|undefined, byCode: Map<string, number>, golongan?: string) {
  const parentId = parentCode ? getIdByCode(parentCode) ?? null : null
  const computedLevel = parentId ? level : 1
  const db = getDb(); const pool = (db as any).$client
  const res = await pool.query(`
    INSERT INTO accounts (code, name, parent_id, level, is_header, normal_balance, is_active, posting_allowed, currency, golongan, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 'IDR', $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `, [code, name, parentId, computedLevel, isHeader ? 1 : 0, normalBalance, isHeader ? 0 : 1, golongan ?? null])
  byCode.set(code, Number(res.rows[0].id))
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat perkiraan' }, { status: 403 })
    }
    const cnt = await rawGet('SELECT COUNT(*) AS c FROM accounts') as any
    if (Number(cnt?.c || 0) > 0) {
      return NextResponse.json({ message: 'Accounts sudah terisi, seeding dilewati' })
    }

    const byCode = new Map<string, number>()
    const getIdByCode = (code: string) => byCode.get(code)

    // ==================== ASET / ASSETS (1xx) ====================
    await add('100-000-00', 'ASET', null, 1, true, 'D', getIdByCode, byCode)

    // -- Aset Lancar (110)
    await add('110-000-00', 'ASET LANCAR', '100-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('111-000-00', 'KAS & BANK', '110-000-00', 3, true, 'D', getIdByCode, byCode)
    await add('111-001-01', 'Kas Kecil', '111-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_kas')
    await add('111-002-01', 'Bank BCA', '111-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_kas')
    await add('111-003-01', 'Bank Mandiri', '111-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_kas')
    await add('120-000-00', 'PIUTANG USAHA', '110-000-00', 3, true, 'D', getIdByCode, byCode)
    await add('120-001-01', 'Piutang Dagang', '120-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_piutang')
    await add('120-002-01', 'Piutang Lain-lain', '120-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_piutang')
    await add('130-000-00', 'PERSEDIAAN', '110-000-00', 3, true, 'D', getIdByCode, byCode)
    await add('130-001-01', 'Persediaan Barang', '130-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_persediaan')
    await add('140-000-00', 'PPN & UANG MUKA', '110-000-00', 3, true, 'D', getIdByCode, byCode)
    await add('140-001-01', 'PPN Masukan', '140-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_lainnya')
    await add('140-002-01', 'Uang Muka Pembelian (Supplier)', '140-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_lainnya')
    await add('160-000-00', 'ASET LANCAR LAINNYA', '110-000-00', 3, true, 'D', getIdByCode, byCode)
    await add('160-001-01', 'Perlengkapan', '160-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_lainnya')
    await add('160-002-01', 'Sewa Dibayar Dimuka', '160-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_lainnya')
    await add('160-003-01', 'Asuransi Dibayar Dimuka', '160-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_lancar_lainnya')

    // -- Aset Tidak Lancar (150)
    await add('150-000-00', 'ASET TIDAK LANCAR', '100-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('151-000-00', 'ASET TETAP', '150-000-00', 3, true, 'D', getIdByCode, byCode)
    await add('151-001-01', 'Peralatan', '151-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-002-01', 'Akumulasi Penyusutan Peralatan', '151-000-00', 4, false, 'C', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-003-01', 'Gedung', '151-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-004-01', 'Akumulasi Penyusutan Gedung', '151-000-00', 4, false, 'C', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-005-01', 'Kendaraan', '151-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-006-01', 'Akumulasi Penyusutan Kendaraan', '151-000-00', 4, false, 'C', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-007-01', 'Komputer & IT', '151-000-00', 4, false, 'D', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('151-008-01', 'Akumulasi Penyusutan Komputer', '151-000-00', 4, false, 'C', getIdByCode, byCode, 'aset_tidak_lancar')
    await add('152-001-01', 'Tanah', '150-000-00', 3, false, 'D', getIdByCode, byCode, 'aset_tidak_lancar')

    // ==================== KEWAJIBAN / LIABILITIES (2xx) ====================
    await add('200-000-00', 'KEWAJIBAN', null, 1, true, 'C', getIdByCode, byCode)
    await add('210-000-00', 'KEWAJIBAN LANCAR', '200-000-00', 2, true, 'C', getIdByCode, byCode)
    await add('210-001-01', 'Utang Usaha', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-002-01', 'PPN Keluaran', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-003-01', 'Utang PPN', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-004-01', 'Uang Muka Penjualan (Customer)', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-005-01', 'Utang Gaji & Upah', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-006-01', 'Utang PPh 21', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-007-01', 'Utang PPh 23', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-008-01', 'Beban Yang Masih Harus Dibayar', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('210-009-01', 'Pendapatan Diterima Dimuka', '210-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_lancar')
    await add('220-000-00', 'KEWAJIBAN TIDAK LANCAR', '200-000-00', 2, true, 'C', getIdByCode, byCode)
    await add('220-001-01', 'Utang Bank Jangka Panjang', '220-000-00', 3, false, 'C', getIdByCode, byCode, 'kewajiban_tidak_lancar')

    // ==================== EKUITAS / EQUITY (3xx) ====================
    await add('300-000-00', 'EKUITAS', null, 1, true, 'C', getIdByCode, byCode)
    await add('310-000-00', 'MODAL', '300-000-00', 2, true, 'C', getIdByCode, byCode)
    await add('310-001-01', 'Modal Disetor', '310-000-00', 3, false, 'C', getIdByCode, byCode, 'ekuitas')
    await add('310-002-01', 'Prive / Dividen', '310-000-00', 3, false, 'D', getIdByCode, byCode, 'ekuitas')
    await add('390-000-00', 'LABA', '300-000-00', 2, true, 'C', getIdByCode, byCode)
    await add('390-001-01', 'Laba Ditahan', '390-000-00', 3, false, 'C', getIdByCode, byCode, 'ekuitas')
    await add('390-002-01', 'Laba Tahun Berjalan', '390-000-00', 3, false, 'C', getIdByCode, byCode, 'ekuitas')
    await add('390-003-01', 'Laba Bulan Ini', '390-000-00', 3, false, 'C', getIdByCode, byCode, 'ekuitas')

    // ==================== PENDAPATAN / REVENUE (4xx) ====================
    await add('400-000-00', 'PENDAPATAN', null, 1, true, 'C', getIdByCode, byCode)
    await add('410-000-00', 'PENJUALAN', '400-000-00', 2, true, 'C', getIdByCode, byCode)
    await add('410-001-01', 'Penjualan', '410-000-00', 3, false, 'C', getIdByCode, byCode, 'pendapatan')

    // ==================== HARGA POKOK PENJUALAN / COGS (5xx) ====================
    await add('500-000-00', 'HARGA POKOK PENJUALAN', null, 1, true, 'D', getIdByCode, byCode)
    await add('510-000-00', 'HPP', '500-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('510-001-01', 'Harga Pokok Penjualan', '510-000-00', 3, false, 'D', getIdByCode, byCode, 'hpp')

    // ==================== BEBAN OPERASIONAL / OPERATING EXPENSES (6xx) ====================
    await add('600-000-00', 'BEBAN OPERASIONAL', null, 1, true, 'D', getIdByCode, byCode)
    await add('610-000-00', 'BEBAN KARYAWAN', '600-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('610-001-01', 'Beban Gaji & Upah', '610-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('610-002-01', 'Beban Tunjangan & Bonus', '610-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('610-003-01', 'Beban BPJS Kesehatan & Ketenagakerjaan', '610-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('610-004-01', 'Beban Makan & Transport Karyawan', '610-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('610-005-01', 'Beban Pelatihan & Pengembangan', '610-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')

    await add('620-000-00', 'BEBAN TEMPAT & FASILITAS', '600-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('620-001-01', 'Beban Sewa Gedung / Tempat', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('620-002-01', 'Beban Listrik', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('620-003-01', 'Beban Air & Gas', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('620-004-01', 'Beban Telepon & Internet', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('620-005-01', 'Beban Keamanan & Kebersihan', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('620-006-01', 'Beban Pemeliharaan & Perbaikan', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('620-007-01', 'Beban Penyusutan Aset', '620-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')

    await add('630-000-00', 'BEBAN PEMASARAN & PENJUALAN', '600-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('630-001-01', 'Beban Iklan & Promosi', '630-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('630-002-01', 'Beban Cetak & Fotokopi', '630-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('630-003-01', 'Beban Transportasi & Pengiriman', '630-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('630-004-01', 'Beban Perjalanan Dinas', '630-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('630-005-01', 'Beban Jamuan & Representasi', '630-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')

    await add('640-000-00', 'BEBAN ADMINISTRASI & UMUM', '600-000-00', 2, true, 'D', getIdByCode, byCode)
    await add('640-001-01', 'Beban Alat Tulis & Perlengkapan Kantor', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('640-002-01', 'Beban Administrasi Bank', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('640-003-01', 'Beban Langganan & Software', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('640-004-01', 'Beban Asuransi', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('640-005-01', 'Beban Pajak & Retribusi', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('640-006-01', 'Beban Konsultan & Profesional', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')
    await add('640-007-01', 'Beban Bunga Pinjaman', '640-000-00', 3, false, 'D', getIdByCode, byCode, 'beban')

    // ==================== PENDAPATAN LAIN-LAIN (7xx) ====================
    await add('700-000-00', 'PENDAPATAN LAIN-LAIN', null, 1, true, 'C', getIdByCode, byCode)
    await add('710-001-01', 'Pendapatan Bunga Bank', '700-000-00', 2, false, 'C', getIdByCode, byCode, 'pendapatan_lain')

    // ==================== BEBAN LAIN-LAIN (8xx) ====================
    await add('800-000-00', 'BEBAN LAIN-LAIN', null, 1, true, 'D', getIdByCode, byCode)
    await add('810-001-01', 'Beban Pajak Penghasilan', '800-000-00', 2, false, 'D', getIdByCode, byCode, 'beban_lain')
    await add('810-002-01', 'Beban Lain-lain', '800-000-00', 2, false, 'D', getIdByCode, byCode, 'beban_lain')

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('POST /api/keuangan/perkiraan/seed error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to seed accounts' }, { status: 500 })
  }
}
