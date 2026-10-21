"use client"
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef } from '@/components/master/MasterDataList'
import ImportKategori from '@/components/kategori/ImportKategori'

type Row = {
  id: number
  code: string
  name: string
  print_display: string
}

const columns: ColumnDef<Row>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-mono text-slate-600">{r.code}</span> },
  { key: 'name', label: 'Nama', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
  { key: 'print_display', label: 'Print', sortable: false, render: (r) => r.print_display },
]

export default function BarangKategoriPage() {
  return (
    <MasterDataList
      title="Master Kategori"
      subtitle="Kelola data kategori barang"
      basePath="/barang/kategori"
      endpoint="/api/kategori"
      columns={columns}
      serverSortMap={{ code: 'code', name: 'name' }}
      permissionCode="kategori"
      importConfig={{ title: 'Import Excel Kategori', component: ImportKategori }}
      onDelete={async (id) => {
        const res = await fetch(`/api/kategori/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Gagal menghapus kategori')
        }
      }}
    />
  )
}
