"use client"
import ActionIcons from '@/components/ActionIcons'
import { formatCurrency } from '@/lib/regionalNumber'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { printInvoiceById } from '@/lib/printInvoice'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import TransactionalList from '@/components/ui/TransactionalList'
import type { TransactionalColumnDef, SummaryCardDef, StatusFilterDef } from '@/components/ui/TransactionalList'
import { useAksesOverride, type OverrideAction } from '@/hooks/useAksesOverride'
import ModalAksesOverride from '@/components/ModalAksesOverride'

export type SalesInvoice = {
  id: number
  transaction_number: string
  customer_name?: string
  customer_code?: string
  so_number?: string
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  payment_method: string
  status: string
  payment_status: string
  due_date?: string
  payment_terms?: string
  notes?: string
  created_at: string
  tgl_nota?: string
  void?: number
  payment_amount?: number
}

export default function SalesInvoiceList({
  items,
  onVoid,
  onRefresh,
}: {
  items: SalesInvoice[]
  onVoid: (id: number) => void
  onRefresh?: () => void
}) {
  const router = useRouter()
  const { override, setOverride, loading: aksesLoading, error: aksesError, close: closeAkses, confirm: confirmAkses } = useAksesOverride()
  const [perm, setPerm] = useState({ canCreate: false, canEdit: false, canDelete: false, canPrint: false })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const ALL_COLUMNS = [
    { key: 'transaction_number', label: 'No. Invoice' },
    { key: 'created_at', label: 'Tanggal' },
    { key: 'so_number', label: 'No. SO' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'due_date', label: 'Jatuh Tempo' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
  ]
  const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('invoice_list.columns.visible')
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length) {
          const filtered = arr.filter((k: string) => DEFAULT_VISIBLE.includes(k))
          if (filtered.length) setVisibleCols(filtered)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('invoice_list.columns.visible', JSON.stringify(visibleCols))
    } catch {}
  }, [visibleCols])

  const isVisible = (k: string) => visibleCols.includes(k)
  const toggleVisible = (k: string) => {
    setVisibleCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? (data.user.permissions as any[]) : []
        const row = perms.find(p => String(p.menu_code || '').toLowerCase().trim() === 'invoice')
        if (row) {
          setPerm({
            canCreate: Number(row.can_create) === 1,
            canEdit: Number(row.can_edit) === 1,
            canDelete: Number(row.can_delete) === 1,
            canPrint: Number(row.can_edit) === 1,
          })
        }
      } catch {}
    })()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Belum Bayar':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-800">Belum Dibayar</span>
        )
      case 'Belum Lunas':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-800">Belum Lunas</span>
        )
      case 'Lunas':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-800">Lunas</span>
        )
      case 'Void':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
        )
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  const handleImport = useCallback(async () => {
    if (!importFile) { alert('Pilih file Excel terlebih dahulu'); return }
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch('/api/invoices/import', { method: 'POST', body: fd })
      const result = await res.json()
      if (res.ok) {
        setImportResult(result)
        if (onRefresh) onRefresh()
        setTimeout(() => {
          setShowImportModal(false)
          setImportFile(null)
          setImportResult(null)
        }, 2000)
      } else {
        setImportResult({ success: false, error: result.error || 'Import gagal' })
      }
    } catch {
      setImportResult({ success: false, error: 'Terjadi kesalahan saat import' })
    } finally {
      setImporting(false)
    }
  }, [importFile, onRefresh])

  const columns: TransactionalColumnDef<SalesInvoice>[] = useMemo(() => {
    const colDefs: TransactionalColumnDef<SalesInvoice>[] = [
      {
        key: 'transaction_number',
        label: 'No. Invoice',
        sortable: true,
        render: (inv) => (
          <span className="font-medium text-slate-900">
            {inv.transaction_number}
            {(inv.void === 1 || inv.payment_status === 'Void') && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800 align-middle">Void</span>
            )}
          </span>
        ),
      },
      {
        key: 'created_at',
        label: 'Tanggal',
        sortable: true,
        render: (inv) => formatDate(inv.tgl_nota || inv.created_at),
      },
      {
        key: 'so_number',
        label: 'No. SO',
        render: (inv) => inv.so_number || '-',
      },
      {
        key: 'customer_name',
        label: 'Customer',
        sortable: true,
        render: (inv) => inv.customer_name || 'N/A',
      },
      {
        key: 'due_date',
        label: 'Jatuh Tempo',
        sortable: true,
        render: (inv) => formatDate(inv.due_date || ''),
      },
      {
        key: 'total',
        label: 'Total',
        sortable: true,
        align: 'right',
        render: (inv) => formatCurrency(inv.total || 0),
      },
      {
        key: 'status',
        label: 'Status',
        render: (inv) => inv.void === 1 || inv.payment_status === 'Void' ? (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
        ) : (
          getStatusBadge(inv.payment_status)
        ),
      },
      {
        key: 'actions',
        label: 'Aksi',
        align: 'center',
        render: (inv) => {
          const st = String(inv.payment_status || inv.status || '')
          const isVoided = inv.void === 1
          const payAmt = Number(inv.payment_amount || 0)
          const editable = !isVoided
          const doVoid = () => onVoid(inv.id)
          const doEdit = () => router.push(`/penjualan-invoice/${inv.id}/edit`)
          const doPrint = () => printInvoiceById(inv.id)
          return (
            <div className="flex items-center justify-center gap-1">
              <ActionIcons
                viewHref={`/penjualan-invoice/${inv.id}`}
                editHref={editable ? `/penjualan-invoice/${inv.id}/edit` : undefined}
                showEdit={editable}
                onVoid={editable ? doVoid : undefined}
                onPrint={doPrint}
                titleView="Lihat Detail"
                titleEdit="Edit"
                titleVoid="Void"
                titlePrint="Cetak Invoice"
                aksesOverride={{ menuCode: 'invoice', canEdit: perm.canEdit, canVoid: perm.canDelete, canPrint: perm.canPrint }}
                onAksesOverride={(action) => {
                  const titles: Record<OverrideAction, string> = { edit: 'Edit', void: 'Void', print: 'Cetak' }
                  setOverride({ open: true, menuCode: 'invoice', action, title: titles[action], onConfirmed: () => {
                    if (action === 'edit') doEdit()
                    else if (action === 'void') doVoid()
                    else doPrint()
                  }})
                }}
              />
            </div>
          )
        },
      },
    ]
    return colDefs.filter(c => c.key === 'actions' || isVisible(c.key))
  }, [perm, visibleCols, onVoid])

  const summaryCards: SummaryCardDef[] = useMemo(() => {
    const active = items.filter(inv => (inv.void !== 1 && inv.payment_status !== 'Void'))
    const pending = items.filter(inv => inv.payment_status === 'Belum Bayar')
    const completed = items.filter(inv => inv.payment_status === 'Lunas')
    return [
      { label: 'Total Invoice', value: active.length },
      { label: 'Total Nilai', value: formatCurrency(active.reduce((s, inv) => s + (inv.total || 0), 0)), valueColor: 'text-teal-primary', size: 'sm' },
      { label: 'Belum Dibayar', value: pending.length, valueColor: 'text-yellow-600', size: 'sm' },
      { label: 'Lunas', value: completed.length, valueColor: 'text-green-600' },
    ]
  }, [items])

  const statusFilter: StatusFilterDef = {
    key: 'payment_status',
    label: 'Status',
    options: [
      { value: 'all', label: 'Semua' },
      { value: 'Belum Bayar', label: 'Belum Dibayar' },
      { value: 'Belum Lunas', label: 'Belum Lunas' },
      { value: 'Lunas', label: 'Lunas' },
      { value: 'Void', label: 'Void' },
    ],
  }

  return (
    <>
      <TransactionalList
        title="Penjualan Invoice"
        subtitle="Daftar Invoice Penjualan"
        items={items}
        columns={columns}
        summaryCards={summaryCards}
        statusFilter={statusFilter}
        searchPlaceholder="No. Invoice, Customer..."
        defaultSortBy="created_at"
        defaultSortDir="desc"
        keyExtractor={(inv) => inv.id}
        isVoid={(inv) => inv.void === 1 || inv.payment_status === 'Void'}
        headerActions={
          <div className="flex gap-2">
            {perm.canCreate && (
              <button
                onClick={async () => {
                  const today = new Date().toISOString().slice(0, 10)
                  const ok = await ensurePeriodForDateOrToast(today)
                  if (!ok) return
                  window.location.href = '/penjualan-invoice/new'
                }}
                className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
              >
                + Tambah Invoice
              </button>
            )}
            <button
              onClick={() => window.open('/api/transactions/template', '_blank')}
              className="px-3 md:px-4 py-2 bg-teal-bg text-teal-primary rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
            >
              Download Template
            </button>
            {perm.canCreate && (
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
              >
                Import Excel
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowColPicker(v => !v)}
                className="px-3 md:px-4 py-2 bg-teal-bg text-teal-primary rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
              >
                Pilih Kolom
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-10">
                  <div className="text-[10px] font-bold text-slate-600 mb-2">Tampilkan Kolom</div>
                  <div className="max-h-64 overflow-auto pr-1 space-y-1">
                    {ALL_COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                        <input type="checkbox" className="accent-teal-primary" checked={visibleCols.includes(col.key)} onChange={() => toggleVisible(col.key)} />
                        <span className="text-slate-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => setShowColPicker(false)} className="text-xs px-3 py-1 rounded-pill border border-slate-200 text-slate-500 hover:bg-slate-50">Tutup</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />

      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Import Excel Invoice</h2>
            <p className="text-xs text-slate-500 mb-4">
              Upload file Excel dengan format MASTER + DETAIL sheet. Download template terlebih dahulu untuk melihat format yang benar.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-pill file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
            />
            {importResult && (
              <div className={`p-3 rounded-lg text-sm mb-4 ${importResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {importResult.success ? importResult.message || 'Import berhasil' : importResult.error || 'Import gagal'}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowImportModal(false); setImportFile(null); setImportResult(null) }}
                className="px-4 py-2 text-sm rounded-pill border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="px-4 py-2 text-sm rounded-pill bg-teal-primary text-white hover:bg-teal-dark disabled:opacity-50"
              >
                {importing ? 'Mengimport...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalAksesOverride
        open={override?.open ?? false}
        onClose={closeAkses}
        onConfirm={confirmAkses}
        title={override?.title || ''}
        loading={aksesLoading}
      />
    </>
  )
}
