"use client"
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef } from '@/components/master/MasterDataList'

const columns: ColumnDef<any>[] = [
  { key: 'code', label: 'Kode', sortable: true, render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama', sortable: true, render: (r) => r.name },
]

export default function GudangPage() {
  return (
    <MasterDataList
      title="Master Gudang"
      subtitle="Kelola data gudang"
      basePath="/gudang"
      endpoint="/api/gudang"
      permissionCode="gudang"
      columns={columns}
      showStatusColumn
      statusField="is_active"
      defaultSortBy="code"
      searchPlaceholder="Cari kode atau nama gudang..."
      onDelete={async (id) => {
        const res = await fetch(`/api/gudang?id=${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Gagal menghapus gudang')
      }}
    />
  )
}
