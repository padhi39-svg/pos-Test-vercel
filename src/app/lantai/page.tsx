"use client"
import { useState } from 'react'
import MasterDataList from '@/components/master/MasterDataList'
import type { ColumnDef, HeaderActionDef, ImportConfigDef } from '@/components/master/MasterDataList'
import ImportLantai from '@/components/lantai/ImportLantai'

const columns: ColumnDef<any>[] = [
  { key: 'code', label: 'Kode', sortable: true, render: (r) => <span className="font-medium">{r.code}</span> },
  { key: 'name', label: 'Nama', sortable: true, render: (r) => r.name },
  { key: 'levelNo', label: 'Urutan', sortable: true, align: 'center', render: (r) => r.levelNo ?? '-' },
]

export default function FloorsPage(){
  const [showImport, setShowImport] = useState(false)

  const importConfig: ImportConfigDef = {
    title: 'Import Lantai (Excel)',
    component: ({ onDone }) => (
      <ImportLantai onDone={onDone} />
    ),
  }

  return (
    <>
      <MasterDataList
        title="Master Lantai"
        subtitle="Kelola data lantai"
        basePath="/lantai"
        endpoint="/api/floors"
        permissionCode="lantai"
        columns={columns}
        showStatusColumn
        statusField="isActive"
        statusActiveValue={1}
        defaultSortBy="name"
        serverSortMap={{ code: 'code', name: 'name', levelNo: 'levelNo', isActive: 'isActive' }}
        importConfig={importConfig}
        onDelete={async (id) => {
          const res = await fetch(`/api/floors?id=${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Gagal menghapus lantai')
        }}
      />
    </>
  )
}
