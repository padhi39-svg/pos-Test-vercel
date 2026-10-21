import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'

const accounts = [
  // ======================== NERACA ========================
  // AKTIVA
  { kode: '1100-00', nama: 'AKTIVA',              parent: null,     balance: 'D', tipe: 'header' },
  //   KAS DAN SETARA KAS
  { kode: '1110-00', nama: 'KAS DAN SETARA KAS',   parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1111-11', nama: 'KAS KECIL',            parent: '1110-00', balance: 'D', tipe: 'detail', kas: true },
  { kode: '1111-12', nama: 'KAS BESAR',            parent: '1110-00', balance: 'D', tipe: 'detail', kas: true },
  { kode: '1120-11', nama: 'BCA 01',               parent: '1110-00', balance: 'D', tipe: 'detail', bank: true },
  { kode: '1120-12', nama: 'OCBC',                 parent: '1110-00', balance: 'D', tipe: 'detail', bank: true },
  { kode: '1120-13', nama: 'BCA CV',               parent: '1110-00', balance: 'D', tipe: 'detail', bank: true },
  { kode: '0000-00', nama: 'AYAT SILANG',          parent: '1110-00', balance: 'D', tipe: 'detail' },
  { kode: '9999-99', nama: 'ASK',                  parent: '1110-00', balance: 'D', tipe: 'detail' },
  //   WESEL TAGIH
  { kode: '1210-00', nama: 'WESEL TAGIH - INDUK',  parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1210-11', nama: 'WESEL TAGIH',          parent: '1210-00', balance: 'D', tipe: 'detail' },
  //   PIUTANG DAGANG
  { kode: '1310-00', nama: 'PIUTANG DAGANG - INDUK', parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1310-11', nama: 'PIUTANG DAGANG',       parent: '1310-00', balance: 'D', tipe: 'detail' },
  { kode: '1310-12', nama: 'PIUTANG LAIN-LAIN',    parent: '1310-00', balance: 'D', tipe: 'detail' },
  //   PIUTANG KARYAWAN DAN DIREKSI
  { kode: '1320-00', nama: 'PIUTANG KARYAWAN DAN DIREKSI', parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1320-11', nama: 'PIUTANG KARYAWAN',     parent: '1320-00', balance: 'D', tipe: 'detail' },
  { kode: '1320-12', nama: 'PIUTANG DIREKSI',      parent: '1320-00', balance: 'D', tipe: 'detail' },
  { kode: '1320-13', nama: 'PIUTANG HENI',         parent: '1320-00', balance: 'D', tipe: 'detail' },
  //   PERSEDIAAN
  { kode: '1340-00', nama: 'PERSEDIAAN',           parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1340-11', nama: 'PERSEDIAAN BARANG JADI', parent: '1340-00', balance: 'D', tipe: 'detail' },
  { kode: 'ReturBeli', nama: 'RETUR PEMBELIAN',    parent: '1340-00', balance: 'D', tipe: 'detail' },
  //   BEBAN DIBAYAR DIMUKA
  { kode: '1410-00', nama: 'BEBAN DIBAYAR DIMUKA', parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1410-11', nama: 'UANG MUKA PEMBELIAN',  parent: '1410-00', balance: 'D', tipe: 'detail' },
  { kode: '1410-12', nama: 'BIAYA ASURANSI DDMK',  parent: '1410-00', balance: 'D', tipe: 'detail' },
  //   PAJAK DIBAYAR DIMUKA
  { kode: '1510-00', nama: 'PAJAK DIBAYAR DIMUKA', parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '1510-11', nama: 'PPH ps 4 DDMK',        parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-12', nama: 'PPH 25 DDMK',          parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-13', nama: 'PPH 21 DDMK',          parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-14', nama: 'PPN MASUKAN',          parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-15', nama: 'FEE PAJAK',            parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-16', nama: 'PPH PS 23 DDMK',       parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-17', nama: 'PPH PS 22',            parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-18', nama: 'PPN LB',               parent: '1510-00', balance: 'D', tipe: 'detail' },
  { kode: '1510-19', nama: 'PPH LB',               parent: '1510-00', balance: 'D', tipe: 'detail' },
  //   ASET TETAP
  { kode: '2110-00', nama: 'ASET TETAP',           parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '2110-11', nama: 'TANAH',                parent: '2110-00', balance: 'D', tipe: 'detail' },
  { kode: '2110-12', nama: 'BANGUNAN',             parent: '2110-00', balance: 'D', tipe: 'detail' },
  { kode: '2110-13', nama: 'KENDARAAN KANTOR',     parent: '2110-00', balance: 'D', tipe: 'detail' },
  { kode: '2110-14', nama: 'INVENTARIS KANTOR',    parent: '2110-00', balance: 'D', tipe: 'detail' },
  { kode: '2120-11', nama: 'SOFTWARE',             parent: '2110-00', balance: 'D', tipe: 'detail' },
  //   AKM. PENYUSUTAN
  { kode: '2200-00', nama: 'AKM. PENYUSUTAN',      parent: '1100-00', balance: 'C', tipe: 'header' },
  { kode: '2200-11', nama: 'AKM. PENYUSUTAN BANGUNAN',      parent: '2200-00', balance: 'C', tipe: 'detail' },
  { kode: '2200-12', nama: 'AKM. PENYUSUTAN KENDARAAN KANTOR', parent: '2200-00', balance: 'C', tipe: 'detail' },
  { kode: '2200-13', nama: 'AKM. PENYUSUTAN INVENTARIS',     parent: '2200-00', balance: 'C', tipe: 'detail' },
  { kode: '2200-14', nama: 'AKM. PENYUSUTAN SOFTWARE',       parent: '2200-00', balance: 'C', tipe: 'detail' },
  //   AKTIVA LAINNYA
  { kode: '2300-00', nama: 'AKTIVA LAINNYA',       parent: '1100-00', balance: 'D', tipe: 'header' },
  { kode: '2300-01', nama: 'BANGUNAN DALAM PENYELESAIAN', parent: '2300-00', balance: 'D', tipe: 'detail' },

  // KEWAJIBAN DAN HUTANG
  { kode: '3000-00', nama: 'KEWAJIBAN DAN HUTANG', parent: null,     balance: 'C', tipe: 'header' },
  //   HUTANG BANK
  { kode: '3000-01', nama: 'HUTANG BANK - Induk',  parent: '3000-00', balance: 'C', tipe: 'header' },
  { kode: '3000-11', nama: 'HUTANG BANK',          parent: '3000-01', balance: 'C', tipe: 'detail' },
  //   HUTANG USAHA
  { kode: '3110-00', nama: 'HUTANG USAHA - Induk', parent: '3000-00', balance: 'C', tipe: 'header' },
  { kode: '3110-11', nama: 'HUTANG USAHA',         parent: '3110-00', balance: 'C', tipe: 'detail' },
  //   HUTANG LAIN - LAIN
  { kode: '3120-00', nama: 'HUTANG LAIN - LAIN',   parent: '3000-00', balance: 'C', tipe: 'header' },
  { kode: '3120-11', nama: 'HUTANG DIREKSI',       parent: '3120-00', balance: 'C', tipe: 'detail' },
  { kode: '3210-11', nama: 'WESEL BAYAR',          parent: '3120-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-11', nama: 'HUTANG BIAYA',         parent: '3120-00', balance: 'C', tipe: 'detail' },
  { kode: '3310-11', nama: 'UANG MUKA PENJUALAN',  parent: '3120-00', balance: 'C', tipe: 'detail' },
  //   HUTANG PAJAK
  { kode: '3410-00', nama: 'HUTANG PAJAK',         parent: '3000-00', balance: 'C', tipe: 'header' },
  { kode: '3410-12', nama: 'PPN K',                parent: '3410-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-13', nama: 'HUTANG PPN',           parent: '3410-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-14', nama: 'HUTANG PPH PS 21',     parent: '3410-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-15', nama: 'HUTANG PPH PS 23',     parent: '3410-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-16', nama: 'HUTANG PPH PS 25',     parent: '3410-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-17', nama: 'HUTANG PPH 4A2',       parent: '3410-00', balance: 'C', tipe: 'detail' },
  { kode: '3410-18', nama: 'HUTANG PPH PS 29',     parent: '3410-00', balance: 'C', tipe: 'detail' },

  // EKUITAS
  { kode: '5100-00', nama: 'EKUITAS',              parent: null,     balance: 'C', tipe: 'header' },
  { kode: '5110-11', nama: 'Modal',                parent: '5100-00', balance: 'C', tipe: 'detail' },
  { kode: '5140-11', nama: 'Prive',                parent: '5100-00', balance: 'D', tipe: 'detail' },
  { kode: '5120-11', nama: 'Saldo Laba (Rugi) ditahan', parent: '5100-00', balance: 'C', tipe: 'detail' },
  { kode: '5130-11', nama: 'Saldo Laba (Rugi) Berjalan', parent: '5100-00', balance: 'C', tipe: 'detail' },

  // ======================== LABA-RUGI ========================
  { kode: '6100-00', nama: 'PENDAPATAN',           parent: null,     balance: 'C', tipe: 'header' },
  //   PENJUALAN
  { kode: '6110-00', nama: 'PENJUALAN - INDUK',    parent: '6100-00', balance: 'C', tipe: 'header' },
  { kode: '6110-11', nama: 'PENJUALAN',            parent: '6110-00', balance: 'C', tipe: 'detail' },
  { kode: '6110-14', nama: 'PENJUALAN DIGUNGGUNG', parent: '6110-00', balance: 'C', tipe: 'detail' },
  { kode: '6110-12', nama: 'RETUR PENJUALAN',      parent: '6110-00', balance: 'C', tipe: 'detail' },
  { kode: '6110-13', nama: 'POTONGAN PENJUALAN',   parent: '6110-00', balance: 'C', tipe: 'detail' },
  //   HPP
  { kode: '6210-00', nama: 'BEBAN POKOK PENJUALAN', parent: '6100-00', balance: 'D', tipe: 'header' },
  { kode: '6210-01', nama: 'HPP',                  parent: '6210-00', balance: 'D', tipe: 'detail' },
  //   BEBAN OPERASIONAL
  { kode: '6310-00', nama: 'BEBAN OPERASIONAL',    parent: '6100-00', balance: 'D', tipe: 'header' },
  { kode: '6310-01', nama: 'BIAYA PEMBUNGKUS / TAS KRESEK', parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-02', nama: 'BIAYA KULI',           parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-03', nama: 'BIAYA ONGKOS ANGKUT',  parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-04', nama: 'BIAYA PROMOSI',        parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-05', nama: 'BIAYA IKLAN',          parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-06', nama: 'BIAYA ENTERTAIMENT',   parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-07', nama: 'BIAYA LABEL BAR CODE', parent: '6310-00', balance: 'D', tipe: 'detail' },
  { kode: '6310-08', nama: 'LAIN-LAIN',            parent: '6310-00', balance: 'D', tipe: 'detail' },
  //   BEBAN PENJUALAN
  { kode: '6311-00', nama: 'BEBAN PENJUALAN',      parent: '6100-00', balance: 'D', tipe: 'header' },
  { kode: '6311-11', nama: 'BIAYA GAJI',           parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-12', nama: 'UM MAKAN',             parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-13', nama: 'UANG PREMI MINGGUAN',  parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-14', nama: 'UANG PREMI BULANAN',   parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-15', nama: 'PBB',                  parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-16', nama: 'BIAYA PERJALANAN DINAS', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-17', nama: 'BIAYA ATK, DAN PERLENGKAPAN TOKO', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-18', nama: 'PARKIR',               parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-19', nama: 'EKSPEDISI DAN KIRIM SURAT', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-20', nama: 'BBM',                  parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-21', nama: 'PLASTIK, KARUNG, PLAT', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-22', nama: 'AIR GALON',            parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-23', nama: 'BIAYA SEWA',           parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-24', nama: 'BIAYA SURAT KENDARAAN', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-25', nama: 'BIAYA PERLENGKAPAN DAN SERVICE MOBIL', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-26', nama: 'BIAYA PENYUSUTAN',     parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-27', nama: 'BIAYA OPS',            parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-28', nama: 'BIAYA LISTRIK DAN PAM', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-29', nama: 'BIAYA ADM.BANK',       parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-30', nama: 'BIAYA TELP',           parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-31', nama: 'PPKB',                 parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-32', nama: 'BIAYA SERVICE DAN PERALATAN TOKO', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-33', nama: 'BIAYA RUMAH TANGGA KANTOR', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-34', nama: 'BIAYA PAJAK',          parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-35', nama: 'SUMBANGAN, RETRIBUSI', parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-36', nama: 'PERIJINAN',            parent: '6311-00', balance: 'D', tipe: 'detail' },
  { kode: '6311-37', nama: 'ASURANSI (COA BARU)',  parent: '6311-00', balance: 'D', tipe: 'detail' },
  //   BIAYA NON OPERASIONAL
  { kode: '6410-00', nama: 'BIAYA NON OPERASIONAL', parent: '6100-00', balance: 'D', tipe: 'header' },
  { kode: '6410-11', nama: 'BEBAN SELISIH PEMBAYARAN', parent: '6410-00', balance: 'D', tipe: 'detail' },
  { kode: '6410-12', nama: 'BEBAN NON OPERSIONAL LAINNYA', parent: '6410-00', balance: 'D', tipe: 'detail' },
  { kode: '6410-13', nama: 'BEBAN PAJAK JASA GIRO', parent: '6410-00', balance: 'D', tipe: 'detail' },
  //   PENDAPATAN NON OPERASIONAL
  { kode: '6510-10', nama: 'PENDAPATAN NON OPERASIONAL', parent: '6100-00', balance: 'C', tipe: 'header' },
  { kode: '6510-11', nama: 'PENDAPATAN SELISIH PEMBAYARAN', parent: '6510-10', balance: 'C', tipe: 'detail' },
  { kode: '6510-12', nama: 'TERLAMBAT',            parent: '6510-10', balance: 'C', tipe: 'detail' },
  { kode: '6510-13', nama: 'PENDAPATAN BUNGA',     parent: '6510-10', balance: 'C', tipe: 'detail' },
  { kode: '6510-14', nama: 'POTONGAN PEMBELIAN',   parent: '6510-10', balance: 'C', tipe: 'detail' },
  { kode: '6510-15', nama: 'PENDAPATAN LAIN-LAIN', parent: '6510-10', balance: 'C', tipe: 'detail' },
  { kode: '6510-16', nama: 'LABA PENJUALAN AKTIVA', parent: '6510-10', balance: 'C', tipe: 'detail' },
  //   TOTAL NON-OPERASIONAL
  { kode: '6600-00', nama: 'Total Biaya & Pendapatan Non-Operasional', parent: '6100-00', balance: 'D', tipe: 'header' },
]

// Build Excel rows
const rows = accounts.map(a => ({
  Kode: a.kode,
  Nama: a.nama,
  'Parent Code': a.parent || '',
  'Normal Balance': a.balance,
  Tipe: a.tipe,
  Kas: a.kas ? 'Ya' : '',
  Bank: a.bank ? 'Ya' : '',
}))

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.json_to_sheet(rows)

// Column widths
ws['!cols'] = [
  { wch: 14 },  // Kode
  { wch: 45 },  // Nama
  { wch: 14 },  // Parent Code
  { wch: 16 },  // Normal Balance
  { wch: 8 },   // Tipe
  { wch: 6 },   // Kas
  { wch: 6 },   // Bank
]

XLSX.utils.book_append_sheet(wb, ws, 'Template')

const outputPath = 'coa-full.xlsx'
XLSX.writeFile(wb, outputPath)
console.log(`✓ Generated ${outputPath} with ${accounts.length} accounts`)
