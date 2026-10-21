'use client'

import { useState, useEffect } from 'react'
import { smartTitleCase, onlyDigits } from '@/lib/textFormat'
import ReceiptSettings from '@/components/keuangan/ReceiptSettings'
import MidtransKeySection from './MidtransKeySection'
import { useRouter } from 'next/navigation'
// QZ Tray dihapus; gunakan Server TCP, Mobile (RawBT), atau Browser Print

type TabType = 'company' | 'general' | 'receipt' | 'design' | 'selforder'

type CompanySettings = {
  company_name: string
  company_address: string
  company_city: string
  company_phone: string
  company_mobile: string
  company_email: string
  company_npwp: string
  company_npwp_address: string
  company_logo_url?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('company')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Formatting helpers moved to shared util: textFormat.ts
  
  // Company Settings
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    company_name: '',
    company_address: '',
    company_city: '',
    company_phone: '',
    company_mobile: '',
    company_email: '',
    company_npwp: '',
    company_npwp_address: '',
    company_logo_url: ''
  })

  useEffect(() => {
    loadSettings()
  }, [])

  // Design Settings (Sidebar Theme)
  type DesignKV = Record<string, string>
  const defaultDesign: DesignKV = {
    design_sidebar_bg: '#FFFFFF',
    design_sidebar_text: '#969BA0',
    design_sidebar_hover_bg: '#EFF6FF',
    design_sidebar_active_bg: '#DBEAFE',
    design_sidebar_active_text: '#1D4ED8',
    // Login background defaults
    design_login_bg_type: 'color',
    design_login_bg_color: '#0ea5e9',
    design_login_bg_url: '',
    design_login_overlay_color: '#000000',
    design_login_overlay_opacity: '0.35',
    design_login_hero_title: 'Welcome Back',
    design_login_hero_subtitle: 'Silakan login untuk melanjutkan',
    // Mobile background defaults
    design_login_bg_mobile_type: 'color',
    design_login_bg_mobile_color: '#1B8A7A',
    design_login_bg_mobile_url: '',
  }
  const [designSettings, setDesignSettings] = useState<DesignKV>({ ...defaultDesign })
  const applyDesignVars = (kv: DesignKV) => {
    try {
      const root = document.documentElement
      if (kv.design_sidebar_bg) root.style.setProperty('--sidebar-bg', kv.design_sidebar_bg)
      if (kv.design_sidebar_text) root.style.setProperty('--sidebar-text', kv.design_sidebar_text)
      if (kv.design_sidebar_hover_bg) root.style.setProperty('--sidebar-hover-bg', kv.design_sidebar_hover_bg)
      if (kv.design_sidebar_active_bg) root.style.setProperty('--sidebar-active-bg', kv.design_sidebar_active_bg)
      if (kv.design_sidebar_active_text) root.style.setProperty('--sidebar-active-text', kv.design_sidebar_active_text)
      if (kv.design_login_bg_type) root.style.setProperty('--login-bg-type', kv.design_login_bg_type)
      if (kv.design_login_bg_color) root.style.setProperty('--login-bg-color', kv.design_login_bg_color)
      if (kv.design_login_bg_url) root.style.setProperty('--login-bg-url', `url(${kv.design_login_bg_url})`)
      if (kv.design_login_overlay_color) root.style.setProperty('--login-overlay-color', kv.design_login_overlay_color)
      if (kv.design_login_overlay_opacity) root.style.setProperty('--login-overlay-opacity', kv.design_login_overlay_opacity)
      if (kv.design_login_bg_mobile_type) root.style.setProperty('--login-bg-mobile-type', kv.design_login_bg_mobile_type)
      if (kv.design_login_bg_mobile_color) root.style.setProperty('--login-bg-mobile-color', kv.design_login_bg_mobile_color)
      if (kv.design_login_bg_mobile_url) root.style.setProperty('--login-bg-mobile-url', `url(${kv.design_login_bg_mobile_url})`)
    } catch {}
  }
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings?group=design')
        if (!res.ok) return
        const rows = await res.json()
        const map: DesignKV = { ...defaultDesign }
        ;(rows || []).forEach((r: any) => { map[r.setting_key] = r.setting_value ?? '' })
        setDesignSettings(map)
        applyDesignVars(map)
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load backups when entering General tab
  useEffect(() => {
    if (activeTab === 'general') {
      loadBackups()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const loadBackups = async () => {
    try {
      setBackupsLoading(true)
      const res = await fetch('/api/backup/list')
      if (!res.ok) return
      const data = await res.json()
      setBackups(data.backups || [])
    } catch (e) {
      console.error('Failed to load backups', e)
    } finally {
      setBackupsLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true)
      const res = await fetch('/api/backup/create', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        alert(`❌ Gagal membuat backup: ${data.error || 'Unknown error'}`)
        return
      }
      await loadBackups()
      alert(`✅ Backup berhasil dibuat: ${data.file}`)
    } catch (e) {
      console.error(e)
      alert('❌ Terjadi kesalahan saat membuat backup')
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDownloadBackup = (name: string) => {
    try {
      window.open(`/api/backup/download/${encodeURIComponent(name)}`, '_blank')
    } catch {}
  }

  const handleDeleteBackup = async (name: string) => {
    if (!confirm(`Hapus backup ini?\n\n${name}`)) return
    try {
      const res = await fetch(`/api/backup/delete/${encodeURIComponent(name)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`❌ Gagal menghapus backup: ${data?.error || 'Unknown error'}`)
        return
      }
      await loadBackups()
    } catch (e) {
      console.error(e)
      alert('❌ Terjadi kesalahan saat menghapus backup')
    }
  }

  const handleValidateUpload = async (file: File | null) => {
    if (!file) return
    try {
      setUploadingFile(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/restore/validate', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        alert(`❌ File tidak valid: ${data.error || 'Unknown error'}`)
        setUploadPreview(null)
        return
      }
      setUploadPreview({ tempFile: data.tempFile, size: data.size, integrity: data.integrity, tables: data.tables || [] })
      alert('✅ File valid. Siap untuk restore (pastikan Anda paham konsekuensinya).')
    } catch (e) {
      console.error(e)
      alert('❌ Gagal memvalidasi file')
      setUploadPreview(null)
    } finally {
      setUploadingFile(false)
    }
  }

  const handleRestoreFromUpload = async () => {
    if (!uploadPreview?.tempFile) return
    if (!confirm('⚠️ PERINGATAN: Tindakan ini akan mengganti database saat ini dengan file yang diupload. Lanjutkan?')) return
    setRestoring(true)
    try {
      const res = await fetch('/api/restore/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempFile: uploadPreview.tempFile, confirm: true })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`❌ Restore gagal: ${data.error || 'Unknown error'}`)
        return
      }
      alert(`✅ Restore berhasil. Integrity: ${data.integrity || 'unknown'}\nSilakan login ulang.`)
      window.location.href = '/login'
    } catch (e) {
      console.error(e)
      alert('❌ Terjadi kesalahan saat restore')
    } finally {
      setRestoring(false)
    }
  }

  const handleRestoreFromBackup = async (name: string) => {
    if (!confirm(`⚠️ PERINGATAN: Database akan diganti dengan backup: ${name}. Lanjutkan?`)) return
    setRestoring(true)
    try {
      const res = await fetch('/api/restore/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupName: name, confirm: true })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`❌ Gagal restore: ${data.error || 'Unknown error'}`)
        return
      }
      const schemaMsg = data.schemaResult
        ? `\n\nSchema sync: ${data.schemaResult.ok ? 'OK' : 'Ada error'}${data.schemaResult.tablesAdded ? ` (+${data.schemaResult.tablesAdded} tabel)` : ''}${data.schemaResult.columnsAdded ? ` (+${data.schemaResult.columnsAdded} kolom)` : ''}`
        : ''
      alert(`✅ Restore berhasil.${schemaMsg}\nSilakan login ulang.`)
      window.location.href = '/login'
    } catch (e) {
      console.error(e)
      alert('❌ Terjadi kesalahan saat restore')
    } finally {
      setRestoring(false)
    }
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      const resCompany = await fetch('/api/settings?group=company')
      const map: any = {}
      if (resCompany.ok) {
        const rows = await resCompany.json()
        ;(rows || []).forEach((r: any) => { map[r.setting_key] = r.setting_value || '' })
      }
      // Fallback: juga baca semua settings lalu ambil kunci yang diawali company_ jika belum ada
      try {
        const resAll = await fetch('/api/settings')
        if (resAll.ok) {
          const all = await resAll.json()
          ;(all || []).forEach((r: any) => {
            const k = String(r.setting_key || '')
            if (k.startsWith('company_') && (map[k] == null || map[k] === '')) {
              map[k] = r.setting_value || ''
            }
          })
        }
      } catch {}
      setCompanySettings(prev => ({ ...prev, ...map }))
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generic grouped settings saver (uses /api/settings)
  const saveGroup = async (group: string, kv: KV) => {
    const payload = Object.entries(kv).map(([key, value]) => ({ key, value, group }))
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: payload }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`)
    }
    return data
  }

  const handleSaveCompanySettings = async () => {
    try {
      setSaving(true)
      const payload = Object.entries(companySettings).map(([key, value]) => ({ key, value, group: 'company' }))
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: payload }) })
      if (response.ok) { alert('✅ Setting perusahaan berhasil disimpan!') } else { alert('❌ Gagal menyimpan setting') }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('❌ Terjadi kesalahan saat menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const [showConfirmModal, setShowConfirmModal] = useState<'all' | 'transactions' | null>(null)

  // General grouped settings state
  type KV = Record<string, string>
  const [barangSettings, setBarangSettings] = useState<KV>({
    barang_code_prefix: 'BRG',
    barang_default_unit: 'PCS',
    barang_auto_title_case_name: '1',
  })
  const [penjualanSettings, setPenjualanSettings] = useState<KV>({
    sales_invoice_prefix: 'JL',
    sales_default_terms: '0',
    sales_include_tax: '0',
    sales_default_ppn_percent: '11',
    sales_default_service_percent: '0',
    sales_allow_negative: '0',
    sales_deduct_ingredients_stock: '1',
    sales_tanpa_stok: '0',
  })
  const [pembelianSettings, setPembelianSettings] = useState<KV>({
    purchase_invoice_prefix: 'BL',
    purchase_default_terms: '0',
    purchase_include_tax: '0',
  })
  const [stokSettings, setStokSettings] = useState<KV>({
    stock_allow_negative: '0',
    stock_default_warehouse: 'GUDANG-UTAMA',
    stock_cost_method: 'periodic',
    auto_reconcile_enabled: '1',
    auto_reconcile_interval_minutes: '60',
  })
  // General settings
  const [umumSettings, setUmumSettings] = useState<KV>({
    general_allow_backdate: '0',
  })
  // Auth/Security Settings
  const [authSettings, setAuthSettings] = useState<KV>({
    auth_session_ttl_hours: '2',
  })
  // Self Order Settings
  const [selfOrderSettings, setSelfOrderSettings] = useState<KV>({
    self_order_cache_ttl_hours: '3',
    self_order_self_pay: '0',
  })

  // Database sync state
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  // Backup & Restore state
  type BackupItem = { name: string; size: number; modifiedAt: string }
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<null | {
    tempFile: string
    size: number
    integrity: string | null
    tables: string[]
  }>(null)

  useEffect(() => {
    // load grouped settings in parallel
    const loadGroup = async (group: string, setter: (kv: KV)=>void, defaults: KV) => {
      try {
        const res = await fetch(`/api/settings?group=${group}`)
        if (!res.ok) return
        const data = await res.json()
        const map: KV = { ...defaults }
        ;(data || []).forEach((row: any) => {
          map[row.setting_key] = row.setting_value ?? ''
        })
        setter(map)
      } catch {}
    }
    loadGroup('barang', setBarangSettings, barangSettings)
    loadGroup('penjualan', setPenjualanSettings, penjualanSettings)
    loadGroup('pembelian', setPembelianSettings, pembelianSettings)
    loadGroup('stok', (kv) => {
      if (kv.stock_cost_method === 'avg' || kv.stock_cost_method === 'fifo') {
        kv = { ...kv, stock_cost_method: 'periodic' }
      }
      setStokSettings(kv)
    }, stokSettings)
    loadGroup('auth', setAuthSettings, authSettings)
    loadGroup('general', setUmumSettings, umumSettings)
    loadGroup('selforder', setSelfOrderSettings, selfOrderSettings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResetTransactions = async () => {
    if (!confirm('⚠️ PERINGATAN!\n\nIni akan menghapus SEMUA:\n- Transaksi Penjualan\n- Item Transaksi\n- Purchase Orders\n- Item Purchase Orders\n- Pembelian\n- Item Pembelian\n- Pergerakan Stok\n- Saldo Stok\n\nMaster data (Barang, Customer, Periode, dll) TIDAK akan dihapus.\n\nApakah Anda yakin?')) {
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/reset/stock-and-transactions?confirm=yes', { method: 'POST' })
      const data = await res.json()
      
      if (res.ok && data.success) {
        const d = data.deleted || {}
        const lines: string[] = []
        lines.push('✅ Reset Berhasil!')
        lines.push('')
        lines.push('Data yang dihapus:')
        lines.push(`- Transaksi Penjualan: ${d.transactions ?? 0}`)
        lines.push(`- Item Transaksi: ${d.transaction_items ?? 0}`)
        lines.push(`- Purchase Orders: ${d.purchase_orders ?? 0}`)
        lines.push(`- Item Purchase Orders: ${d.purchase_order_items ?? 0}`)
        lines.push(`- Pembelian: ${d.purchases ?? 0}`)
        lines.push(`- Item Pembelian: ${d.purchase_items ?? 0}`)
        // New: stock modules captions
        if (typeof d.stock_transfers !== 'undefined') lines.push(`- Transfer Stok: ${d.stock_transfers}`)
        if (typeof d.stock_transfer_items !== 'undefined') lines.push(`- Item Transfer Stok: ${d.stock_transfer_items}`)
        if (typeof d.stock_usage !== 'undefined') lines.push(`- Pemakaian Stok: ${d.stock_usage}`)
        if (typeof d.stock_usage_items !== 'undefined') lines.push(`- Item Pemakaian Stok: ${d.stock_usage_items}`)
        if (typeof d.stock_opname !== 'undefined') lines.push(`- Stok Opname (header): ${d.stock_opname}`)
        if (typeof d.stock_opname_items !== 'undefined') lines.push(`- Item Stok Opname: ${d.stock_opname_items}`)
        if (typeof d.stock_opname_sessions !== 'undefined') lines.push(`- Sesi Opname: ${d.stock_opname_sessions}`)
        if (typeof d.stock_opname_counts !== 'undefined') lines.push(`- Hitungan Opname: ${d.stock_opname_counts}`)
        // Reservations captions
        if (typeof d.reservations !== 'undefined') lines.push(`- Reservasi: ${d.reservations}`)
        if (typeof d.reservation_tables !== 'undefined') lines.push(`- Relasi Meja Reservasi: ${d.reservation_tables}`)
        lines.push(`- Pergerakan Stok: ${d.stock_movements ?? 0}`)
        lines.push(`- Saldo Stok: ${d.stock_balance ?? 0}`)
        alert(lines.join('\n'))
        router.refresh()
      } else {
        alert(`❌ Gagal reset: ${data.error || 'Unknown error'}`)
      }
    } catch (e) {
      console.error(e)
      alert('❌ Terjadi kesalahan saat reset data')
    } finally {
      setLoading(false)
      setShowConfirmModal(null)
    }
  }

  const handleResetAll = async () => {
    if (!confirm('🚨 PERINGATAN KERAS!\n\nIni akan menghapus SEMUA DATA:\n- Master Barang\n- Master Customer\n- Master Kategori, Spesifikasi, Merk\n- Master Periode\n- Purchase Orders\n- Transaksi Penjualan\n- Stok\n- DAN SEMUA DATA LAINNYA!\n\nSistem akan kembali ke kondisi awal (kosong).\n\nApakah Anda BENAR-BENAR yakin?')) {
      return
    }

    if (!confirm('Konfirmasi terakhir: Apakah Anda yakin ingin menghapus SEMUA DATA?\n\nTindakan ini TIDAK BISA dibatalkan!')) {
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/reset/all-data?confirm=yes')
      const data = await res.json()
      
      if (res.ok && data.success) {
        alert(`✅ Reset Total Berhasil!\n\nSemua data telah dihapus.\nSilakan refresh halaman.`)
        router.push('/')
        router.refresh()
      } else {
        alert(`❌ Gagal reset: ${data.error || 'Unknown error'}`)
      }
    } catch (e) {
      console.error(e)
      alert('❌ Terjadi kesalahan saat reset data')
    } finally {
      setLoading(false)
      setShowConfirmModal(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-sm text-slate-600 mt-1">Kelola pengaturan sistem dan perusahaan</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        {/* Tab Headers */}
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('company')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'company'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              🏢 Setting Perusahaan
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              ⚙️ Setting Umum
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'receipt'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              🧾 Setting Nota
            </button>
            <button
              onClick={() => setActiveTab('design')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'design'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              🎨 Setting Desain
            </button>
            <button
              onClick={() => setActiveTab('selforder')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'selforder'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              📱 Self Order
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Company Settings Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Informasi Perusahaan</h2>
                <p className="text-sm text-slate-600">Atur informasi perusahaan yang akan ditampilkan di laporan dan dokumen</p>
              </div>
              {/* Identitas Aplikasi (Logo) */}
              <div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Logo Aplikasi</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        try {
                          const fd = new FormData()
                          fd.append('file', f)
                          const res = await fetch('/api/upload', { method: 'POST', body: fd })
                          if (!res.ok) throw new Error('Upload gagal')
                          const out = await res.json()
                          setCompanySettings(prev => ({ ...prev, company_logo_url: out.url }))
                        } catch (err) {
                          console.error('Upload logo error:', err)
                          alert('Gagal upload logo. Pastikan format file benar (jpg/png/webp/gif).')
                        } finally {
                          try { if (e.target) (e.target as HTMLInputElement).value = '' } catch {}
                        }
                      }}
                    />
                    {companySettings.company_logo_url ? (
                      <div className="w-12 h-12 border rounded overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={companySettings.company_logo_url} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">Belum ada logo</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nama Perusahaan */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nama Perusahaan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companySettings.company_name}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_name: smartTitleCase(e.target.value) })}
                    placeholder="PT. Contoh Perusahaan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Alamat */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Alamat Perusahaan</label>
                  <textarea
                    value={companySettings.company_address}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_address: smartTitleCase(e.target.value) })}
                    placeholder="Jl. Contoh No. 123, Jakarta"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Kota */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Kota</label>
                  <input
                    type="text"
                    value={companySettings.company_city}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_city: smartTitleCase(e.target.value) })}
                    placeholder="Cirebon"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* No. Telepon */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">No. Telepon</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={companySettings.company_phone}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_phone: onlyDigits(e.target.value) })}
                    placeholder="021-1234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* No. HP */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">No. HP</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={companySettings.company_mobile}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_mobile: onlyDigits(e.target.value) })}
                    placeholder="0812-3456-7890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={companySettings.company_email}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_email: e.target.value })}
                    placeholder="info@perusahaan.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* NPWP */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">NPWP</label>
                  <input
                    type="text"
                    value={companySettings.company_npwp}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_npwp: onlyDigits(e.target.value) })}
                    placeholder="00.000.000.0-000.000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Alamat NPWP */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Alamat NPWP</label>
                  <textarea
                    value={companySettings.company_npwp_address}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_npwp_address: smartTitleCase(e.target.value) })}
                    placeholder="Alamat sesuai NPWP"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveCompanySettings}
                  disabled={saving}
                  className="px-6 py-2 bg-[#FFA16C] hover:bg-[#FF8F55] disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Setting'}
                </button>
              </div>
            </div>
          )}

          {/* Design Settings Tab */}
          {activeTab === 'design' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Tema Sidebar</h2>
                <p className="text-sm text-slate-600">Atur warna tema sidebar. Perubahan terlihat langsung (live preview).</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Sidebar Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#/.test(String(designSettings.design_sidebar_bg||'')) ? String(designSettings.design_sidebar_bg) : '#FFFFFF'}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_sidebar_bg:v}; setDesignSettings(next); applyDesignVars(next) }}
                      title="Pilih warna solid"
                    />
                    <input
                      type="text"
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      placeholder="CSS background: mis. linear-gradient(135deg, #0ea5e9, #3b82f6) atau #0ea5e9"
                      value={designSettings.design_sidebar_bg}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_sidebar_bg:v}; setDesignSettings(next); applyDesignVars(next) }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Isi warna hex atau CSS gradient. Color picker hanya untuk warna solid.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Sidebar Text</label>
                  <input type="color" value={designSettings.design_sidebar_text}
                    onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_sidebar_text:v}; setDesignSettings(next); applyDesignVars(next) }} />
                  <p className="text-[11px] text-slate-500 mt-1">Warna teks menu.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Hover Background</label>
                  <input type="color" value={designSettings.design_sidebar_hover_bg}
                    onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_sidebar_hover_bg:v}; setDesignSettings(next); applyDesignVars(next) }} />
                  <p className="text-[11px] text-slate-500 mt-1">Warna saat kursor di atas item.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Active Background</label>
                  <input type="color" value={designSettings.design_sidebar_active_bg}
                    onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_sidebar_active_bg:v}; setDesignSettings(next); applyDesignVars(next) }} />
                  <p className="text-[11px] text-slate-500 mt-1">Warna item menu aktif.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Active Text</label>
                  <input type="color" value={designSettings.design_sidebar_active_text}
                    onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_sidebar_active_text:v}; setDesignSettings(next); applyDesignVars(next) }} />
                  <p className="text-[11px] text-slate-500 mt-1">Warna teks item menu aktif.</p>
                </div>
              </div>
              {/* Mini Preview */}
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Preview</div>
                <div className="flex gap-2">
                  <div className="w-64 rounded border border-slate-200 overflow-hidden" style={{ background: designSettings.design_sidebar_bg, color: designSettings.design_sidebar_text }}>
                    <div className="px-3 py-2 border-b border-slate-200">Sidebar</div>
                    <div className="px-3 py-2">Menu A</div>
                    <div className="px-3 py-2" style={{ background: designSettings.design_sidebar_hover_bg }}>Menu (hover)</div>
                    <div className="px-3 py-2" style={{ background: designSettings.design_sidebar_active_bg, color: designSettings.design_sidebar_active_text }}>Menu (active)</div>
                  </div>
                </div>
              </div>

              {/* Login Background Settings */}
              <div className="pt-4 border-t">
                <h2 className="text-lg font-bold text-slate-800 mb-1">Background Halaman Login</h2>
                <p className="text-sm text-slate-600 mb-3">Gunakan warna solid atau gambar sebagai latar login. Perubahan terlihat langsung.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Teks Judul (Hero)</label>
                    <input
                      type="text"
                      value={designSettings.design_login_hero_title}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_hero_title:v}; setDesignSettings(next); applyDesignVars(next) }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Welcome Back"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Teks besar di sisi kiri halaman login.</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Teks Paragraf (Hero)</label>
                    <input
                      type="text"
                      value={designSettings.design_login_hero_subtitle}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_hero_subtitle:v}; setDesignSettings(next); applyDesignVars(next) }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Silakan login untuk melanjutkan"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Teks kecil di bawah judul hero.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tipe Background</label>
                    <select
                      value={designSettings.design_login_bg_type}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_bg_type:v}; setDesignSettings(next); applyDesignVars(next) }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="color">Warna</option>
                      <option value="image">Gambar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Warna Background (jika tipe Warna)</label>
                    <input type="color" value={designSettings.design_login_bg_color}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_bg_color:v}; setDesignSettings(next); applyDesignVars(next) }} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Gambar Background (jika tipe Gambar)</label>
                    <div className="flex items-center gap-3">
                      <input type="file" accept="image/*" onChange={async (e)=>{
                        const f = e.target.files?.[0]; if(!f) return; try {
                          const fd = new FormData(); fd.append('file', f);
                          const res = await fetch('/api/upload', { method:'POST', body: fd });
                          if (!res.ok) throw new Error('Upload gagal');
                          const out = await res.json();
                          const next={...designSettings, design_login_bg_url: out.url, design_login_bg_type: 'image'}; setDesignSettings(next); applyDesignVars(next);
                        } catch(err){ alert('Gagal upload gambar'); } finally { try { if (e.target) (e.target as HTMLInputElement).value=''; } catch{} }
                      }} />
                      {designSettings.design_login_bg_url ? (
                        <div className="w-24 h-12 border rounded overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={designSettings.design_login_bg_url} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : <div className="text-[11px] text-slate-500">Belum ada gambar</div>}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Gunakan gambar lebar (mis. 1600×900) agar bagus di layar besar.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Warna Overlay</label>
                    <input type="color" value={designSettings.design_login_overlay_color}
                      onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_overlay_color:v}; setDesignSettings(next); applyDesignVars(next) }} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Opacity Overlay (0–1)</label>
                    <input type="number" min={0} max={1} step={0.05}
                      value={designSettings.design_login_overlay_opacity}
                      onChange={(e)=>{ let v=String(e.target.value); const n=Math.max(0, Math.min(1, Number(v)||0)); v=String(n); const next={...designSettings, design_login_overlay_opacity:v}; setDesignSettings(next); applyDesignVars(next) }}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                {/* Mobile Background Settings */}
                <div className="pt-4 border-t mt-4">
                  <h2 className="text-lg font-bold text-slate-800 mb-1">Background Mobile (HP / Tablet Portrait)</h2>
                  <p className="text-sm text-slate-600 mb-3">Background khusus saat diakses dari HP atau tablet portrait. Tidak tampil di desktop.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Tipe Background Mobile</label>
                      <select
                        value={designSettings.design_login_bg_mobile_type}
                        onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_bg_mobile_type:v}; setDesignSettings(next); applyDesignVars(next) }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option value="color">Warna</option>
                        <option value="image">Gambar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Warna Background Mobile</label>
                      <input type="color" value={designSettings.design_login_bg_mobile_color}
                        onChange={(e)=>{ const v=e.target.value; const next={...designSettings, design_login_bg_mobile_color:v}; setDesignSettings(next); applyDesignVars(next) }} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Gambar Background Mobile</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" onChange={async (e)=>{
                          const f = e.target.files?.[0]; if(!f) return; try {
                            const fd = new FormData(); fd.append('file', f);
                            const res = await fetch('/api/upload', { method:'POST', body: fd });
                            if (!res.ok) throw new Error('Upload gagal');
                            const out = await res.json();
                            const next={...designSettings, design_login_bg_mobile_url: out.url, design_login_bg_mobile_type: 'image'}; setDesignSettings(next); applyDesignVars(next);
                          } catch(err){ alert('Gagal upload gambar'); } finally { try { if (e.target) (e.target as HTMLInputElement).value=''; } catch{} }
                        }} />
                        {designSettings.design_login_bg_mobile_url ? (
                          <div className="w-24 h-12 border rounded overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={designSettings.design_login_bg_mobile_url} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : <div className="text-[11px] text-slate-500">Belum ada gambar</div>}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Preview Login */}
                <div>
                  <div className="text-sm font-semibold text-slate-700 mb-2">Preview Login</div>
                  <div className="relative h-40 rounded overflow-hidden border" style={{
                    backgroundColor: designSettings.design_login_bg_type==='color' ? designSettings.design_login_bg_color : undefined,
                    backgroundImage: designSettings.design_login_bg_type==='image' ? `url(${designSettings.design_login_bg_url})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center'
                  }}>
                    <div className="absolute inset-0" style={{ backgroundColor: designSettings.design_login_overlay_color, opacity: Number(designSettings.design_login_overlay_opacity||'0') }} />
                    <div className="absolute inset-0 grid grid-cols-2">
                      <div className="flex flex-col items-center justify-center text-white font-bold px-4 text-center">
                        <div>{designSettings.design_login_hero_title || 'Welcome Back'}</div>
                        <div className="mt-1 text-[11px] font-medium opacity-90">{designSettings.design_login_hero_subtitle || ''}</div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="bg-white/90 rounded p-2 text-xs">Form Login</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  onClick={async()=>{
                    if (!confirm('Kembalikan ke warna default sistem?')) return
                    const next = { ...defaultDesign }
                    setDesignSettings(next)
                    applyDesignVars(next)
                    try {
                      const payload = Object.entries(next).map(([key,value])=>({ key, value, group: 'design' }))
                      await fetch('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ settings: payload }) })
                      alert('✓ Tema dikembalikan ke default')
                    } catch { alert('Gagal reset tema') }
                  }}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                >Reset ke Default</button>
                <button
                  onClick={async()=>{
                    try {
                      const payload = Object.entries(designSettings).map(([key,value])=>({ key, value, group: 'design' }))
                      const res = await fetch('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ settings: payload }) })
                      if (!res.ok) throw new Error('Failed')
                      alert('✓ Tema disimpan')
                    } catch { alert('Gagal menyimpan tema') }
                  }}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                >Simpan</button>
              </div>
            </div>
          )}

          {/* Self Order Settings Tab */}
          {activeTab === 'selforder' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Pengaturan Self Order</h2>
                <p className="text-sm text-slate-600">Konfiturasi sistem self order pelanggan</p>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">📱 Self Order</h3>
                    <p className="text-xs text-slate-500">Pengaturan cache dan metode pembayaran</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await saveGroup('selforder', selfOrderSettings)
                        alert('✓ Pengaturan self order berhasil disimpan!')
                      } catch {
                        alert('Gagal menyimpan')
                      }
                    }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >Simpan</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cache Time (jam)</label>
                    <select
                      value={selfOrderSettings.self_order_cache_ttl_hours}
                      onChange={e => setSelfOrderSettings(v => ({ ...v, self_order_cache_ttl_hours: e.target.value }))}
                      className="w-full px-3 py-1.5 border rounded text-sm"
                    >
                      <option value="1">1 jam</option>
                      <option value="2">2 jam</option>
                      <option value="3">3 jam</option>
                      <option value="4">4 jam</option>
                      <option value="5">5 jam</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Lama waktu cache data self order</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Self Pay</label>
                    <select
                      value={selfOrderSettings.self_order_self_pay}
                      onChange={e => setSelfOrderSettings(v => ({ ...v, self_order_self_pay: e.target.value }))}
                      className="w-full px-3 py-1.5 border rounded text-sm"
                    >
                      <option value="0">Tidak Aktif (Bayar di Kasir)</option>
                      <option value="1">Aktif (QRIS / Bayar Sendiri)</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Aktifkan pembayaran mandiri melalui QRIS</p>
                  </div>
                </div>
              </div>

              {/* Midtrans Server Key */}
              <MidtransKeySection />
            </div>
          )}

          {/* Receipt Settings Tab */}
          {activeTab === 'receipt' && <ReceiptSettings />}

          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Pengaturan Umum</h2>
                <p className="text-sm text-slate-600">Pengaturan umum sistem dan reset data</p>
              </div>

              {/* Grup: Barang */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">📦 Grup Barang</h3>
                    <p className="text-xs text-slate-500">Pengaturan default untuk master barang</p>
                  </div>
                  <button
                    onClick={async()=>{ try { await saveGroup('barang', barangSettings); alert('✓ Tersimpan') } catch { alert('Gagal menyimpan') } }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >Simpan</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Prefix Kode Barang</label>
                    <input value={barangSettings.barang_code_prefix}
                      onChange={e=>setBarangSettings(v=>({...v, barang_code_prefix: e.target.value.toUpperCase()}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Satuan Default</label>
                    <input value={barangSettings.barang_default_unit}
                      onChange={e=>setBarangSettings(v=>({...v, barang_default_unit: smartTitleCase(e.target.value)}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input id="barang_auto_title" type="checkbox" checked={barangSettings.barang_auto_title_case_name==='1'}
                      onChange={e=>setBarangSettings(v=>({...v, barang_auto_title_case_name: e.target.checked?'1':'0'}))} />
                    <label htmlFor="barang_auto_title" className="text-sm text-slate-700">Auto Title Case Nama</label>
                  </div>
                </div>
              </div>

              {/* Grup: Umum */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">⚙️ Grup Umum</h3>
                    <p className="text-xs text-slate-500">Pengaturan umum transaksi</p>
                  </div>
                  <button
                    onClick={async()=>{ try { await saveGroup('general', umumSettings); alert('✓ Tersimpan') } catch { alert('Gagal menyimpan') } }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >Simpan</button>
                </div>
                <div className="flex items-center gap-2" style={{ display: 'none' }}>
                  <input id="general_allow_backdate" type="checkbox" checked={umumSettings.general_allow_backdate==='1'}
                    onChange={e=>setUmumSettings(v=>({...v, general_allow_backdate: e.target.checked?'1':'0'}))} />
                  <label htmlFor="general_allow_backdate" className="text-sm text-slate-700">
                    <span className="font-medium">Boleh edit tanggal transaksi (pindah ke Level Manager)</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Setting ini dipindah ke hak akses per menu di Level Manager.
                    </span>
                  </label>
                </div>
              </div>

              {/* Grup: Penjualan */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">🧾 Grup Penjualan</h3>
                    <p className="text-xs text-slate-500">Pengaturan default untuk transaksi penjualan</p>
                  </div>
                  <button
                    onClick={async()=>{ 
                      try { 
                        console.log('Saving penjualan settings:', penjualanSettings)
                        const result = await saveGroup('penjualan', penjualanSettings)
                        console.log('Save result:', result)
                        alert('✓ Pengaturan penjualan berhasil disimpan!') 
                      } catch (e: any) { 
                        console.error('Error saving penjualan settings:', e)
                        alert('❌ Gagal menyimpan: ' + (e.message || 'Unknown error')) 
                      } 
                    }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >Simpan</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Prefix No. Invoice</label>
                    <input value={penjualanSettings.sales_invoice_prefix}
                      onChange={e=>setPenjualanSettings(v=>({...v, sales_invoice_prefix: e.target.value.toUpperCase()}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Term (hari)</label>
                    <input type="number" value={penjualanSettings.sales_default_terms}
                      onChange={e=>setPenjualanSettings(v=>({...v, sales_default_terms: String(Math.max(0, Number(e.target.value)||0))}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mode Harga (PPN)</label>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="sales_ppn_mode" checked={penjualanSettings.sales_include_tax==='1'}
                          onChange={()=>setPenjualanSettings(v=>({...v, sales_include_tax: '1'}))} />
                        <span>Include PPN</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="sales_ppn_mode" checked={penjualanSettings.sales_include_tax!=='1'}
                          onChange={()=>setPenjualanSettings(v=>({...v, sales_include_tax: '0'}))} />
                        <span>Exclude PPN</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Default PPN (%)</label>
                    <input type="number" min={0} max={100} step={0.01}
                      value={penjualanSettings.sales_default_ppn_percent}
                      onChange={e=>{
                        const n = Math.max(0, Math.min(100, Number(e.target.value)||0))
                        setPenjualanSettings(v=>({...v, sales_default_ppn_percent: String(n)}))
                      }}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Service Charge (%)</label>
                    <input type="number" min={0} max={100} step={0.01}
                      value={penjualanSettings.sales_default_service_percent}
                      onChange={e=>{
                        const n = Math.max(0, Math.min(100, Number(e.target.value)||0))
                        setPenjualanSettings(v=>({...v, sales_default_service_percent: String(n)}))
                      }}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input id="sales_allow_negative" type="checkbox" checked={penjualanSettings.sales_allow_negative==='1'}
                      onChange={e=>setPenjualanSettings(v=>({...v, sales_allow_negative: e.target.checked?'1':'0'}))} />
                    <label htmlFor="sales_allow_negative" className="text-sm text-slate-700">Boleh jual meskipun stok minus</label>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2">
                    <select id="sales_deduct_ingredients"
                      value={penjualanSettings.sales_deduct_ingredients_stock}
                      onChange={e=>setPenjualanSettings(v=>({...v, sales_deduct_ingredients_stock: e.target.value}))}
                      className="form-select border rounded px-3 py-2 text-sm w-48">
                      <option value="0">Jangan potong stok</option>
                      <option value="1">Potong bahan baku langsung</option>
                      <option value="auto">Produksi otomatis + potong barang jadi</option>
                    </select>
                    <label htmlFor="sales_deduct_ingredients" className="text-sm text-slate-700">
                      <span className="font-medium">Metode Potong Stok Penjualan</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        <strong>Jangan potong stok</strong> — penjualan tidak memotong stok apapun. 
                        <strong> Potong bahan baku langsung</strong> — kurangi stok ingredient sesuai resep (HPP bahan). 
                        <strong> Produksi otomatis</strong> — buat produksi otomatis dulu (barang jadi dapat HPP), lalu potong barang jadi.
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <input id="sales_tanpa_stok" type="checkbox" checked={penjualanSettings.sales_tanpa_stok==='1'}
                      onChange={e=>setPenjualanSettings(v=>({...v, sales_tanpa_stok: e.target.checked?'1':'0'}))} />
                    <label htmlFor="sales_tanpa_stok" className="text-sm text-slate-700">
                      <span className="font-medium">Tidak potong stok (Penjualan tanpa stok)</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Jika dicentang, transaksi penjualan TIDAK akan memotong stok barang sama sekali. Cocok untuk perusahaan jasa / dagang yang tidak menggunakan stok.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Grup: Pembelian */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">🧾 Grup Pembelian</h3>
                    <p className="text-xs text-slate-500">Pengaturan default untuk transaksi pembelian</p>
                  </div>
                  <button
                    onClick={async()=>{ try { await saveGroup('pembelian', pembelianSettings); alert('✓ Tersimpan') } catch { alert('Gagal menyimpan') } }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >Simpan</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Prefix No. Pembelian</label>
                    <input value={pembelianSettings.purchase_invoice_prefix}
                      onChange={e=>setPembelianSettings(v=>({...v, purchase_invoice_prefix: e.target.value.toUpperCase()}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Term (hari)</label>
                    <input type="number" value={pembelianSettings.purchase_default_terms}
                      onChange={e=>setPembelianSettings(v=>({...v, purchase_default_terms: String(Math.max(0, Number(e.target.value)||0))}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input id="purchase_inc_tax" type="checkbox" checked={pembelianSettings.purchase_include_tax==='1'}
                      onChange={e=>setPembelianSettings(v=>({...v, purchase_include_tax: e.target.checked?'1':'0'}))} />
                    <label htmlFor="purchase_inc_tax" className="text-sm text-slate-700">Harga termasuk pajak</label>
                  </div>
                </div>
              </div>

              {/* Grup: Stok */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">📈 Grup Stok</h3>
                    <p className="text-xs text-slate-500">Pengaturan terkait pergerakan & saldo stok</p>
                  </div>
                  <button
                    onClick={async()=>{ try { await saveGroup('stok', stokSettings); alert('✓ Tersimpan') } catch { alert('Gagal menyimpan') } }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >Simpan</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <input id="allow_negative" type="checkbox" checked={stokSettings.stock_allow_negative==='1'}
                      onChange={e=>setStokSettings(v=>({...v, stock_allow_negative: e.target.checked?'1':'0'}))} />
                    <label htmlFor="allow_negative" className="text-sm text-slate-700">Izinkan stok minus</label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gudang Default</label>
                    <input value={stokSettings.stock_default_warehouse}
                      onChange={e=>setStokSettings(v=>({...v, stock_default_warehouse: smartTitleCase(e.target.value)}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Metode HPP</label>
                    <select value={stokSettings.stock_cost_method}
                      onChange={e=>setStokSettings(v=>({...v, stock_cost_method: e.target.value}))}
                      className="w-full px-3 py-1.5 border rounded">
                      <option value="periodic">Periodic Weighted Average</option>
                      <option value="moving">Moving Average</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="auto_reconcile" type="checkbox" checked={stokSettings.auto_reconcile_enabled==='1'}
                      onChange={e=>setStokSettings(v=>({...v, auto_reconcile_enabled: e.target.checked?'1':'0'}))} />
                    <label htmlFor="auto_reconcile" className="text-sm text-slate-700">Auto-reconcile stok (quantity)</label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Interval Reconcile (menit)</label>
                    <input type="number" min={5} value={stokSettings.auto_reconcile_interval_minutes}
                      onChange={e=>setStokSettings(v=>({...v, auto_reconcile_interval_minutes: e.target.value}))}
                      className="w-full px-3 py-1.5 border rounded" />
                  </div>
                </div>
              </div>

              {/* Grup: Printer POS — dihide, setting printer ada di tab Setting Nota */}

              {restoring && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-lg p-6 shadow-xl text-center">
                    <div className="text-2xl mb-2 animate-spin">⏳</div>
                    <div className="text-sm font-medium text-slate-800">Merestore database...</div>
                    <div className="text-xs text-slate-500 mt-1">Jangan tutup halaman ini</div>
                  </div>
                </div>
              )}

              {/* Database Schema Check & Sync */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">🔍 Database Schema Check & Sync</h3>
                    <p className="text-xs text-slate-500">Cek apakah struktur tabel database sudah sesuai dengan kode program. Jika ada yang kurang, bisa sync otomatis.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          setSyncing(true)
                          setSyncResult(null)
                          const res = await fetch('/api/db/check')
                          const data = await res.json()
                          setSyncResult(data)
                        } catch (e: any) {
                          alert('Gagal check database: ' + (e?.message || e))
                        } finally {
                          setSyncing(false)
                        }
                      }}
                      disabled={syncing}
                      className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-sm"
                    >{syncing ? 'Memeriksa…' : 'Check Sekarang'}</button>
                    <button
                      onClick={async () => {
                        if (!confirm('Sync database akan menambah tabel/kolom yang kurang. Lanjutkan?')) return
                        try {
                          setSyncing(true)
                          setSyncResult(null)
                          const res = await fetch('/api/db/sync', { method: 'POST' })
                          const data = await res.json()
                          setSyncResult(data)
                          if (data.sync?.tablesCreated > 0 || data.sync?.columnsAdded > 0) {
                            alert(`✅ Sync selesai: ${data.sync.tablesCreated} tabel, ${data.sync.columnsAdded} kolom ditambahkan`)
                          } else if (data.check?.ok) {
                            alert('✓ Database sudah sesuai')
                          }
                        } catch (e: any) {
                          alert('Gagal sync database: ' + (e?.message || e))
                        } finally {
                          setSyncing(false)
                        }
                      }}
                      disabled={syncing}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm"
                    >{syncing ? 'Processing…' : 'Sync Otomatis'}</button>
                  </div>
                </div>

                {syncResult && (
                  <div className="border rounded-md">
                    <div className="px-3 py-2 border-b bg-slate-50 text-xs text-slate-600">Hasil Pengecekan</div>
                    <div className="p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                      {syncResult.check?.ok ? (
                        <div className="text-emerald-600 font-semibold">✓ Database schema sudah sesuai dengan kode program</div>
                      ) : (
                        <>
                          {syncResult.check?.missingTables?.length > 0 && (
                            <div className="text-red-600">
                              <div className="font-semibold">Tabel kurang ({syncResult.check.missingTables.length}):</div>
                              {syncResult.check.missingTables.map((t: any) => (
                                <div key={t.tableName} className="ml-2">- {t.tableName} ({t.columns.length} kolom)</div>
                              ))}
                            </div>
                          )}
                          {syncResult.check?.missingColumns?.length > 0 && (
                            <div className="text-red-600 mt-2">
                              <div className="font-semibold">Kolom kurang ({syncResult.check.missingColumns.length} tabel):</div>
                              {syncResult.check.missingColumns.map((mc: any) => (
                                <div key={mc.table} className="ml-2">
                                  <div className="font-medium">{mc.table}:</div>
                                  {mc.columns.map((col: any) => (
                                    <div key={col.name} className="ml-4">- {col.name} ({col.columnType})</div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                          {syncResult.sync?.errors?.length > 0 && (
                            <div className="text-red-600 mt-2">
                              <div className="font-semibold">Error sync:</div>
                              {syncResult.sync.errors.map((err: string, i: number) => (
                                <div key={i} className="ml-2">! {err}</div>
                              ))}
                            </div>
                          )}
                          {syncResult.sync?.tablesCreated > 0 && (
                            <div className="text-emerald-600 mt-2">✅ {syncResult.sync.tablesCreated} tabel berhasil dibuat</div>
                          )}
                          {syncResult.sync?.columnsAdded > 0 && (
                            <div className="text-emerald-600">✅ {syncResult.sync.columnsAdded} kolom berhasil ditambahkan</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Backup & Restore */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">💾 Backup & Restore Database (PostgreSQL)</h3>
                    <p className="text-xs text-slate-500">Backup file database `.sql` dengan timestamp, dan restore dari backup atau file upload.</p>
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    disabled={creatingBackup || restoring}
                    className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm"
                  >{creatingBackup ? 'Membuat…' : 'Buat Backup Sekarang'}</button>
                </div>

                <div className="border rounded-md">
                  <div className="px-3 py-2 border-b bg-slate-50 text-xs text-slate-600">Daftar Backup (tersimpan di server)</div>
                  <div className="p-3">
                    {backupsLoading ? (
                      <div className="text-xs text-slate-600">Memuat daftar backup…</div>
                    ) : backups.length === 0 ? (
                      <div className="text-xs text-slate-600">Belum ada backup.</div>
                    ) : (
                      <div className="space-y-2">
                        {backups.map((b) => (
                          <div key={b.name} className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-800 truncate">{b.name}</div>
                              <div className="text-[11px] text-slate-500">{formatBytes(b.size)} • {new Date(b.modifiedAt).toLocaleString()}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleDownloadBackup(b.name)}
                                disabled={restoring}
                                className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-50"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => handleRestoreFromBackup(b.name)}
                                disabled={restoring}
                                className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white"
                              >
                                {restoring ? 'Merestore…' : 'Restore / Patch'}
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(b.name)}
                                disabled={restoring}
                                className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
                                title="Hapus backup"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload and validate */}
                <div className="border rounded-md">
                    <div className="px-3 py-2 border-b bg-slate-50 text-xs text-slate-600">Restore dari File (.sql)</div>
                  <div className="p-3 space-y-3">
                    <input type="file" accept=".sql" disabled={restoring} onChange={(e)=>handleValidateUpload(e.target.files?.[0] || null)} />
                    {uploadingFile && <div className="text-xs text-slate-600">Memvalidasi file…</div>}
                    {restoring && (
                      <div className="flex items-center gap-2 text-sm text-slate-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                        <svg className="animate-spin h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                        <span>Merestore database… harap tunggu dan jangan menutup halaman ini.</span>
                      </div>
                    )}
                    {uploadPreview && (
                      <div className="text-xs text-slate-700 space-y-1">
                        <div><span className="text-slate-500">Ukuran:</span> {formatBytes(uploadPreview.size)}</div>
                        <div><span className="text-slate-500">Integrity:</span> {uploadPreview.integrity}</div>
                        {uploadPreview.tables?.length ? (
                          <div>
                            <div className="text-slate-500">Tabel terdeteksi:</div>
                            <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-1">
                              {uploadPreview.tables.slice(0, 12).map(t => (
                                <span key={t} className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700">{t}</span>
                              ))}
                              {uploadPreview.tables.length > 12 && (
                                <span className="text-slate-500">dan {uploadPreview.tables.length - 12} lainnya…</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                        <div className="pt-2">
                          <button onClick={handleRestoreFromUpload} disabled={restoring} className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white">{restoring ? 'Merestore…' : 'Restore dari File Ini'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Auth / Security - Session */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-md font-semibold text-slate-800">Keamanan & Sesi Login</h3>
                  <p className="text-sm text-slate-600">Atur lama waktu sesi login sebelum kadaluarsa otomatis.</p>
                </div>
                <div className="p-4 grid md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Masa Sesi (jam)</label>
                    <input
                      type="number"
                      min={1}
                      value={authSettings.auth_session_ttl_hours}
                      onChange={(e)=>setAuthSettings(v=>({ ...v, auth_session_ttl_hours: String(Math.max(1, Number(e.target.value)||1)) }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Contoh: 2 jam. Pengguna akan diminta login ulang setelah waktu ini.</p>
                  </div>
                  <div className="flex md:justify-end">
                    <button
                      onClick={async()=>{
                        try {
                          await saveGroup('auth', authSettings)
                          alert('✅ Pengaturan sesi login disimpan')
                        } catch(e:any){
                          alert('❌ Gagal menyimpan: ' + (e?.message || e))
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset Data Section */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-800">🗑️ Reset Data</h3>
                <p className="text-sm text-slate-600">
                  Gunakan fitur ini dengan hati-hati. Reset data tidak dapat dibatalkan.
                </p>

                {/* Reset Transactions Only */}
                <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 mb-1">
                        Reset Transaksi & Stok
                      </h4>
                      <p className="text-sm text-slate-600 mb-3">
                        Menghapus semua transaksi penjualan, pembelian/PO, modul stok (transfer, pemakaian, opname), data keuangan (AR/AP, GL, jurnal, kas/bank, memorial), pergerakan stok, dan saldo stok.
                        <br />
                        <strong>Master data tetap aman</strong> (Barang, Customer, Periode, dll).
                      </p>
                      <ul className="text-xs text-slate-600 space-y-1">
                        <li>✅ Master Barang - <strong>TIDAK dihapus</strong></li>
                        <li>✅ Master Customer - <strong>TIDAK dihapus</strong></li>
                        <li>❌ Transaksi Penjualan - <strong>DIHAPUS</strong></li>
                        <li>❌ Purchase Orders - <strong>DIHAPUS</strong></li>
                        <li>❌ Item Purchase Orders - <strong>DIHAPUS</strong></li>
                        <li>❌ Pembelian - <strong>DIHAPUS</strong></li>
                        <li>❌ Item Pembelian - <strong>DIHAPUS</strong></li>
                        <li>❌ Transfer Stok - <strong>DIHAPUS</strong></li>
                        <li>❌ Item Transfer Stok - <strong>DIHAPUS</strong></li>
                        <li>❌ Pemakaian Stok - <strong>DIHAPUS</strong></li>
                        <li>❌ Item Pemakaian Stok - <strong>DIHAPUS</strong></li>
                        <li>❌ Stok Opname (draft/sesi) - <strong>DIHAPUS</strong></li>
                        <li>❌ Item Stok Opname & Hitungan - <strong>DIHAPUS</strong></li>
                        <li>❌ Reservasi - <strong>DIHAPUS</strong></li>
                        <li>❌ Relasi Meja Reservasi - <strong>DIHAPUS</strong></li>
                        <li>❌ Pergerakan Stok - <strong>DIHAPUS</strong></li>
                        <li>❌ Saldo Stok - <strong>DIHAPUS</strong></li>
                      </ul>
                    </div>
                    <button
                      onClick={handleResetTransactions}
                      disabled={loading}
                      className="ml-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? 'Memproses...' : 'Reset Transaksi'}
                    </button>
                  </div>
                </div>

                {/* Reset All Data */}
                <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-800 mb-1">
                        🚨 Reset Total (Semua Data)
                      </h4>
                      <p className="text-sm text-red-700 mb-3">
                        <strong>PERINGATAN KERAS!</strong> Menghapus SEMUA data termasuk master data.
                      </p>
                      <ul className="text-xs text-red-700 space-y-1">
                        <li>❌ Master Barang - <strong>DIHAPUS</strong></li>
                        <li>❌ Master Customer - <strong>DIHAPUS</strong></li>
                        <li>❌ Purchase Orders - <strong>DIHAPUS</strong></li>
                        <li>❌ Transaksi Penjualan - <strong>DIHAPUS</strong></li>
                        <li>❌ Semua Data Lainnya - <strong>DIHAPUS</strong></li>
                      </ul>
                    </div>
                    <button
                      onClick={handleResetAll}
                      disabled={loading}
                      className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? 'Memproses...' : 'Reset Total'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
