"use client"
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef, FilterDef } from '@/components/master/MasterDataList'
import ImportHarga from '@/components/harga/ImportHarga'

type Row = {
  id: number
  code: string
  name: string
  jenis: number
  kategoriName: string
  totalUnits: number
  pricesSet: number
}

const columns: ColumnDef<Row>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-mono text-slate-600">{r.code}</span> },
  { key: 'name', label: 'Nama Barang', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
  { key: 'kategoriName', label: 'Kategori', sortable: false, render: (r) => r.kategoriName },
  { key: 'totalUnits', label: 'Jml Satuan', sortable: false, align: 'right', render: (r) => r.totalUnits },
  {
    key: 'pricesSet', label: 'Harga Diset', sortable: false,
    render: (r) => (
      <span className={`inline-block px-2 py-1 text-xs rounded ${r.pricesSet > 0 ? 'bg-teal-bg text-teal-dark' : 'bg-slate-100 text-slate-600'}`}>
        {r.pricesSet > 0 ? `${r.pricesSet} satuan` : 'Belum diset'}
      </span>
    ),
  },
]

const filters: FilterDef[] = [
  {
    type: 'select', key: 'jenis',
    options: [
      { value: '', label: 'Semua Jenis' },
      { value: '1', label: 'Barang Jadi' },
      { value: '2', label: 'Bahan Baku' },
      { value: '3', label: 'Barang Setengah Jadi' },
    ],
  },
  {
    type: 'select', key: 'status',
    options: [
      { value: '', label: 'Semua Status' },
      { value: 'with-price', label: 'Sudah Ada Harga' },
      { value: 'without-price', label: 'Belum Ada Harga' },
    ],
  },
]

export default function HargaPage() {
  const downloadTemplate = () => {
    const template = `Kode Barang,Satuan,Harga,Tanggal Efektif
PLT-001,pcs,1000,2025-10-14
PLT-001,lusin,10000,2025-10-14
MK-001,pcs,50000,2025-10-14`
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-import-harga.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <MasterDataList
      title="Master Harga"
      subtitle="Kelola harga jual per satuan untuk setiap barang"
      basePath="/harga"
      endpoint="/api/harga"
      columns={columns}
      serverSortMap={{ code: 'code', name: 'name' }}
      filters={filters}
      headerActions={[
        { label: 'Download Template', variant: 'outline', onClick: downloadTemplate },
      ]}
      importConfig={{ title: 'Import Harga dari Excel', component: ImportHarga }}
      permissionCode="harga"
      getViewHref={(row) => `/harga/${row.id}`}
      getEditHref={(row) => `/harga/${row.id}`}
    />
  )
}
