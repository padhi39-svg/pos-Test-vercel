"use client"

import { useEffect, useMemo, useState } from 'react'

type Account = { id: number; code: string; name: string; is_header?: number }

type Mappings = {
  pelanggan: {
    piutang_dagang: number | null
    penjualan_barang: number | null
    potongan_penjualan: number | null
    hpp: number | null
    retur_penjualan: number | null
    uang_muka_penjualan: number | null
    ppn_keluaran: number | null
    ppn_keluaran_difakturkan: number | null
    service_charge: number | null
    default_cash_account: number | null
  }
  supplier: {
    hutang_dagang: number | null
    potongan_pembelian: number | null
    retur_pembelian: number | null
    uang_muka_pembelian: number | null
    ppn_masukan: number | null
    ppn_masukan_difakturkan: number | null
  }
  barang: {
    persediaan_barang: number | null
  }
  laba: {
    laba_ditahan: number | null
    laba_berjalan: number | null
    laba_bulan_ini: number | null
  }
}

const defaultMappings: Mappings = {
  pelanggan: {
    piutang_dagang: null,
    penjualan_barang: null,
    potongan_penjualan: null,
    hpp: null,
    retur_penjualan: null,
    uang_muka_penjualan: null,
    ppn_keluaran: null,
    ppn_keluaran_difakturkan: null,
    service_charge: null,
    default_cash_account: null,
  },
  supplier: {
    hutang_dagang: null,
    potongan_pembelian: null,
    retur_pembelian: null,
    uang_muka_pembelian: null,
    ppn_masukan: null,
    ppn_masukan_difakturkan: null,
  },
  barang: {
    persediaan_barang: null,
  },
  laba: {
    laba_ditahan: null,
    laba_berjalan: null,
    laba_bulan_ini: null,
  },
}

