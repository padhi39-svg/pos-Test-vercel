"use client"
import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import FormHeader from '@/components/ui/FormHeader'
import SearchableSelect from '@/components/ui/SearchableSelect'
import type { SearchableSelectOption } from '@/components/ui/SearchableSelect'
import { formatNumberID, numKeyDown } from '@/lib/formatNumber'
import PartyPickerModal, { type Party, type PartyType } from './PartyPickerModal'
import InvoicePickerModal, { type InvoicePick, type PaymentType } from './InvoicePickerModal'
import MethodPickerModal, { type MethodPick } from './MethodPickerModal'
import AccountPickerModal from './AccountPickerModal'

export type PaymentFormMode = 'new' | 'edit' | 'view'

export type MethodPickFull = MethodPick & { notes?: string }

export type ExtraLine = {
  temp_id: string
  account_id: number
  account_code: string
  account_name: string
  notes?: string
  debit: number
  credit: number
}

export type PaymentFormInitial = {
  paymentNumber?: string
  paymentDate: string
  partyId: number | ''
  partyName: string
  notes?: string
  status?: string
  detail: InvoicePick[]
  methods: MethodPickFull[]
  extras: ExtraLine[]
}

type Config = {
  type: PaymentType
  partyType: PartyType
  partyLabel: string
  partySingular: string
  basePath: string
  permissionKey: string
  apiSave: string
  apiUpdate: (id: number) => string
  apiOutstanding: (partyId: number) => string
  advanceSourceType: string
  returSourceType: string
  returSign: number
  detailDetailKey: 'saleId' | 'purchaseId'
  detailOtherKey: 'sourceType' | 'sourceId'
  fieldName: 'partyId' | 'supplierId' | 'customerId'
  pageTitle: { new: string; edit: string; view: string }
  returText: string
  overpayToText: string
  printFunction: () => Promise<void>
}

const CONFIG_AR: Config = {
  type: 'ar',
  partyType: 'customer',
  partyLabel: 'Customer',
  partySingular: 'customer',
  basePath: '/keuangan/pembayaran-piutang',
  permissionKey: 'keu_pembayaran_piutang',
  apiSave: '/api/ar-payments',
  apiUpdate: (id) => `/api/ar-payments/${id}`,
  apiOutstanding: (id) => `/api/ar-payments/outstanding?customer_id=${id}`,
  advanceSourceType: 'ar_advance',
  returSourceType: 'sales_return',
  returSign: -1,
  detailDetailKey: 'saleId',
  detailOtherKey: 'sourceId',
  fieldName: 'customerId',
  pageTitle: { new: 'Pembayaran Piutang - Baru', edit: 'Edit Pembayaran Piutang', view: 'Detail Pembayaran Piutang' },
  returText: '(Retur)',
  overpayToText: 'Uang Muka Customer',
  printFunction: async () => { const m = await import('@/lib/printArPayment'); await (m as any).printArPayment((window as any).__printId) },
}

const CONFIG_AP: Config = {
  type: 'ap',
  partyType: 'supplier',
  partyLabel: 'Supplier',
  partySingular: 'supplier',
  basePath: '/keuangan/pembayaran-hutang',
  permissionKey: 'keu_pembayaran_hutang',
  apiSave: '/api/ap-payments',
  apiUpdate: (id) => `/api/ap-payments/${id}`,
  apiOutstanding: (id) => `/api/ap-payments/outstanding?supplier_id=${id}`,
  advanceSourceType: 'ap_advance',
  returSourceType: 'purchase_return',
  returSign: -1,
  detailDetailKey: 'purchaseId',
  detailOtherKey: 'sourceId',
  fieldName: 'supplierId',
  pageTitle: { new: 'Pembayaran Hutang - Baru', edit: 'Edit Pembayaran Hutang', view: 'Detail Pembayaran Hutang' },
  returText: '(Retur)',
  overpayToText: 'Uang Muka Supplier',
  printFunction: async () => { const m = await import('@/lib/printApPayment'); await (m as any).printApPayment((window as any).__printId) },
}

