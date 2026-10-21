"use client"
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef } from '@/components/master/MasterDataList'

const columns: ColumnDef<any>[] = [
  { key: 'kode', label: 'Kode', sortable: true, render: (r) => <span className="font-medium">{r.kode}</span> },
  { key: 'nama', label: 'Nama Paket', sortable: true, render: (r) => r.nama },
  { key: 'hargaJual', label: 'Harga Jual', sortable: true, align: 'right', render: (r) => `Rp ${Number(r.hargaJual || 0).toLocaleString('id-ID')}` },
  { key: 'itemCount', label: 'Jml Item', align: 'center', render: (r) => r.itemCount },
]

export default function MasterPaketPage() {
  return (
    <MasterDataList
      title="Master Paket"
      subtitle="Paket bundling barang jadi"
      basePath="/master-paket"
      endpoint="/api/master-paket"
      permissionCode="master_paket"
      columns={columns}
      showStatusColumn
      statusField="aktif"
      statusLabels={{ active: 'Aktif', inactive: 'Nonaktif' }}
      statusActiveValue={true}
      defaultSortBy="kode"
      searchPlaceholder="Cari kode atau nama paket..."
    />
  )
}
