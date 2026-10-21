"use client"
import { useMemo } from 'react'
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef } from '@/components/master/MasterDataList'

const columns: ColumnDef<any>[] = [
  { key: 'name', label: 'Bank', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'ownerName', label: 'Pemilik Rekening', sortable: true, render: (r) => r.ownerName || '-' },
  { key: 'accountNumber', label: 'No. Rekening', sortable: true, render: (r) => r.accountNumber || '-' },
  { key: 'perkiraan', label: 'Perkiraan', render: (r) => {
    const code = r.accountCode || r.account_code
    const name = r.accountName || r.account_name
    return code ? `${code} - ${name || ''}` : '-'
  }},
]

export default function BankListPage() {
  return (
    <MasterDataList
      title="Master Bank"
      subtitle="Kelola data bank"
      basePath="/bank"
      endpoint="/api/banks"
      permissionCode="bank"
      columns={columns}
      defaultSortBy="id"
      defaultSortDir="desc"
      serverSortMap={{ name: 'name', ownerName: 'ownerName', accountNumber: 'accountNumber' }}
      onDelete={async (id) => {
        const res = await fetch(`/api/banks?id=${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Gagal menghapus bank')
      }}
    />
  )
}
