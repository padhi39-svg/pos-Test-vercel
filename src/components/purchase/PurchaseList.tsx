"use client"
import ActionIcons from '@/components/ActionIcons'
import { formatCurrency } from '@/lib/regionalNumber'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { printPurchaseById } from '@/lib/printPurchase'
import { ensurePeriodForDateOrToast } from '@/lib/periodGuard'
import TransactionalList from '@/components/ui/TransactionalList'
import type { TransactionalColumnDef, SummaryCardDef, StatusFilterDef } from '@/components/ui/TransactionalList'
import { useAksesOverride, type OverrideAction } from '@/hooks/useAksesOverride'
import ModalAksesOverride from '@/components/ModalAksesOverride'

export type Purchase = {
  id: number
  purchase_number: string
  supplier_id: number | null
  supplier_name: string | null
  purchase_date: string
  invoice_number: string | null
  expected_date: string | null
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  payment_status: string
  status: string
  void: number
  notes: string | null
  faktur_pajak: string | null
  ap_payment_count?: number
  created_at: string
}

export default function PurchaseList({
  items,
  onVoid,
  onRefresh,
  isReturn = false,
}: {
  items: Purchase[]
  onVoid: (id: number) => void
  onRefresh?: () => void
  isReturn?: boolean
}) {
  const router = useRouter()
  const { override, setOverride, loading: aksesLoading, error: aksesError, close: closeAkses, confirm: confirmAkses } = useAksesOverride()
  const [canEdit, setCanEdit] = useState(false)
  const [canVoid, setCanVoid] = useState(false)
  const [showImportExcel, setShowImportExcel] = useState(false)
  const [importExcelFile, setImportExcelFile] = useState<File | null>(null)
  const [importingExcel, setImportingExcel] = useState(false)
  const [importExcelResult, setImportExcelResult] = useState<any>(null)

  useEffect(() => {
    const loadPerm = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return
        const me = await res.json().catch(() => ({}))
        const perms = (me?.user?.permissions || []) as any[]
        const purchasePerm = perms.find((p) => String(p?.menu_code || '').toLowerCase() === 'purchase')
        setCanEdit(Number(purchasePerm?.can_edit || 0) === 1)
        setCanVoid(Number(purchasePerm?.can_delete || 0) === 1)
      } catch {}
    }
    loadPerm()
  }, [])

  const handleImportExcel = useCallback(async () => {
    if (!importExcelFile) { alert('Pilih file Excel terlebih dahulu'); return }
    setImportingExcel(true)
    setImportExcelResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importExcelFile)
      const res = await fetch('/api/purchases/import-excel', { method: 'POST', body: fd })
      const result = await res.json()
      if (res.ok) {
        setImportExcelResult(result)
        if (onRefresh) onRefresh()
        const successCount = (result.results || []).filter((r: any) => r.success).length
        if (successCount > 0) {
          setTimeout(() => { setShowImportExcel(false); setImportExcelFile(null); setImportExcelResult(null) }, 3000)
        }
      } else {
        setImportExcelResult({ success: false, error: result.error || 'Import gagal' })
      }
    } catch { setImportExcelResult({ success: false, error: 'Terjadi kesalahan saat import' })
    } finally { setImportingExcel(false) }
  }, [importExcelFile, onRefresh])

  const columns: TransactionalColumnDef<Purchase>[] = useMemo(() => [
    {
      key: 'purchase_number',
      label: 'No. Pembelian',
      sortable: true,
      render: (p) => (
        <span className="font-medium text-slate-900">
          {p.purchase_number}
          {p.void === 1 && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800 align-middle">Void</span>
          )}
        </span>
      ),
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      sortable: true,
      render: (p) => p.supplier_name || '-',
    },
    {
      key: 'purchase_date',
      label: 'Tgl Pembelian',
      sortable: true,
      render: (p) => p.purchase_date,
    },
    { key: 'invoice_number', label: 'Kode Nota', render: (p) => p.invoice_number || '-' },
    { key: 'faktur_pajak', label: 'Faktur Pajak', render: (p) => p.faktur_pajak || '-' },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      align: 'right',
      render: (p) => formatCurrency(p.total || 0),
    },
    {
      key: 'payment_status',
      label: 'Status',
      render: (p) => p.void === 1 ? (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-100 text-pink-800">Void</span>
      ) : (
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
          p.payment_status === 'Belum Bayar' ? 'bg-red-100 text-red-800' :
          p.payment_status === 'Belum Lunas' ? 'bg-yellow-100 text-yellow-800' :
          p.payment_status === 'Lunas' ? 'bg-green-100 text-green-800' :
          'bg-slate-100 text-slate-800'
        }`}>{p.payment_status}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'center',
      render: (p) => {
        const hasPayment = Number((p as any).ap_payment_count || 0) > 0
        return (
          <div className="flex items-center gap-1">
            <ActionIcons
              viewHref={`${isReturn ? '/pembelian/retur' : '/pembelian/purchase'}/${p.id}`}
              editHref={p.void !== 1 && !hasPayment ? `${isReturn ? '/pembelian/retur' : '/pembelian/purchase'}/${p.id}/edit` : undefined}
              showEdit={p.void !== 1 && !hasPayment}
              onVoid={p.void !== 1 && !hasPayment ? () => onVoid(p.id) : undefined}
              titleView="Lihat Detail"
              titleEdit="Edit"
              titleVoid="Void"
              onPrint={() => printPurchaseById(p.id)}
              titlePrint="Cetak Pembelian"
              aksesOverride={{ menuCode: 'purchase', canEdit, canVoid, canPrint: true }}
              onAksesOverride={(action) => {
                const titles: Record<OverrideAction, string> = { edit: 'Edit', void: 'Void', print: 'Cetak' }
                setOverride({ open: true, menuCode: 'purchase', action, title: titles[action], onConfirmed: () => {
                  if (action === 'edit') router.push(`${isReturn ? '/pembelian/retur' : '/pembelian/purchase'}/${p.id}/edit`)
                  else if (action === 'void') onVoid(p.id)
                  else printPurchaseById(p.id)
                }})
              }}
            />
          </div>
        )
      },
    },
  ], [canEdit, canVoid, isReturn, onVoid, router, setOverride])

  const summaryCards: SummaryCardDef[] = useMemo(() => {
    const active = items.filter(t => t.void !== 1)
    return [
      { label: 'Total Pembelian', value: active.length },
      { label: 'Total Nilai', value: formatCurrency(active.reduce((sum, t) => sum + (t.total || 0), 0)), valueColor: 'text-teal-primary', size: 'sm' },
      { label: 'Total Diskon', value: formatCurrency(active.reduce((sum, t) => sum + (t.discount_amount || 0), 0)), valueColor: 'text-red-600', size: 'sm' },
      { label: 'Pembelian Void', value: items.filter(t => t.void === 1).length },
    ]
  }, [items])

  const statusFilter: StatusFilterDef = {
    key: 'payment_status',
    label: 'Status',
    options: [
      { value: 'all', label: 'Semua' },
      { value: 'Belum Bayar', label: 'Belum Bayar' },
      { value: 'Belum Lunas', label: 'Belum Lunas' },
      { value: 'Lunas', label: 'Lunas' },
    ],
  }

  return (
    <>
      <TransactionalList
        title={isReturn ? 'Retur Pembelian' : 'Pembelian'}
        subtitle={isReturn ? 'Daftar Retur Pembelian' : 'Daftar Pembelian (Penerimaan Barang)'}
        items={items}
        columns={columns}
        summaryCards={summaryCards}
        statusFilter={statusFilter}
        searchPlaceholder="No. Pembelian, Supplier..."
        defaultSortBy="purchase_date"
        defaultSortDir="desc"
        keyExtractor={(p) => p.id}
        isVoid={(p) => p.void === 1}
        headerActions={
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const today = new Date().toISOString().slice(0, 10)
                const ok = await ensurePeriodForDateOrToast(today)
                if (!ok) return
                window.location.href = isReturn ? '/pembelian/retur/new' : '/pembelian/purchase/new'
              }}
              className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
            >
              {isReturn ? '+ Retur Baru' : '+ Pembelian Baru'}
            </button>
            {!isReturn && (
              <>
                <button
                  onClick={() => window.open('/api/purchases/template', '_blank')}
                  className="px-3 md:px-4 py-2 bg-teal-bg text-teal-primary rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
                >
                  Download Template
                </button>
                <button
                  onClick={() => window.open('/api/purchases/template-excel', '_blank')}
                  className="px-3 md:px-4 py-2 bg-teal-bg text-teal-primary rounded-pill hover:bg-teal-bg transition-colors text-xs md:text-sm"
                >
                  Template Excel (2 Sheet)
                </button>
                <button
                  onClick={() => setShowImportExcel(true)}
                  className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-colors text-xs md:text-sm"
                >
                  Import Excel
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Import Excel Modal */}
      {showImportExcel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Import Excel Pembelian</h2>
            <p className="text-xs text-slate-500 mb-4">
              Upload file Excel dengan format MASTER + DETAIL sheet. Download template terlebih dahulu untuk melihat format yang benar.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportExcelFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-pill file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
            />
            {importExcelResult && (
              <div className={`p-3 rounded-lg text-sm mb-4 ${importExcelResult.success ? (importExcelResult.success === true ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700') : 'bg-red-50 text-red-700'}`}>
                {importExcelResult.message || importExcelResult.error}
                {importExcelResult.results && importExcelResult.results.length > 5 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-semibold">Detail</summary>
                    <ul className="mt-1 max-h-40 overflow-y-auto space-y-1">
                      {importExcelResult.results.map((r: any, idx: number) => (
                        <li key={idx} className={`text-xs ${r.success ? '' : 'text-red-600'}`}>
                          Row {r.row}: {r.success ? r.purchase : r.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowImportExcel(false); setImportExcelFile(null); setImportExcelResult(null) }}
                className="px-4 py-2 text-sm rounded-pill border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                onClick={handleImportExcel}
                disabled={!importExcelFile || importingExcel}
                className="px-4 py-2 text-sm rounded-pill bg-teal-primary text-white hover:bg-teal-dark disabled:opacity-50"
              >
                {importingExcel ? 'Mengimport...' : 'Import'}
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