export default function PaymentEntryForm({
  type,
  mode,
  paymentId,
  initial,
  onSaved,
}: {
  type: PaymentType
  mode: PaymentFormMode
  paymentId?: number
  initial?: PaymentFormInitial
  onSaved?: (info: { id: number; paymentNumber: string }) => void
}) {
  const cfg = type === 'ar' ? CONFIG_AR : CONFIG_AP
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const headerDisabled = isView || isEdit

  const [partyId, setPartyId] = useState<number | ''>(initial?.partyId ?? ('' as any))
  const [partyName, setPartyName] = useState<string>(initial?.partyName ?? '')
  const [paymentDate, setPaymentDate] = useState<string>(initial?.paymentDate ?? new Date().toISOString().slice(0, 10))
  const [allowBackdate, setAllowBackdate] = useState(true)
  const [paymentNumber, setPaymentNumber] = useState<string>(initial?.paymentNumber ?? '')
  const [notes, setNotes] = useState<string>(initial?.notes ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? '')

  const [detail, setDetail] = useState<InvoicePick[]>(initial?.detail ?? [])
  const [methods, setMethods] = useState<MethodPickFull[]>(initial?.methods ?? [])
  const [extras, setExtras] = useState<ExtraLine[]>(initial?.extras ?? [])
  const [advanceBalance, setAdvanceBalance] = useState(0)

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showMethodModal, setShowMethodModal] = useState(false)
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [showPartyModal, setShowPartyModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(paymentId ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [accountOptions, setAccountOptions] = useState<SearchableSelectOption[]>([])
  const [accountsMap, setAccountsMap] = useState<Record<number, { code: string; name: string }>>({})
  const [kasBankOptions, setKasBankOptions] = useState<SearchableSelectOption[]>([])
  const [kasBankMap, setKasBankMap] = useState<Record<number, { code: string; name: string }>>({})

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      setAllowBackdate(d.backdate_permissions?.[cfg.permissionKey] ?? d.allow_backdate === true)
    }).catch(() => setAllowBackdate(false))
  }, [cfg.permissionKey])

  useEffect(() => {
    if (!allowBackdate) {
      const today = new Date().toISOString().slice(0, 10)
      if (paymentDate !== today) setPaymentDate(today)
    }
  }, [allowBackdate])

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/accounts?filter=kas_bank').then((r) => r.json()),
    ]).then(([allData, kbData]) => {
      const allList = Array.isArray(allData) ? allData : []
      const allMap: Record<number, { code: string; name: string }> = {}
      const allOpts: SearchableSelectOption[] = allList.map((a: any) => {
        allMap[a.id] = { code: a.code, name: a.name }
        return { value: a.id, label: `${a.code} - ${a.name}` }
      })
      setAccountsMap(allMap)
      setAccountOptions(allOpts)

      const kbList = Array.isArray(kbData) ? kbData : []
      const kbMap: Record<number, { code: string; name: string }> = {}
      const kbOpts: SearchableSelectOption[] = kbList.map((a: any) => {
        kbMap[a.id] = { code: a.code, name: a.name }
        return { value: a.id, label: `${a.code} - ${a.name}` }
      })
      setKasBankMap(kbMap)
      setKasBankOptions(kbOpts)
    }).catch(() => { })
  }, [])

  useEffect(() => {
    if (!partyId) { setAdvanceBalance(0); return }
    const load = async () => {
      try {
        const res = await fetch(cfg.apiOutstanding(partyId as number), { cache: 'no-store' })
        const data = await res.json().catch(() => [])
        const list = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : [])
        const advItems = list.filter((it: any) => it.source_type === cfg.advanceSourceType)
        const totalAdv = advItems.reduce((s: number, it: any) => s + Math.max(0, Number(it.due_amount ?? it.outstanding ?? 0)), 0)
        const totalAdvOriginal = advItems.reduce((s: number, it: any) => s + Math.max(0, Number(it.amount ?? it.due_amount ?? it.outstanding ?? 0)), 0)
        setAdvanceBalance(totalAdv)
        if (mode === 'new') {
          setDetail((prev) => {
            const existingAdvance = prev.find((d) => d.source_type === cfg.advanceSourceType)
            const existingPayAmount = Math.max(0, Number(existingAdvance?.pay_amount || 0))
            const withoutAdv = prev.filter((d) => d.source_type !== cfg.advanceSourceType)
            if (totalAdv > 0) {
              withoutAdv.push({
                id: `${cfg.advanceSourceType}-total`,
                source_type: cfg.advanceSourceType,
                source_id: 0,
                invoice_number: 'Sisa Uang Muka',
                invoice_date: '',
                total_amount: totalAdvOriginal,
                due_amount: totalAdv,
                pay_amount: Math.min(existingPayAmount, totalAdv),
                remarks: '',
              })
            }
            return withoutAdv
          })
        }
      } catch { setAdvanceBalance(0) }
    }
    load()
  }, [partyId, cfg, mode])

  const subtotalDetail = useMemo(() => detail.reduce((a, b) => {
    const amt = Number(b.pay_amount) || 0
    const st = String(b.source_type || '').toLowerCase()
    if (st === cfg.advanceSourceType) return a
    const sign = st === cfg.returSourceType ? cfg.returSign : 1
    return a + (sign * Math.abs(amt))
  }, 0), [detail, cfg.advanceSourceType, cfg.returSourceType, cfg.returSign])

  const advanceTotal = useMemo(() => detail.reduce((a, b) => {
    const st = String(b.source_type || '').toLowerCase()
    if (st !== cfg.advanceSourceType) return a
    return a + Math.abs(Number(b.pay_amount) || 0)
  }, 0), [detail, cfg.advanceSourceType])

  const totalMethods = useMemo(() => methods.reduce((a, b) => a + (Number(b.amount) || 0), 0), [methods])
  const totalExtraDebit = useMemo(() => extras.reduce((a, b) => a + (Number(b.debit) || 0), 0), [extras])
  const totalExtraCredit = useMemo(() => extras.reduce((a, b) => a + (Number(b.credit) || 0), 0), [extras])
  const expectedMethods = useMemo(() => subtotalDetail - advanceTotal + totalExtraDebit - totalExtraCredit, [subtotalDetail, advanceTotal, totalExtraDebit, totalExtraCredit])
  const amountMismatch = isEdit
    ? Math.abs(expectedMethods - totalMethods) > 0.0001
    : totalMethods < expectedMethods - 0.0001
  const overpayment = Math.max(0, totalMethods - expectedMethods)

  const removeDetail = (id: string) => setDetail((prev) => prev.filter((x) => x.id !== id))
  const removeMethod = (temp_id: string) => setMethods((prev) => prev.filter((x) => x.temp_id !== temp_id))

  const buildPayload = (): any => {
    const base: any = {
      paymentDate: String(paymentDate).slice(0, 10),
      paymentNumber,
      notes,
      advanceTotal,
      details: detail.map((d) => ({
        [cfg.detailDetailKey]: d.source_type === (type === 'ar' ? 'transaction' : 'purchase') ? d.source_id : 0,
        payAmount: d.pay_amount,
        remarks: d.remarks,
        sourceType: d.source_type || (type === 'ar' ? 'transaction' : 'purchase'),
        sourceId: d.source_id,
      })),
      methods: methods.map((m) => ({ accountId: m.account_id, accountCode: m.account_code, accountName: m.account_name, amount: m.amount, notes: m.notes })),
      extras: extras.map((e) => ({ accountId: e.account_id, accountCode: e.account_code, accountName: e.account_name, notes: e.notes, debit: e.debit, credit: e.credit })),
    }
    base[cfg.fieldName] = Number(partyId)
    return base
  }

  const handleSave = async () => {
    if (isSaving) return
    if (!partyId) { alert(`Harap pilih ${cfg.partySingular}`); return }
    if (amountMismatch) { alert('Total metode pembayaran kurang dari yang dibutuhkan'); return }
    if (overpayment > 0 && mode === 'new') {
      const ok = confirm(`Kelebihan Rp ${overpayment.toLocaleString('id-ID')} akan otomatis menjadi ${cfg.overpayToText}.\n\nLanjutkan?`)
      if (!ok) return
    }
    for (const d of detail) {
      if (d.source_type === cfg.advanceSourceType || !d.invoice_date) continue
      if (d.invoice_date > paymentDate) {
        alert(`Tanggal pembayaran (${paymentDate}) tidak boleh lebih kecil dari tanggal nota ${d.invoice_number} (${d.invoice_date})`)
        return
      }
    }
    setIsSaving(true)
    try {
      const payload = buildPayload()
      const res = await fetch(mode === 'edit' && paymentId ? cfg.apiUpdate(paymentId) : cfg.apiSave, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const err = await res.text(); throw new Error(err) }
      const result = await res.json()
      const newId = Number(result?.id || paymentId || 0)
      const newNumber = result?.paymentNumber || result?.payment_number || paymentNumber
      setSavedId(newId)
      if (mode === 'new') alert(`Pembayaran berhasil disimpan dengan nomor: ${newNumber}`)
      onSaved?.({ id: newId, paymentNumber: newNumber })
      setShowPrintModal(true)
    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan: ' + String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const title = cfg.pageTitle[mode]

  return (
    <div className="space-y-4">
      <FormHeader
        title={title}
        subtitle={`Pembayaran ${type === 'ar' ? 'piutang' : 'hutang'} ${mode === 'new' ? 'baru' : mode === 'edit' ? `nomor ${paymentNumber}` : ''}`}
        backHref={cfg.basePath}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="container-card p-3 text-xs space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Kode Nota</span>
            <Input
              className="text-xs"
              placeholder={`Auto Generate ${type === 'ar' ? 'AR' : 'AP'}/YYYY/NNNNNN`}
              value={paymentNumber}
              onChange={(e: any) => setPaymentNumber(e.target.value)}
              disabled
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Tanggal</span>
            <input type="date" className="input text-xs" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} disabled={headerDisabled} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">{cfg.partyLabel}</span>
            <div className="flex-1 flex gap-2">
              <Input className="text-xs flex-1" readOnly placeholder={`Pilih ${cfg.partySingular}...`} value={partyName} disabled={headerDisabled} />
              {!headerDisabled && (
                <>
                  <button type="button" className="px-2 py-1 text-xs rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => setShowPartyModal(true)}>Cari</button>
                  {partyId && (
                    <button type="button" className="px-2 py-1 text-xs rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => { setPartyId('' as any); setPartyName(''); setDetail([]) }}>Reset</button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 text-slate-600 shrink-0">Catatan</span>
            <Input className="text-xs" placeholder="Catatan" value={notes} onChange={(e: any) => setNotes(e.target.value)} disabled={isView} />
          </div>
        </div>

        <div className="container-card p-3 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">Ringkasan</div>
            <div className={`text-xs ${amountMismatch ? 'text-red-600' : overpayment > 0 ? 'text-amber-600' : 'text-green-700'}`}>
              {amountMismatch ? 'Total metode kurang dari yang dibutuhkan' : overpayment > 0 ? `Kelebihan Rp ${overpayment.toLocaleString('id-ID')} akan otomatis menjadi ${cfg.overpayToText}` : 'Total cocok'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-1.5 rounded bg-teal-bg">
              <div className="text-slate-500 text-xs">Total Bayar Detail</div>
              <div className="text-sm font-semibold">{formatNumberID(subtotalDetail)}</div>
            </div>
            <div className="p-1.5 rounded bg-gold-primary/10">
              <div className="text-gold-dark text-xs">Uang Muka</div>
              <div className="text-sm font-semibold text-gold-dark">{formatNumberID(advanceTotal)}</div>
            </div>
            <div className="p-1.5 rounded bg-slate-50">
              <div className="text-slate-500 text-xs">Total Metode</div>
              <div className="text-sm font-semibold">{formatNumberID(totalMethods)}</div>
            </div>
            <div className="p-1.5 rounded bg-slate-50">
              <div className="text-slate-500 text-xs">Debit Lain-lain</div>
              <div className="text-sm font-semibold">{formatNumberID(totalExtraDebit)}</div>
            </div>
            <div className="p-1.5 rounded bg-slate-50">
              <div className="text-slate-500 text-xs">Kredit Lain-lain</div>
              <div className="text-sm font-semibold">{formatNumberID(totalExtraCredit)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Nota */}
      <div className="container-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Detail Nota (Outstanding)</div>
            <div className="text-xs text-slate-500">Pilih multi nota sekaligus melalui modal</div>
          </div>
          {!isView && <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={() => setShowInvoiceModal(true)} disabled={!partyId}>Pilih Nota</button>}
        </div>
        <div className="max-h-64 overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">No. Invoice</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2 text-right">Sisa</th>
                <th className="px-3 py-2 text-right">Bayar</th>
                <th className="px-3 py-2">Keterangan</th>
                {!isView && <th className="px-3 py-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {detail.filter((d) => d.source_type !== cfg.advanceSourceType).length === 0 ? (
                <tr><td colSpan={isView ? 5 : 6} className="px-3 py-6 text-center text-slate-500">Belum ada nota dipilih</td></tr>
              ) : detail.filter((d) => d.source_type !== cfg.advanceSourceType).map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.invoice_number}{row.source_type === cfg.returSourceType ? <span className="ml-1 text-xs text-red-500">{cfg.returText}</span> : ''}</td>
                  <td className="px-3 py-2">{row.invoice_date}</td>
                  <td className={`px-3 py-2 text-right ${row.due_amount < 0 ? 'text-red-600' : ''}`}>{formatNumberID(row.due_amount)}</td>
                  <td className="px-3 py-2 text-right">
                    {isView ? <span>{formatNumberID(row.pay_amount)}</span> : (
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`input text-right ${row.source_type === cfg.returSourceType ? 'border-red-300 focus:ring-red-400' : 'border-teal-primary/40 focus:ring-teal-primary/30'}`}
                        value={formatNumberID(row.pay_amount)}
                        onKeyDown={numKeyDown}
                        onFocus={(e) => { e.currentTarget.select(); e.currentTarget.value = String(row.pay_amount) }}
                        onClick={(e) => { (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e) => {
                          const raw = Number((e.currentTarget.value || '0').toString().replace(/\./g, '').replace(/,/g, ''))
                          const maxAmt = row.source_type === cfg.returSourceType ? Math.abs(row.due_amount) : row.due_amount
                          const v = Math.max(0, Math.min(raw, maxAmt))
                          setDetail((prev) => prev.map((r) => (r.id === row.id ? { ...r, pay_amount: v } : r)))
                        }}
                        onChange={(e) => {
                          const raw = (e.currentTarget.value || '').toString().replace(/\./g, '').replace(/,/g, '')
                          const n = Number(raw || 0)
                          setDetail((prev) => prev.map((r) => (r.id === row.id ? { ...r, pay_amount: n } : r)))
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isView ? <span>{row.remarks || '-'}</span> : (
                      <input className="input" value={row.remarks || ''} onChange={(e) => setDetail((prev) => prev.map((r) => (r.id === row.id ? { ...r, remarks: e.target.value } : r)))} />
                    )}
                  </td>
                  {!isView && (
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-red-600 hover:text-red-800" onClick={() => removeDetail(row.id)}>Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Uang Muka */}
      <div className="container-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">{cfg.overpayToText}</div>
            <div className="text-xs text-slate-500">Saldo uang muka yang sudah diberikan, gunakan untuk mengurangi pembayaran</div>
          </div>
        </div>
        <div className="max-h-24 overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">Keterangan</th>
                <th className="px-3 py-2 text-right">Nilai</th>
                <th className="px-3 py-2 text-right">Sisa</th>
                <th className="px-3 py-2 text-right">Gunakan</th>
              </tr>
            </thead>
            <tbody>
              {advanceBalance <= 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Tidak ada saldo uang muka</td></tr>
              ) : detail.filter((d) => d.source_type === cfg.advanceSourceType).map((row) => (
                <tr key={row.id} className="border-t bg-gold-primary/5">
                  <td className="px-3 py-2 font-medium">{row.invoice_number}</td>
                  <td className="px-3 py-2 text-right">{formatNumberID(row.total_amount || row.due_amount)}</td>
                  <td className="px-3 py-2 text-right">{formatNumberID(row.due_amount)}</td>
                  <td className="px-3 py-2 text-right">
                    {isView ? <span>{formatNumberID(row.pay_amount)}</span> : (
                      <input
                        type="text"
                        className="input text-right w-28 border-gold-primary/40 focus:ring-gold-primary/30"
                        value={formatNumberID(row.pay_amount)}
                        onKeyDown={numKeyDown}
                        onFocus={(e) => { e.currentTarget.select(); e.currentTarget.value = String(row.pay_amount) }}
                        onBlur={(e) => {
                          const raw = Number((e.currentTarget.value || '0').toString().replace(/\./g, '').replace(/,/g, ''))
                          const v = Math.max(0, Math.min(raw, row.due_amount))
                          setDetail((prev) => prev.map((r) => (r.id === row.id ? { ...r, pay_amount: v } : r)))
                        }}
                        onChange={(e) => {
                          const raw = (e.currentTarget.value || '').toString().replace(/\./g, '').replace(/,/g, '')
                          const n = Number(raw || 0)
                          setDetail((prev) => prev.map((r) => (r.id === row.id ? { ...r, pay_amount: n } : r)))
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biaya Lain-lain */}
      <div className="container-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Biaya Lain-lain</div>
            <div className="text-xs text-slate-500">Isikan akun Perkiraan, Keterangan, lalu Debit atau Kredit (pilih salah satu per baris)</div>
          </div>
          {!isView && (
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => {
                setExtras((prev) => prev.concat([{ temp_id: Math.random().toString(36).slice(2), account_id: 0, account_code: '', account_name: '', notes: '', debit: 0, credit: 0 }]))
              }}>Tambah Baris</button>
              <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={() => setShowExtraModal(true)}>Pilih Perkiraan</button>
            </div>
          )}
        </div>
        <div className="max-h-64 overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">Perkiraan</th>
                <th className="px-3 py-2">Keterangan</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Kredit</th>
                {!isView && <th className="px-3 py-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {extras.length === 0 ? (
                <tr><td colSpan={isView ? 4 : 5} className="px-3 py-6 text-center text-slate-500">Belum ada baris</td></tr>
              ) : extras.map((x) => (
                <tr key={x.temp_id} className="border-t">
                  <td className="px-3 py-2">
                    {isView ? <span>{x.account_code ? `${x.account_code} - ${x.account_name}` : '-'}</span> : (
                      <SearchableSelect
                        options={accountOptions}
                        value={x.account_id || null}
                        onChange={(v) => {
                          const acct = v ? accountsMap[Number(v)] : null
                          setExtras((prev) => prev.map((r) =>
                            r.temp_id === x.temp_id
                              ? { ...r, account_id: Number(v) || 0, account_code: acct?.code || '', account_name: acct?.name || '' }
                              : r
                          ))
                        }}
                        placeholder="Cari perkiraan..."
                        allowClear={false}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isView ? <span>{x.notes || '-'}</span> : (
                      <input className="w-full border border-slate-300 rounded-pill px-2 py-1 text-xs" value={x.notes || ''} onChange={(e) => setExtras((prev) => prev.map((r) => r.temp_id === x.temp_id ? { ...r, notes: e.target.value } : r))} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isView ? <span>{formatNumberID(x.debit)}</span> : (
                      <input
                        type="text" inputMode="numeric"
                        className="input text-right border-teal-primary/40 focus:ring-teal-primary/30"
                        value={formatNumberID(x.debit)}
                        onKeyDown={numKeyDown}
                        onFocus={(e) => { e.currentTarget.select(); e.currentTarget.value = String(x.debit) }}
                        onClick={(e) => { (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e) => {
                          const raw = Number((e.currentTarget.value || '0').toString().replace(/\./g, '').replace(/,/g, ''))
                          const v = Math.max(0, raw)
                          setExtras((prev) => prev.map((r) => r.temp_id === x.temp_id ? { ...r, debit: v, credit: v > 0 ? 0 : r.credit } : r))
                        }}
                        onChange={(e) => {
                          const raw = (e.currentTarget.value || '').toString().replace(/\./g, '').replace(/,/g, '')
                          const n = Number(raw || 0)
                          setExtras((prev) => prev.map((r) => r.temp_id === x.temp_id ? { ...r, debit: n, credit: n > 0 ? 0 : r.credit } : r))
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isView ? <span>{formatNumberID(x.credit)}</span> : (
                      <input
                        type="text" inputMode="numeric"
                        className="input text-right border-teal-primary/40 focus:ring-teal-primary/30"
                        value={formatNumberID(x.credit)}
                        onKeyDown={numKeyDown}
                        onFocus={(e) => { e.currentTarget.select(); e.currentTarget.value = String(x.credit) }}
                        onClick={(e) => { (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e) => {
                          const raw = Number((e.currentTarget.value || '0').toString().replace(/\./g, '').replace(/,/g, ''))
                          const v = Math.max(0, raw)
                          setExtras((prev) => prev.map((r) => r.temp_id === x.temp_id ? { ...r, credit: v, debit: v > 0 ? 0 : r.debit } : r))
                        }}
                        onChange={(e) => {
                          const raw = (e.currentTarget.value || '').toString().replace(/\./g, '').replace(/,/g, '')
                          const n = Number(raw || 0)
                          setExtras((prev) => prev.map((r) => r.temp_id === x.temp_id ? { ...r, credit: n, debit: n > 0 ? 0 : r.debit } : r))
                        }}
                      />
                    )}
                  </td>
                  {!isView && (
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-red-600 hover:text-red-800" onClick={() => setExtras((prev) => prev.filter((r) => r.temp_id !== x.temp_id))}>Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metode Pembayaran */}
      <div className="container-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Metode Pembayaran</div>
            <div className="text-xs text-slate-500">Pilih multi akun kas/bank dari master perkiraan</div>
          </div>
          {!isView && (
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => {
                setMethods((prev) => prev.concat([{ temp_id: Math.random().toString(36).slice(2), account_id: 0, account_code: '', account_name: '', amount: 0, notes: '' }]))
              }}>Tambah Baris</button>
              <button className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50" onClick={() => {
                if (expectedMethods <= 0) return
                setMethods((prev) => {
                  const sum = prev.reduce((a, b) => a + (Number(b.amount) || 0), 0)
                  const diff = expectedMethods - sum
                  if (Math.abs(diff) < 0.0001) return prev
                  if (prev.length === 0) return prev
                  const last = prev[prev.length - 1]
                  return prev.slice(0, -1).concat([{ ...last, amount: Math.max(0, Number(last.amount || 0) + diff) }])
                })
              }}>Auto Distribute</button>
              <button className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white" onClick={() => setShowMethodModal(true)}>Pilih Metode</button>
            </div>
          )}
        </div>
        <div className="max-h-64 overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2" colSpan={2}>Akun (Kas/Bank)</th>
                <th className="px-3 py-2 text-right">Nominal</th>
                <th className="px-3 py-2">Catatan</th>
                {!isView && <th className="px-3 py-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {methods.length === 0 ? (
                <tr><td colSpan={isView ? 4 : 5} className="px-3 py-6 text-center text-slate-500">Belum ada metode dipilih</td></tr>
              ) : methods.map((m) => (
                <tr key={m.temp_id} className="border-t">
                  <td className="px-3 py-2" colSpan={2}>
                    {isView ? <span>{m.account_code ? `${m.account_code} - ${m.account_name}` : '-'}</span> : (
                      <SearchableSelect
                        options={kasBankOptions}
                        value={m.account_id || null}
                        onChange={(v) => {
                          const acct = v ? kasBankMap[Number(v)] : null
                          setMethods((prev) => prev.map((r) =>
                            r.temp_id === m.temp_id
                              ? { ...r, account_id: Number(v) || 0, account_code: acct?.code || '', account_name: acct?.name || '' }
                              : r
                          ))
                        }}
                        placeholder="Cari akun kas/bank..."
                        allowClear={false}
                        className="text-xs"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isView ? <span>{formatNumberID(m.amount)}</span> : (
                      <input
                        type="text" inputMode="numeric"
                        className="input text-right border-teal-primary/40 focus:ring-teal-primary/30"
                        value={formatNumberID(m.amount)}
                        onKeyDown={numKeyDown}
                        onFocus={(e) => { e.currentTarget.select(); e.currentTarget.value = String(m.amount) }}
                        onClick={(e) => { (e.currentTarget as HTMLInputElement).select() }}
                        onBlur={(e) => {
                          const raw = Number((e.currentTarget.value || '0').toString().replace(/\./g, '').replace(/,/g, ''))
                          const v = Math.max(0, raw)
                          setMethods((prev) => prev.map((x) => (x.temp_id === m.temp_id ? { ...x, amount: v } : x)))
                        }}
                        onChange={(e) => {
                          const raw = (e.currentTarget.value || '').toString().replace(/\./g, '').replace(/,/g, '')
                          const n = Number(raw || 0)
                          setMethods((prev) => prev.map((x) => (x.temp_id === m.temp_id ? { ...x, amount: n } : x)))
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isView ? <span>{m.notes || '-'}</span> : (
                      <input className="input" value={m.notes || ''} onChange={(e) => setMethods((prev) => prev.map((x) => (x.temp_id === m.temp_id ? { ...x, notes: e.target.value } : x)))} />
                    )}
                  </td>
                  {!isView && (
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-red-600 hover:text-red-800" onClick={() => removeMethod(m.temp_id)}>Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isView && (
        <div className="sticky bottom-0 bg-white p-3 border-t flex items-center justify-between z-10">
          <div className={`text-xs ${amountMismatch ? 'text-red-600' : overpayment > 0 ? 'text-amber-600' : 'text-green-700'}`}>
            {amountMismatch
              ? `Total metode (${formatNumberID(totalMethods)}) kurang dari yang dibutuhkan (${formatNumberID(expectedMethods)})`
              : overpayment > 0
                ? `Kelebihan Rp ${overpayment.toLocaleString('id-ID')} akan otomatis menjadi ${cfg.overpayToText}`
                : 'Total cocok'}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { window.location.href = cfg.basePath }} className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50">Batal</button>
            <button onClick={handleSave} disabled={amountMismatch || isSaving} className={`px-3 py-1.5 rounded-pill text-white ${amountMismatch || isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-primary hover:bg-teal-dark'}`}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </div>
      )}

      {showInvoiceModal && partyId && (
        <InvoicePickerModal
          type={cfg.type}
          partyId={partyId as number}
          preselectedIds={new Set(detail.filter((d) => d.source_type !== cfg.advanceSourceType).map((d) => d.id))}
          onClose={() => setShowInvoiceModal(false)}
          onApply={(rows) => {
            setDetail((prev) => {
              const advance = prev.filter((d) => d.source_type === cfg.advanceSourceType)
              const prevMap = new Map(prev.filter((d) => d.source_type !== cfg.advanceSourceType).map((x) => [x.id, x]))
              const map = new Map<string, InvoicePick>()
              rows.forEach((r) => {
                const existing = prevMap.get(r.id)
                map.set(r.id, existing ? { ...r, pay_amount: existing.pay_amount, remarks: existing.remarks } : r)
              })
              advance.forEach((a) => map.set(a.id, a))
              return Array.from(map.values())
            })
            setShowInvoiceModal(false)
          }}
        />
      )}

      {showMethodModal && (
        <MethodPickerModal
          onClose={() => setShowMethodModal(false)}
          onApply={(rows) => {
            setMethods((prev) => {
              const map = new Map(prev.map((x) => [x.temp_id, x]))
              rows.forEach((r) => map.set(r.temp_id, { ...r, notes: '' } as MethodPickFull))
              return Array.from(map.values())
            })
            setShowMethodModal(false)
          }}
        />
      )}

      {showExtraModal && (
        <AccountPickerModal
          title="Pilih Akun Perkiraan"
          onClose={() => setShowExtraModal(false)}
          onApply={(rows) => {
            setExtras((prev) => {
              const map = new Map(prev.map((x) => [x.temp_id, x]))
              rows.forEach((r) => {
                const existing = map.get(r.temp_id)
                if (existing) {
                  map.set(r.temp_id, { ...existing, account_id: r.account_id, account_code: r.account_code, account_name: r.account_name })
                } else {
                  map.set(r.temp_id, { temp_id: r.temp_id, account_id: r.account_id, account_code: r.account_code, account_name: r.account_name, notes: '', debit: 0, credit: 0 })
                }
              })
              return Array.from(map.values())
            })
            setShowExtraModal(false)
          }}
        />
      )}

      {showPartyModal && (
        <PartyPickerModal
          type={cfg.partyType}
          onClose={() => setShowPartyModal(false)}
          onPick={(s: Party) => {
            setPartyId(s.id)
            setPartyName(s.name)
            setShowPartyModal(false)
          }}
        />
      )}

      {showPrintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-modal shadow-2xl w-[420px] max-w-[95vw]">
            <div className="p-3 border-b font-medium text-sm">Cetak Nota Pembayaran</div>
            <div className="p-4 text-sm">{mode === 'edit' ? 'Perubahan berhasil disimpan.' : 'Pembayaran berhasil disimpan.'} Apakah Anda ingin mencetak Nota Pembayaran sekarang?</div>
            <div className="p-3 border-t flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-pill border border-slate-300 hover:bg-slate-50"
                onClick={() => { setShowPrintModal(false); window.location.href = cfg.basePath }}
              >Tidak</button>
              <button
                className="px-3 py-1.5 rounded-pill bg-teal-primary hover:bg-teal-dark text-white"
                onClick={async () => {
                  setShowPrintModal(false)
                  if (savedId) {
                    try { (window as any).__printId = savedId; await cfg.printFunction() } catch (e) { console.error(e) }
                  }
                  window.location.href = cfg.basePath
                }}
              >Ya, Cetak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
