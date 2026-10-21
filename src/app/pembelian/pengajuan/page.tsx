"use client"
import { useEffect, useState, useMemo, useCallback } from 'react'
import TransactionalList from '@/components/ui/TransactionalList'
import type { TransactionalColumnDef, SummaryCardDef, StatusFilterDef } from '@/components/ui/TransactionalList'
import ActionIcons from '@/components/ActionIcons'
import Button from '@/components/ui/Button'
import PageLoading from '@/components/ui/PageLoading'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import { useRouter } from 'next/navigation'

export default function PurchaseRequestsPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalRow, setModalRow] = useState<any | null>(null)
  const [modalAction, setModalAction] = useState<'approve' | 'unapprove'>('approve')
  const [modalLoading, setModalLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchase-requests', { cache: 'no-store' })
      const data = await res.json().catch(() => [])
      setItems(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin void pengajuan ini?')) return
    try {
      const res = await fetch(`/api/purchase-requests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ void: 1 }) })
      if (!res.ok) throw new Error('Gagal void')
      load()
    } catch (e) { alert('Gagal void') }
  }

  const columns: TransactionalColumnDef<any>[] = useMemo(() => [
    {
      key: 'request_number',
      label: 'No. PR',
      sortable: true,
      render: (row) => <span className="font-medium text-slate-900">{row.request_number}</span>,
    },
    {
      key: 'requester_name',
      label: 'Peminta',
      sortable: true,
      render: (row) => row.requester_name || '-',
    },
    {
      key: 'request_date',
      label: 'Tanggal',
      render: (row) => row.request_date,
    },
    {
      key: 'items_count',
      label: 'Item',
      align: 'center',
      render: (row) => row.items?.length ?? row.items_count ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => {
        if (row.void === 1) return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
        if (row.status === 'approved') return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">Approved</span>
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-700">Draft</span>
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            title={row.status === 'approved' ? 'Unapprove' : 'Approve'}
            onClick={() => {
              if (row.void === 1) return
              setModalRow(row)
              setModalAction(row.status === 'approved' ? 'unapprove' : 'approve')
              setModalOpen(true)
            }}
            className={`h-6 w-6 grid place-items-center rounded border ${row.status === 'approved' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-slate-300 text-slate-600'} hover:bg-slate-100`}
          >
            {row.status === 'approved' ? '✓' : ''}
          </button>
          <ActionIcons
            viewHref={`/pembelian/pengajuan/${row.id}`}
            editHref={`/pembelian/pengajuan/${row.id}/edit`}
            showEdit={row.void !== 1}
            onVoid={row.void !== 1 ? () => handleVoid(row.id) : undefined}
            disabledVoid={row.void === 1}
            titleView="Lihat Detail"
            titleEdit="Edit"
            titleVoid="Void"
            onPrint={() => window.print()}
            titlePrint="Cetak"
          />
        </div>
      ),
    },
  ], [handleVoid])

  const statusFilter: StatusFilterDef = {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'all', label: 'Semua' },
      { value: 'draft', label: 'Draft' },
      { value: 'approved', label: 'Approved' },
    ],
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-3">
      <TransactionalList
        title="Pengajuan Pembelian"
        subtitle="Daftar pengajuan tanpa harga"
        items={items}
        columns={columns}
        summaryCards={[]}
        statusFilter={statusFilter}
        searchPlaceholder="No. PR, Peminta..."
        defaultSortBy="created_at"
        defaultSortDir="desc"
        keyExtractor={(row) => row.id}
        isVoid={(row) => row.void === 1}
        headerActions={
          <Button
            onClick={async () => {
              const today = new Date().toISOString().slice(0, 10)
              const ok = await ensurePeriodForDateOrToast(today)
              if (!ok) return
              router.push('/pembelian/pengajuan/new')
            }}
          >
            + Pengajuan Baru
          </Button>
        }
      />

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl max-w-sm w-full mx-4">
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <div className="font-medium text-sm">Konfirmasi</div>
              <button onClick={() => !modalLoading && setModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Tutup</button>
            </div>
            <div className="p-3 text-sm text-slate-700">
              {modalAction === 'approve' ? 'Pengajuan akan di-approve. Lanjutkan?' : 'Apakah pengajuan akan di-unapprove?'}
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={modalLoading}>Batal</Button>
              <Button
                type="button"
                disabled={modalLoading}
                onClick={async () => {
                  if (!modalRow) return
                  try {
                    setModalLoading(true)
                    const nextStatus = modalAction === 'approve' ? 'approved' : 'draft'
                    const res = await fetch(`/api/purchase-requests/${modalRow.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) })
                    if (!res.ok) throw new Error('Gagal mengubah status')
                    setModalOpen(false)
                    load()
                  } catch { alert('Gagal mengubah status') }
                  finally { setModalLoading(false) }
                }}
              >
                {modalLoading ? 'Memproses...' : (modalAction === 'approve' ? 'Ya, Approve' : 'Ya, Unapprove')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
