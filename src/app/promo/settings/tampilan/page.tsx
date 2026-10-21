'use client'

import { useEffect, useState } from 'react'
import { useAuthGuard } from '@/components/promo/useAuthGuard'
import Button from '@/components/ui/Button'
import FileUpload from '@/components/ui/FileUpload'

type Settings = {
  mainBackgroundType: string
  mainBackgroundValue: string | null
  menuBackgroundType: string
  menuBackgroundValue: string | null
  promoHeaderBg: string | null
  menuHeaderBg: string | null
  promoDiscountBg: string | null
  menuPriceColor: string | null
  cardBorderColor: string | null
  dividerColor: string | null
  promoCardTextColor: string | null
  promoCardDescriptionColor: string | null
  promoCardPriceColor: string | null
  menuCardTextColor: string | null
  heroImage: string | null
  heroTitle: string | null
  heroSubtitle: string | null
  promoCardBg: string | null
  menuDescColor: string | null
  menuCaptionColor: string | null
  categoryActiveBg: string | null
  categoryActiveText: string | null
  categoryInactiveBg: string | null
  categoryInactiveText: string | null
  categoryInactiveBorder: string | null
  categoryLabelBg: string | null
  categoryLabelText: string | null
  categoryLabelBorder: string | null
}

function BgField({ label, type, value, onType, onValue }: {
  label: string
  type: string
  value: string
  onType: (v: string) => void
  onValue: (v: string) => void
}) {
  return (
    <div className="border border-teal-bg rounded-card p-3 space-y-2">
      <div className="text-xs font-medium text-slate-700">{label}</div>
      <div className="flex items-center gap-3">
        <span className="w-20 text-slate-600 shrink-0 text-xs">Tipe</span>
        <select
          value={type}
          onChange={(e) => onType(e.target.value)}
          className="rounded-pill border border-slate-300 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-bg"
        >
          <option value="default">Default</option>
          <option value="color">Warna</option>
          <option value="image">Gambar</option>
        </select>
      </div>
      {type === 'color' && (
        <div className="flex items-center gap-3">
          <span className="w-20 text-slate-600 shrink-0 text-xs">Warna</span>
          <input type="color" value={value || '#EFF8F7'} onChange={(e) => onValue(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
          <span className="text-xs text-slate-400">{value || '-'}</span>
        </div>
      )}
      {type === 'image' && (
        <div className="flex items-center gap-3">
          <span className="w-20 text-slate-600 shrink-0 text-xs">Gambar</span>
          <div className="flex-1">
            <FileUpload value={value || null} onChange={(u) => onValue(u || '')} uploadEndpoint="/api/upload" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function TampilanSettingsPage() {
  const ready = useAuthGuard()
  const [mainType, setMainType] = useState('default')
  const [mainValue, setMainValue] = useState('')
  const [menuType, setMenuType] = useState('default')
  const [menuValue, setMenuValue] = useState('')
  const [promoHeaderBg, setPromoHeaderBg] = useState('#ffffff')
  const [menuHeaderBg, setMenuHeaderBg] = useState('#ffffff')
  const [promoDiscountBg, setPromoDiscountBg] = useState('#f97316')
  const [menuPriceColor, setMenuPriceColor] = useState('#0d9488')
  const [cardBorderColor, setCardBorderColor] = useState('#E8F6F5')
  const [dividerColor, setDividerColor] = useState('#2BA8A2')
  const [promoCardTextColor, setPromoCardTextColor] = useState('#0f172a')
  const [promoCardDescriptionColor, setPromoCardDescriptionColor] = useState('#64748b')
  const [promoCardPriceColor, setPromoCardPriceColor] = useState('#0d9488')
  const [menuCardTextColor, setMenuCardTextColor] = useState('#1e293b')
  const [menuDescColor, setMenuDescColor] = useState('#8B7F6A')
  const [menuCaptionColor, setMenuCaptionColor] = useState('#9A8B7A')
  const [categoryActiveBg, setCategoryActiveBg] = useState('#1E3124')
  const [categoryActiveText, setCategoryActiveText] = useState('#ffffff')
  const [categoryInactiveBg, setCategoryInactiveBg] = useState('#F6F2EA')
  const [categoryInactiveText, setCategoryInactiveText] = useState('#5A4632')
  const [categoryInactiveBorder, setCategoryInactiveBorder] = useState('#E8E0C8')
  const [categoryLabelBg, setCategoryLabelBg] = useState('#ffffff')
  const [categoryLabelText, setCategoryLabelText] = useState('#1E3124')
  const [categoryLabelBorder, setCategoryLabelBorder] = useState('#EEE8D8')
  const [heroImage, setHeroImage] = useState('')
  const [heroTitle, setHeroTitle] = useState('Klapa Manis')
  const [heroSubtitle, setHeroSubtitle] = useState('Tradisi rasa, kehangatan bersama')
  const [promoCardBg, setPromoCardBg] = useState('#2A2520')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [pinMsg, setPinMsg] = useState('')

  useEffect(() => {
    if (!ready) return
    fetch('/api/promo/setting', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const s: Settings = d.settings || {}
        setMainType(s.mainBackgroundType || 'default')
        setMainValue(s.mainBackgroundValue || '')
        setMenuType(s.menuBackgroundType || 'default')
        setMenuValue(s.menuBackgroundValue || '')
        setPromoHeaderBg(s.promoHeaderBg || '#ffffff')
        setMenuHeaderBg(s.menuHeaderBg || '#ffffff')
        setPromoDiscountBg(s.promoDiscountBg || '#f97316')
        setMenuPriceColor(s.menuPriceColor || '#0d9488')
        setCardBorderColor(s.cardBorderColor || '#E8F6F5')
        setDividerColor(s.dividerColor || '#2BA8A2')
        setPromoCardTextColor(s.promoCardTextColor || '#0f172a')
        setPromoCardDescriptionColor(s.promoCardDescriptionColor || '#64748b')
        setPromoCardPriceColor(s.promoCardPriceColor || '#0d9488')
        setMenuCardTextColor(s.menuCardTextColor || '#1e293b')
        setMenuDescColor(s.menuDescColor || '#8B7F6A')
        setMenuCaptionColor(s.menuCaptionColor || '#9A8B7A')
        setCategoryActiveBg(s.categoryActiveBg || '#1E3124')
        setCategoryActiveText(s.categoryActiveText || '#ffffff')
        setCategoryInactiveBg(s.categoryInactiveBg || '#F6F2EA')
        setCategoryInactiveText(s.categoryInactiveText || '#5A4632')
        setCategoryInactiveBorder(s.categoryInactiveBorder || '#E8E0C8')
        setCategoryLabelBg(s.categoryLabelBg || '#ffffff')
        setCategoryLabelText(s.categoryLabelText || '#1E3124')
        setCategoryLabelBorder(s.categoryLabelBorder || '#EEE8D8')
        setHeroImage(s.heroImage || '')
        setHeroTitle(s.heroTitle ?? '')
        setHeroSubtitle(s.heroSubtitle ?? '')
        setPromoCardBg(s.promoCardBg || '#2A2520')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready])

  const onSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/promo/setting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainBackgroundType: mainType,
          mainBackgroundValue: mainType === 'default' ? '' : mainValue,
          menuBackgroundType: menuType,
          menuBackgroundValue: menuType === 'default' ? '' : menuValue,
          promoHeaderBg,
          menuHeaderBg,
          promoDiscountBg,
          menuPriceColor,
          cardBorderColor,
          dividerColor,
          promoCardTextColor,
          promoCardDescriptionColor,
          promoCardPriceColor,
          menuCardTextColor,
          menuDescColor,
          menuCaptionColor,
          categoryActiveBg,
          categoryActiveText,
          categoryInactiveBg,
          categoryInactiveText,
          categoryInactiveBorder,
          categoryLabelBg,
          categoryLabelText,
          categoryLabelBorder,
          heroImage,
          heroTitle,
          heroSubtitle,
          promoCardBg,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal simpan') }
      alert('Tersimpan')
    } catch (e: any) {
      alert(e?.message || 'Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const savePin = async () => {
    setPinMsg('')
    try {
      const res = await fetch('/api/promo/pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal simpan PIN') }
      setPinMsg('PIN tersimpan')
      setPinInput('')
    } catch (e: any) {
      setPinMsg(e?.message || 'Gagal simpan PIN')
    }
  }

  if (!ready) return <div className="p-4 text-center text-slate-400">Memuat...</div>

  return (
    <div className="min-h-screen w-full bg-surface-base">
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Tampilan Landing</h1>
            <p className="text-xs text-slate-500">Atur background utama & background tiap menu</p>
          </div>
          <a href="/promo/settings" className="text-xs text-teal-primary hover:underline">← Setting</a>
        </div>

        {loading ? (
          <div className="container-card p-4 text-center text-slate-400 text-sm">Memuat...</div>
        ) : (
          <div className="space-y-3">
            <div className="border border-teal-bg rounded-card p-3 space-y-3">
              <div className="text-xs font-medium text-slate-700">Hero Restoran</div>
              <div className="text-[11px] text-slate-400">Bagian pembuka seperti halaman utama pada referensi.</div>
              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center gap-3">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Foto Hero</span>
                  <div className="flex-1">
                    <FileUpload value={heroImage || null} onChange={(u) => setHeroImage(u || '')} uploadEndpoint="/api/upload" />
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Judul Hero</span>
                  <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} className="flex-1 rounded-pill border border-slate-300 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-bg" />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Tagline Hero</span>
                  <input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} className="flex-1 rounded-pill border border-slate-300 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-bg" />
                </label>
              </div>
            </div>
            <BgField label="Background Utama (Halaman)" type={mainType} value={mainValue} onType={setMainType} onValue={setMainValue} />
            <BgField label="Background Tiap Menu (Kartu)" type={menuType} value={menuValue} onType={setMenuType} onValue={setMenuValue} />

            <div className="border border-teal-bg rounded-card p-3 space-y-3">
              <div className="text-xs font-medium text-slate-700">Warna Header & Card</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Header Promo</span>
                  <input type="color" value={promoHeaderBg} onChange={(e) => setPromoHeaderBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{promoHeaderBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Header Menu</span>
                  <input type="color" value={menuHeaderBg} onChange={(e) => setMenuHeaderBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{menuHeaderBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Badge Diskon Promo</span>
                  <input type="color" value={promoDiscountBg} onChange={(e) => setPromoDiscountBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{promoDiscountBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Harga Menu</span>
                  <input type="color" value={menuPriceColor} onChange={(e) => setMenuPriceColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{menuPriceColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Border Card</span>
                  <input type="color" value={cardBorderColor} onChange={(e) => setCardBorderColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{cardBorderColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Garis Pemisah</span>
                  <input type="color" value={dividerColor} onChange={(e) => setDividerColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{dividerColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Background Card Promo</span>
                  <input type="color" value={promoCardBg} onChange={(e) => setPromoCardBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{promoCardBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Font Nama Promo</span>
                  <input type="color" value={promoCardTextColor} onChange={(e) => setPromoCardTextColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{promoCardTextColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Font Deskripsi Promo</span>
                  <input type="color" value={promoCardDescriptionColor} onChange={(e) => setPromoCardDescriptionColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{promoCardDescriptionColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Font Harga Promo</span>
                  <input type="color" value={promoCardPriceColor} onChange={(e) => setPromoCardPriceColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{promoCardPriceColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Font Nama Menu</span>
                  <input type="color" value={menuCardTextColor} onChange={(e) => setMenuCardTextColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{menuCardTextColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Font Deskripsi Menu</span>
                  <input type="color" value={menuDescColor} onChange={(e) => setMenuDescColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{menuDescColor}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Font Caption Menu</span>
                  <input type="color" value={menuCaptionColor} onChange={(e) => setMenuCaptionColor(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{menuCaptionColor}</span>
                </label>
              </div>
              <div className="text-[10px] text-slate-400">Header = pill & header kartu promo/menu. Diskon = badge -% & harga promo. Default putih/coral/teal bila kosong.</div>
            </div>

            <div className="border border-teal-bg rounded-card p-3 space-y-3">
              <div className="text-xs font-medium text-slate-700">Warna Tombol Kategori (Filter)</div>
              <div className="text-[11px] text-slate-400">Tombol filter di atas daftar menu: Semua / Makanan / Minuman / Paket / Baru</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Aktif - Background</span>
                  <input type="color" value={categoryActiveBg} onChange={(e) => setCategoryActiveBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryActiveBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Aktif - Teks</span>
                  <input type="color" value={categoryActiveText} onChange={(e) => setCategoryActiveText(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryActiveText}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Nonaktif - Background</span>
                  <input type="color" value={categoryInactiveBg} onChange={(e) => setCategoryInactiveBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryInactiveBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Nonaktif - Teks</span>
                  <input type="color" value={categoryInactiveText} onChange={(e) => setCategoryInactiveText(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryInactiveText}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Nonaktif - Border</span>
                  <input type="color" value={categoryInactiveBorder} onChange={(e) => setCategoryInactiveBorder(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryInactiveBorder}</span>
                </label>
              </div>
            </div>

            <div className="border border-teal-bg rounded-card p-3 space-y-3">
              <div className="text-xs font-medium text-slate-700">Warna Label Kategori Makanan</div>
              <div className="text-[11px] text-slate-400">Pill label di atas tiap grup menu (misal “Makanan”, “Minuman”) dan garis divider</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Label - Background</span>
                  <input type="color" value={categoryLabelBg} onChange={(e) => setCategoryLabelBg(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryLabelBg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Label - Teks</span>
                  <input type="color" value={categoryLabelText} onChange={(e) => setCategoryLabelText(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryLabelText}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-32 text-xs text-slate-600 shrink-0">Label - Border</span>
                  <input type="color" value={categoryLabelBorder} onChange={(e) => setCategoryLabelBorder(e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                  <span className="text-xs text-slate-400">{categoryLabelBorder}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>

            <div className="border border-teal-bg rounded-card p-3 space-y-2">
              <div className="text-xs font-medium text-slate-700">PIN Akses Setting</div>
              <div className="text-[11px] text-slate-400">PIN dipakai untuk membuka halaman setting. Isi & simpan untuk membuat/mengubah PIN (4–8 digit angka).</div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN baru (4-8 digit)"
                  className="flex-1 rounded-pill border border-slate-300 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-bg"
                />
                <Button onClick={savePin}>Simpan PIN</Button>
              </div>
              {pinMsg && <div className="text-[11px] text-teal-primary">{pinMsg}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