export default function SettingPerkiraanPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [mappings, setMappings] = useState<Mappings>(defaultMappings)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const detailAccounts = useMemo(() => accounts.filter(a => Number(a.is_header) !== 1), [accounts])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/keuangan/setting-perkiraan', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat data')
      setAccounts(data.accounts || [])
      setMappings({ ...defaultMappings, ...(data.mappings || {}) })
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const res = await fetch('/api/keuangan/setting-perkiraan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan')
      setOk('Tersimpan')
    } catch (e:any) {
      setError(e?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  function SearchSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const selected = useMemo(() => detailAccounts.find(a => a.id === value) || null, [detailAccounts, value])
    const filtered = useMemo(() => {
      const s = q.trim().toLowerCase()
      if (!s) return detailAccounts
      return detailAccounts.filter(a => `${a.code} ${a.name}`.toLowerCase().includes(s))
    }, [q, detailAccounts])

    return (
      <div className="relative text-sm">
        <button type="button" className="w-full border rounded px-2 py-1 text-left bg-white" onClick={() => setOpen(o => !o)}>
          {selected ? `${selected.code} - ${selected.name}` : '- pilih akun -'}
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow">
            <div className="p-1 border-b">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari akun..."
                className="w-full px-2 py-1 rounded outline-none"
              />
            </div>
            <div className="max-h-56 overflow-auto">
              {filtered.length === 0 ? (
                <div className="px-2 py-2 text-slate-500 text-xs">Tidak ada hasil</div>
              ) : (
                filtered.map(a => (
                  <div
                    key={a.id}
                    className={`px-2 py-1 cursor-pointer hover:bg-slate-100 ${value === a.id ? 'bg-slate-50' : ''}`}
                    onClick={() => { onChange(a.id); setOpen(false) }}
                  >
                    {a.code} - {a.name}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between items-center px-2 py-1 border-t bg-slate-50">
              <button className="text-xs text-slate-600 hover:underline" onClick={() => { onChange(null); setOpen(false) }}>Kosongkan</button>
              <button className="text-xs text-slate-600 hover:underline" onClick={() => setOpen(false)}>Tutup</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Setting Perkiraan</h1>
        <p className="text-slate-600 text-sm">Mapping akun COA ke modul Pelanggan, Supplier, dan Barang.</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {ok ? <div className="text-sm text-green-600">{ok}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Pelanggan */}
        <div className="border rounded-md bg-white">
          <div className="px-3 py-2 border-b font-semibold text-slate-800">Pelanggan</div>
          <div className="p-3 space-y-2 text-sm">
            <div>
              <div className="text-xs text-slate-600 mb-1">Piutang Dagang</div>
              <SearchSelect value={mappings.pelanggan.piutang_dagang} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, piutang_dagang: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Penjualan Barang</div>
              <SearchSelect value={mappings.pelanggan.penjualan_barang} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, penjualan_barang: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Potongan Penjualan</div>
              <SearchSelect value={mappings.pelanggan.potongan_penjualan} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, potongan_penjualan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">HPP</div>
              <SearchSelect value={mappings.pelanggan.hpp} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, hpp: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Retur Penjualan</div>
              <SearchSelect value={mappings.pelanggan.retur_penjualan} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, retur_penjualan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Uang Muka Penjualan</div>
              <SearchSelect value={mappings.pelanggan.uang_muka_penjualan} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, uang_muka_penjualan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">PPN Keluaran</div>
              <SearchSelect value={mappings.pelanggan.ppn_keluaran} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, ppn_keluaran: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">PPN Keluaran (Difakturkan)</div>
              <SearchSelect value={mappings.pelanggan.ppn_keluaran_difakturkan} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, ppn_keluaran_difakturkan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Service Charge</div>
              <SearchSelect value={mappings.pelanggan.service_charge} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, service_charge: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Default Kas Penjualan</div>
              <SearchSelect value={mappings.pelanggan.default_cash_account} onChange={(v)=> setMappings(m => ({ ...m, pelanggan: { ...m.pelanggan, default_cash_account: v } }))} />
            </div>
          </div>
        </div>

        {/* Supplier */}
        <div className="border rounded-md bg-white">
          <div className="px-3 py-2 border-b font-semibold text-slate-800">Supplier</div>
          <div className="p-3 space-y-2 text-sm">
            <div>
              <div className="text-xs text-slate-600 mb-1">Hutang Dagang</div>
              <SearchSelect value={mappings.supplier.hutang_dagang} onChange={(v)=> setMappings(m => ({ ...m, supplier: { ...m.supplier, hutang_dagang: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Potongan Pembelian</div>
              <SearchSelect value={mappings.supplier.potongan_pembelian} onChange={(v)=> setMappings(m => ({ ...m, supplier: { ...m.supplier, potongan_pembelian: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Retur Pembelian</div>
              <SearchSelect value={mappings.supplier.retur_pembelian} onChange={(v)=> setMappings(m => ({ ...m, supplier: { ...m.supplier, retur_pembelian: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Uang Muka Pembelian</div>
              <SearchSelect value={mappings.supplier.uang_muka_pembelian} onChange={(v)=> setMappings(m => ({ ...m, supplier: { ...m.supplier, uang_muka_pembelian: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">PPN Masukan</div>
              <SearchSelect value={mappings.supplier.ppn_masukan} onChange={(v)=> setMappings(m => ({ ...m, supplier: { ...m.supplier, ppn_masukan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">PPN Masukan (Difakturkan)</div>
              <SearchSelect value={mappings.supplier.ppn_masukan_difakturkan} onChange={(v)=> setMappings(m => ({ ...m, supplier: { ...m.supplier, ppn_masukan_difakturkan: v } }))} />
            </div>
          </div>
        </div>

        {/* Barang */}
        <div className="border rounded-md bg-white">
          <div className="px-3 py-2 border-b font-semibold text-slate-800">Barang</div>
          <div className="p-3 space-y-2 text-sm">
            <div>
              <div className="text-xs text-slate-600 mb-1">Persediaan Barang</div>
              <SearchSelect value={mappings.barang.persediaan_barang} onChange={(v)=> setMappings(m => ({ ...m, barang: { ...m.barang, persediaan_barang: v } }))} />
            </div>
          </div>
        </div>

        {/* Laba */}
        <div className="border rounded-md bg-white">
          <div className="px-3 py-2 border-b font-semibold text-slate-800">Laba</div>
          <div className="p-3 space-y-2 text-sm">
            <div>
              <div className="text-xs text-slate-600 mb-1">Laba Ditahan (Retained Earnings)</div>
              <SearchSelect value={mappings.laba.laba_ditahan} onChange={(v)=> setMappings(m => ({ ...m, laba: { ...m.laba, laba_ditahan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Laba Berjalan (Current Year Profit)</div>
              <SearchSelect value={mappings.laba.laba_berjalan} onChange={(v)=> setMappings(m => ({ ...m, laba: { ...m.laba, laba_berjalan: v } }))} />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Laba Bulan Ini</div>
              <SearchSelect value={mappings.laba.laba_bulan_ini} onChange={(v)=> setMappings(m => ({ ...m, laba: { ...m.laba, laba_bulan_ini: v } }))} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-1">
        <button onClick={save} disabled={saving || loading} className="h-9 px-4 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
