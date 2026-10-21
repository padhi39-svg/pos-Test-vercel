"use client"

import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef, FilterDef } from '@/components/master/MasterDataList'
import { formatCurrency } from '@/lib/regionalNumber'
import ImportBarangPembantu from '@/components/barang-pembantu/ImportBarangPembantu'

interface BarangPembantuRow {
  id: number
  code: string
  name: string
  kategoriId: number | null
  kategoriName?: string | null
  merkId: number | null
  merkName?: string | null
  hpp: number
  prices?: { price: number }[]
  aktif: boolean
}

const columns: ColumnDef<BarangPembantuRow>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama', render: (r) => r.name },
  { key: 'kategoriName', label: 'Kategori', sortable: false, render: (r) => r.kategoriName || '-' },
  { key: 'merkName', label: 'Merk', sortable: false, render: (r) => r.merkName || '-' },
  { key: 'jenis', label: 'Jenis', sortable: false, render: () => 'Barang Setengah Jadi' },
  { key: 'hpp', label: 'HPP', align: 'right', render: (r) => <span className="font-mono">{formatCurrency(r.hpp ?? 0)}</span> },
  { key: 'price', label: 'Harga Jual', sortable: false, align: 'right', render: (r) => <span className="font-mono">{formatCurrency(r.prices?.[0]?.price ?? 0)}</span> },
  { key: 'aktif', label: 'Aktif', render: (r) => (
    <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full ${r.aktif ? 'bg-teal-bg text-teal-primary' : 'bg-coral-bg text-coral-dark'}`}>
      {r.aktif ? 'Ya' : 'Tidak'}
    </span>
  )},
]

export default function BarangPembantuPage() {
  return (
    <MasterDataList<BarangPembantuRow>
      title="Master Barang Setengah Jadi"
      basePath="/master/barang-pembantu"
      endpoint="/api/barang"
      columns={columns}
      staticParams={{ jenis: '3' }}
      showStatusColumn
      statusField="aktif"
      statusLabels={{ active: 'Ya', inactive: 'Tidak' }}
      searchPlaceholder="Cari kode/nama..."
      importConfig={{
        title: 'Import Excel Barang Pembantu',
        component: ImportBarangPembantu,
      }}
      onDelete={async (id) => {
        if (!confirm('Hapus barang pembantu ini?')) return
        const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Gagal menghapus barang pembantu')
      }}
    />
  )
}
