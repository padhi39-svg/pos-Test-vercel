"use client"

import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef } from '@/components/master/MasterDataList'
import ImportSupplier from '@/components/supplier/ImportSupplier'

interface SupplierRow {
  id: number
  code: string
  name: string
  address: string
  phone: string
  discount_percent: number
  term: number
}

const columns: ColumnDef<SupplierRow>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama', render: (r) => r.name },
  { key: 'address', label: 'Alamat', render: (r) => r.address },
  { key: 'phone', label: 'No. Telp', render: (r) => r.phone },
  { key: 'discount_percent', label: 'Diskon %', render: (r) => Number(r.discount_percent || 0).toFixed(2) },
  {
    key: 'term', label: 'Term (Hari)', render: (r) =>
      r.term === 0
        ? <span className="text-teal-primary font-medium">Cash</span>
        : <span>{r.term} hari</span>,
  },
]

export default function SupplierListPage() {
  return (
    <MasterDataList
      title="Master Supplier"
      subtitle="Kelola data pemasok"
      basePath="/supplier"
      endpoint="/api/supplier"
      permissionCode="supplier"
      columns={columns}
      searchPlaceholder="Cari kode/nama/no.telp..."
      sessionStorageKey="supplier_query"
      importConfig={{
        title: 'Import Supplier dari Excel',
        component: ImportSupplier,
      }}
    />
  )
}
