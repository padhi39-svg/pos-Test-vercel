"use client"

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef, HeaderActionDef } from '@/components/master/MasterDataList'
import ImportModal from '@/components/ImportModal'

interface SalesRow {
  id: number
  code: string
  name: string
  user_id: number | null
  phone: string
  email: string
  ktp: string
  aktif: number
}

const columns: ColumnDef<SalesRow>[] = [
  { key: 'code', label: 'Kode', render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama Sales', render: (r) => r.name },
  { key: 'user_id', label: 'User ID', render: (r) => r.user_id ?? '-' },
  { key: 'phone', label: 'Telp', render: (r) => r.phone },
  { key: 'email', label: 'Email', render: (r) => r.email },
  { key: 'ktp', label: 'KTP', render: (r) => r.ktp },
]

export default function SalesMasterPage() {
  const [showImport, setShowImport] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDownloadTemplate = () => {
    const headers = ['Nama', 'User ID', 'Phone', 'Email', 'KTP']
    const sample = [
      ['Andi Salesman', '101', '081234567890', 'andi@company.com', '3201011234567890'],
      ['Budi Sales', '102', '082345678901', 'budi@company.com', '3201022345678901'],
      ['Cahaya Sales', '103', '083456789012', 'cahayasales@company.com', '3201033456789012'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'Template_Master_Sales.xlsx')
  }

  const handleImport = async (data: any[]) => {
    const res = await fetch('/api/sales/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    const result = await res.json()
    if (res.ok) {
      setRefreshKey(k => k + 1)
      return { success: true, message: result.message || 'Import berhasil' }
    }
    return { success: false, message: result.error || 'Import gagal' }
  }

  const headerActions: HeaderActionDef[] = [
    {
      label: 'Download Template',
      variant: 'outline',
      onClick: handleDownloadTemplate,
    },
    {
      label: 'Import Excel',
      variant: 'outline',
      onClick: () => setShowImport(true),
    },
  ]

  return (
    <>
      <MasterDataList
        key={refreshKey}
        title="Master Sales"
        subtitle="Kelola data sales"
        basePath="/sales-master"
        endpoint="/api/sales"
        columns={columns}
        defaultSortBy="code"
        searchPlaceholder="Cari kode/nama..."
        headerActions={headerActions}
        showStatusColumn
        statusField="aktif"
        statusActiveValue={1}
        statusLabels={{ active: 'Aktif', inactive: 'Nonaktif' }}
      />

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        title="Import Master Sales (Excel)"
        sampleColumns={['Nama', 'User ID', 'Phone', 'Email', 'KTP']}
      />
    </>
  )
}
