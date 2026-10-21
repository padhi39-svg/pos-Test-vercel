"use client"
import { useState, useEffect } from 'react'
import SalesList from '@/components/sales/SalesList'

type Transaction = {
  id: number
  transaction_number: string
  customer_id: number | null
  customer_name: string | null
  customer_code: string | null
  subtotal: number
  discount_percent: number
  discount_amount: number
  ppn_percent: number
  ppn_amount: number
  total: number
  payment_method: string
  payment_amount: number
  change_amount: number
  card_number: string | null
  bank_id: number | null
  void: number
  status: string
  transaction_type: number
  created_at: string
}

export default function SalesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(true)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [canCreateList, setCanCreateList] = useState(false)
  const [canEditList, setCanEditList] = useState(false)
  const [canVoidList, setCanVoidList] = useState(false)
  const [canPrintList, setCanPrintList] = useState(false)
  const [canImportList, setCanImportList] = useState(false)

  useEffect(() => {
    // Try load saved filter; otherwise default to this month
    try {
      const s = localStorage.getItem('sales_filter_start') || ''
      const e = localStorage.getItem('sales_filter_end') || ''
      if (s && e) {
        setStartDate(s)
        setEndDate(e)
        setFilterOpen(false)
        loadTransactions(s, e)
        return
      }
    } catch {}
    // default: open modal and prefill current month
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const first = `${y}-${m}-01`
    const last = new Date(y, now.getMonth() + 1, 0).getDate()
    const lastStr = `${y}-${m}-${String(last).padStart(2, '0')}`
    setStartDate(first)
    setEndDate(lastStr)
    // Don't block UI with Loading when waiting user to pick dates
    setLoading(false)
  }, [])

  // Load permission List Penjualan (menu_code: 'sales_list') dari /api/auth/me
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const perms = Array.isArray(data?.user?.permissions) ? (data.user.permissions as any[]) : []
        const dynPerms = Array.isArray(data?.user?.dynamicPermissions) ? (data.user.dynamicPermissions as any[]) : []
        const row = perms.find(p => String(p.menu_code || '').toLowerCase().trim() === 'sales_list') as any | undefined
        setCanCreateList(Number(row?.can_create) === 1)
        setCanEditList(Number(row?.can_edit) === 1)
        setCanVoidList(Number(row?.can_delete) === 1)

        const importRow = dynPerms.find(p =>
          String(p.menu_code || '').toLowerCase().trim() === 'sales_list' &&
          String(p.permission_code || '').toUpperCase().trim() === 'IMPORT'
        ) as any | undefined
        setCanImportList(Number(importRow?.allowed) === 1)

        const printRow = dynPerms.find(p =>
          String(p.menu_code || '').toLowerCase().trim() === 'sales_list' &&
          String(p.permission_code || '').toUpperCase().trim() === 'PRINT'
        ) as any | undefined
        setCanPrintList(Number(printRow?.allowed) === 1)
      } catch {
        setCanEditList(false)
      }
    })()
  }, [])

  const loadTransactions = async (s?: string, e?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ _: String(Date.now()) })
      if (s) params.set('startDate', s)
      if (e) params.set('endDate', e)
      const response = await fetch(`/api/transactions?${params.toString()}` , { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setTransactions(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const handleVoid = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan transaksi ini?')) return
    
    try {
      const response = await fetch(`/api/transactions/${id}/void`, {
        method: 'PUT'
      })
      
      if (response.ok) {
        alert('Transaksi berhasil dibatalkan')
        loadTransactions()
      } else {
        alert('Gagal membatalkan transaksi')
      }
    } catch (error) {
      console.error('Error voiding transaction:', error)
      alert('Terjadi kesalahan')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading...</div>
      </div>
    )
  }

  const fmtID = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <>
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <h2 className="text-lg font-semibold mb-3">Filter Tanggal List Penjualan</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Tanggal Awal (dd/mm/yyyy)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Tanggal Akhir (dd/mm/yyyy)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-3 py-1.5 rounded-lg border"
                  onClick={() => {
                    // keep modal open but reset to this month
                    const now = new Date()
                    const y = now.getFullYear()
                    const m = String(now.getMonth() + 1).padStart(2, '0')
                    const first = `${y}-${m}-01`
                    const last = new Date(y, now.getMonth() + 1, 0).getDate()
                    const lastStr = `${y}-${m}-${String(last).padStart(2, '0')}`
                    setStartDate(first)
                    setEndDate(lastStr)
                  }}
                >Bulan ini</button>
                <button
                  className="px-3 py-1.5 rounded-pill bg-teal-primary text-white"
                  onClick={() => {
                    if (!startDate || !endDate) return alert('Pilih tanggal awal dan akhir')
                    if (startDate > endDate) return alert('Tanggal awal tidak boleh melebihi tanggal akhir')
                    try {
                      localStorage.setItem('sales_filter_start', startDate)
                      localStorage.setItem('sales_filter_end', endDate)
                    } catch {}
                    setFilterOpen(false)
                    loadTransactions(startDate, endDate)
                  }}
                >Tampilkan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!filterOpen && (
        <div className="px-3 py-0.5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">Periode: {fmtID(startDate)} s/d {fmtID(endDate)}</div>
            <button
              className="px-2 py-0 text-xs rounded-lg border"
              onClick={() => setFilterOpen(true)}
            >Ubah Filter</button>
          </div>
        </div>
      )}

      <SalesList 
        items={transactions}
        onVoid={handleVoid}
        onRefresh={() => loadTransactions(startDate, endDate)}
        canCreate={canCreateList}
        canEdit={canEditList}
        canVoid={canVoidList}
        canPrint={canPrintList}
        canImport={canImportList}
      />
    </>
  )
}
