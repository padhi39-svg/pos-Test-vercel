"use client"

import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef, FilterDef, ColumnVisibilityDef } from '@/components/master/MasterDataList'
import { formatCurrency } from '@/lib/regionalNumber'
import ImportBarang from '@/components/barang/ImportBarang'

interface BarangRow {
  id: number
  code: string
  name: string
  kategoriName: string | null
  merkName: string | null
  jenis: number
  hpp: number
  prices?: { price: number }[]
  accountCode: string | null
  accountName: string | null
  aktif: boolean
  createdAt: string
  updatedAt: string
}

const columns: ColumnDef<BarangRow>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama', render: (r) => r.name },
  { key: 'kategoriName', label: 'Kategori', sortable: false, render: (r) => r.kategoriName || '-' },
  { key: 'merkName', label: 'Merk', sortable: false, render: (r) => r.merkName || '-' },
  { key: 'jenis', label: 'Jenis', render: (r) => ['', 'Barang Jadi', 'Bahan Baku', 'Setengah Jadi'][r.jenis] || '-' },
  { key: 'hpp', label: 'HPP', align: 'right', render: (r) => <span className="font-mono">{formatCurrency(r.hpp ?? 0)}</span> },
  { key: 'price', label: 'Harga Jual', sortable: false, align: 'right', render: (r) => <span className="font-mono">{formatCurrency(r.prices?.[0]?.price ?? 0)}</span> },
  { key: 'account', label: 'Perkiraan', sortable: false, render: (r) => r.accountCode ? `${r.accountCode} - ${r.accountName}` : '-' },
  { key: 'aktif', label: 'Aktif', render: (r) => (
    <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full ${r.aktif ? 'bg-teal-bg text-teal-primary' : 'bg-coral-bg text-coral-dark'}`}>
      {r.aktif ? 'Ya' : 'Tidak'}
    </span>
  )},
  { key: 'createdAt', label: 'Tgl Create', render: (r) => <span className="whitespace-nowrap">{r.createdAt || '-'}</span> },
  { key: 'updatedAt', label: 'Tgl Update', render: (r) => <span className="whitespace-nowrap">{r.updatedAt || '-'}</span> },
]

const allColumns = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama' },
  { key: 'kategoriName', label: 'Kategori' },
  { key: 'merkName', label: 'Merk' },
  { key: 'jenis', label: 'Jenis' },
  { key: 'hpp', label: 'HPP' },
  { key: 'price', label: 'Harga Jual' },
  { key: 'account', label: 'Perkiraan' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'createdAt', label: 'Tgl Create' },
  { key: 'updatedAt', label: 'Tgl Update' },
]

const defaultVisible = ['code', 'name', 'kategoriName', 'jenis', 'hpp', 'price', 'aktif']

const serverSortMap: Record<string, string> = {
  code: 'code',
  name: 'name',
  hpp: 'hpp',
  jenis: 'jenis',
  aktif: 'aktif',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const filters: FilterDef[] = [
  {
    type: 'select',
    key: 'jenis',
    options: [
      { value: '', label: 'Semua Jenis' },
      { value: '1', label: 'Barang Jadi' },
      { value: '2', label: 'Bahan Baku' },
      { value: '3', label: 'Barang Setengah Jadi' },
    ],
  },
]

const columnVisibility: ColumnVisibilityDef = {
  allColumns,
  defaultVisible,
  storageKey: 'barang_list.columns.visible',
}

export default function BarangMenuPage() {
  return (
    <MasterDataList<BarangRow>
      title="Master Barang"
      basePath="/barang/menu"
      endpoint="/api/barang"
      columns={columns}
      serverSortMap={serverSortMap}
      searchPlaceholder="Cari kode/nama..."
      filters={filters}
      columnVisibility={columnVisibility}
      importConfig={{
        title: 'Import Excel Barang',
        component: ImportBarang,
      }}
      onDelete={async (id) => {
        if (!confirm('Hapus data ini? (Soft delete)')) return
        const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Gagal menghapus barang')
      }}
    />
  )
}
