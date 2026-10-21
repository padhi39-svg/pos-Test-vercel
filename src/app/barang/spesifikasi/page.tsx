"use client"
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef } from '@/components/master/MasterDataList'

type Row = {
  id: number
  code: string
  name: string
}

const columns: ColumnDef<Row>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-mono text-slate-600">{r.code}</span> },
  { key: 'name', label: 'Nama', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
]

export default function BarangSpesifikasiPage() {
  return (
    <MasterDataList
      title="Master Spesifikasi"
      subtitle="Kelola data spesifikasi barang"
      basePath="/barang/spesifikasi"
      endpoint="/api/spesifikasi"
      columns={columns}
      serverSortMap={{ code: 'code', name: 'name' }}
      permissionCode="spesifikasi"
      onDelete={async (id) => {
        const res = await fetch(`/api/spesifikasi/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Gagal menghapus spesifikasi')
        }
      }}
    />
  )
}
