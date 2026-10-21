'use client'

import { useState, useEffect, useRef } from 'react'
import { onlyDigits } from '@/lib/textFormat'

type KV = Record<string, string>

type LayoutCfg = {
  header_title: string
  show_company: '0'|'1'
  show_address: '0'|'1'
  show_phone: '0'|'1'
  show_invoice_code: '0'|'1'
  separator_char: '-'|'='
  thankyou_text: string
  align_header: 'left'|'center'
  columns_style: 'standard'|'compact'
  label_subtotal: string
  label_tax: string
  label_total: string
  label_paid: string
  label_change: string
  // Font layout global
  header_font_bold: '0'|'1'
  header_font_scale: '0'|'1'|'2'|'3'
  total_font_bold: '0'|'1'
  total_font_scale: '0'|'1'|'2'|'3'
  item_font_condensed: '0'|'1'
}

export default function ReceiptSettings() {
  const [deviceId, setDeviceId] = useState('')
  const [companySettings, setCompanySettings] = useState<KV>({})

  // Printer POS (per device)
  const [printerSettings, setPrinterSettings] = useState<KV>({
    printer_device_name: '',
    printer_paper_size: '80mm',
    printer_copies: '1',
    printer_auto_print: '0',
    printer_cut_paper: '1',
    printer_chars_per_line: '48',
    printer_font: 'B',
    printer_condensed: '1',
    printer_line_spacing: '24',
    printer_font_width_mul: '0',
    printer_font_height_mul: '0',
    printer_backend_mode: 'server',
    printer_network_host: '',
    printer_network_port: '9100',
    printer_local_helper_id: '',
    printer_local_helper_ip: '',
    printer_local_usb_name: '',
  })
  const [findingPrinters, setFindingPrinters] = useState(false)
  const [localHelperPrinters, setLocalHelperPrinters] = useState<any[]>([])
  const [usbPrinters, setUsbPrinters] = useState<any[]>([])
  const [findingUsbPrinters, setFindingUsbPrinters] = useState(false)
  const [btPrinters, setBtPrinters] = useState<any[]>([])
  const [findingBtPrinters, setFindingBtPrinters] = useState(false)
  const [webusbStatus, setWebusbStatus] = useState('')
  const [testingPrint, setTestingPrint] = useState(false)

  // Caption Order (per device)
  const [captionCfg, setCaptionCfg] = useState<KV>({
    order_caption_enabled: '0',
    order_caption_header: 'ORDER PESANAN',
    order_caption_show_customer: '1',
    order_caption_show_table: '1',
    order_caption_footer: '',
    cap_backend_mode: 'server',
    cap_network_host: '',
    cap_network_port: '9100',
    cap_local_helper_id: '',
    cap_local_helper_ip: '',
    cap_local_usb_name: ''
  })

  // Kitchen/Pantry (per device)
  const [kitchenCfg, setKitchenCfg] = useState<KV>({
    kitchen_print_mode: 'combined',
    combined_backend_mode: 'server',
    combined_network_host: '',
    combined_network_port: '9100',
    combined_local_helper_id: '',
    combined_local_helper_ip: '',
    combined_local_usb_name: '',
    pantry_backend_mode: 'server',
    pantry_network_host: '',
    pantry_network_port: '9100',
    pantry_local_helper_id: '',
    pantry_local_helper_ip: '',
    pantry_local_usb_name: '',
    kitchen_backend_mode: 'server',
    kitchen_network_host: '',
    kitchen_network_port: '9100',
    kitchen_local_helper_id: '',
    kitchen_local_helper_ip: '',
    kitchen_local_usb_name: ''
  })

  // Customer Display promo (per browser/PC)
  const [promoImage, setPromoImage] = useState<string | null>(null)
  const [promoName, setPromoName] = useState('')
  const promoFileRef = useRef<HTMLInputElement>(null)
  const promoBcRef = useRef<BroadcastChannel | null>(null)

  // Layout Nota (GLOBAL)
  const [layoutCfg, setLayoutCfg] = useState<LayoutCfg>({
    header_title: '',
    show_company: '1',
    show_address: '1',
    show_phone: '1',
    show_invoice_code: '1',
    separator_char: '-',
    thankyou_text: 'Terima kasih',
    align_header: 'center',
    columns_style: 'standard',
    label_subtotal: 'Subtotal',
    label_tax: 'PPN',
    label_total: 'TOTAL',
    label_paid: 'Bayar',
    label_change: 'Kembali',
    header_font_bold: '1',
    header_font_scale: '1',
    total_font_bold: '1',
    total_font_scale: '1',
    item_font_condensed: '0',
  })

  // ── device_id cookie ──
  useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        const getCookie = (name: string) => document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1]
        let did = getCookie('device_id')
        if (!did) {
          const uuid = (crypto && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2))
          const exp = new Date(); exp.setFullYear(exp.getFullYear() + 5)
          document.cookie = `device_id=${uuid}; path=/; expires=${exp.toUTCString()}`
          did = uuid
        }
        setDeviceId(did || '')
      }
    } catch { }
  }, [])

  // ── Load company settings (for preview) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings?group=company')
        if (!res.ok) return
        const rows = await res.json()
        const map: KV = {}
        ;(rows || []).forEach((r: any) => { map[r.setting_key] = r.setting_value || '' })
        setCompanySettings(map)
      } catch { }
    })()
  }, [])

  // ── Load & listen promo customer display ──
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('pos_customer_promo_image')
      if (saved) {
        setPromoImage(saved)
        setPromoName(window.localStorage.getItem('pos_customer_promo_image_name') || '')
      }
    } catch { }
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('pos_customer_promo')
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'promo') {
          setPromoImage(ev.data.image || null)
          setPromoName(ev.data.name || '')
        }
      }
      promoBcRef.current = bc
    } catch { }
    return () => { try { bc?.close() } catch { } }
  }, [])

  const onPromoFile = (e: any) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      try {
        window.localStorage.setItem('pos_customer_promo_image', url)
        window.localStorage.setItem('pos_customer_promo_image_name', f.name)
      } catch { }
      setPromoImage(url)
      setPromoName(f.name)
      try { promoBcRef.current?.postMessage({ type: 'promo', image: url, name: f.name }) } catch { }
    }
    reader.readAsDataURL(f)
  }

  const removePromo = () => {
    try {
      window.localStorage.removeItem('pos_customer_promo_image')
      window.localStorage.removeItem('pos_customer_promo_image_name')
    } catch { }
    setPromoImage(null)
    setPromoName('')
    try { promoBcRef.current?.postMessage({ type: 'promo', image: null, name: '' }) } catch { }
  }

  // ── Load per-device printer, caption, kitchen ──
  useEffect(() => {
    if (!deviceId) return;
    (async () => {
      const a = await loadClientGroup('printer')
      if (Object.keys(a).length) setPrinterSettings(v => ({ ...v, ...a }))
      const b = await loadClientGroup('order_caption_client')
      if (Object.keys(b).length) setCaptionCfg(v => ({ ...v, ...b }))
      const c = await loadClientGroup('kitchen_client')
      if (Object.keys(c).length) setKitchenCfg(v => ({ ...v, ...c }))
    })()
  }, [deviceId])

  // ── Load global layout ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings?group=printer_layout', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const map: KV = {}
        ;(data || []).forEach((row: any) => { map[row.setting_key] = row.setting_value ?? '' })
        setLayoutCfg(prev => ({
          ...prev,
          header_title: map.header_title ?? prev.header_title,
          show_company: (map.show_company as any) ?? prev.show_company,
          show_address: (map.show_address as any) ?? prev.show_address,
          show_phone: (map.show_phone as any) ?? prev.show_phone,
          show_invoice_code: (map.show_invoice_code as any) ?? prev.show_invoice_code,
          separator_char: (map.separator_char as any) || prev.separator_char,
          thankyou_text: map.thankyou_text ?? prev.thankyou_text,
          align_header: (map.align_header as any) || prev.align_header,
          columns_style: (map.columns_style as any) || prev.columns_style,
          label_subtotal: map.label_subtotal ?? prev.label_subtotal,
          label_tax: map.label_tax ?? prev.label_tax,
          label_total: map.label_total ?? prev.label_total,
          label_paid: map.label_paid ?? prev.label_paid,
          label_change: map.label_change ?? prev.label_change,
          header_font_bold: (map.header_font_bold as any) ?? prev.header_font_bold,
          header_font_scale: (map.header_font_scale as any) ?? prev.header_font_scale,
          total_font_bold: (map.total_font_bold as any) ?? prev.total_font_bold,
          total_font_scale: (map.total_font_scale as any) ?? prev.total_font_scale,
          item_font_condensed: (map.item_font_condensed as any) ?? prev.item_font_condensed,
        }))
      } catch { }
    })()
  }, [])

  // ── Helpers ──
  const loadClientGroup = async (group: string): Promise<KV> => {
    if (!deviceId) return {}
    try {
      const res = await fetch(`/api/client-settings?device_id=${encodeURIComponent(deviceId)}&group=${encodeURIComponent(group)}`)
      const data = await res.json()
      if (!res.ok) return {}
      const map: KV = {}
      ;(data?.settings || []).forEach((row: any) => { map[row.setting_key] = String(row.setting_value ?? '') })
      return map
    } catch { return {} }
  }

  const saveClientGroup = async (group: string, kv: KV) => {
    if (!deviceId) throw new Error('device_id missing')
    const settings = Object.entries(kv).map(([key, value]) => ({ key, value }))
    const res = await fetch('/api/client-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, group, settings }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to save client settings')
    return data
  }

  const saveGroup = async (group: string, kv: KV) => {
    const payload = Object.entries(kv).map(([key, value]) => ({ key, value, group }))
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
    return data
  }

  // ── Test print handlers ──
  const handleTestPrint = async () => {
    try {
      setTestingPrint(true)
      const mode = printerSettings.printer_backend_mode
      const copies = Math.max(1, Math.min(5, Number(printerSettings.printer_copies) || 1))
      const cut = printerSettings.printer_cut_paper === '1'
      const sample = 'TEST PRINT POS\nTerima kasih.\n\n'
      if (mode === 'server') {
        const host = (printerSettings.printer_network_host || '').trim()
        const port = Number(printerSettings.printer_network_port || '9100')
        if (!host) { alert('Isi IP/Host printer jaringan terlebih dahulu'); return }
        for (let i = 0; i < copies; i++) {
          const res = await fetch('/api/print/escpos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, host, port, cut: cut && i === copies - 1 }) })
          if (!res.ok) { const body = await res.json().catch(()=>{}); throw new Error(body?.details || body?.error || 'Server print gagal') }
        }
        alert('Test print dikirim via server TCP')
      } else if (mode === 'local_helper') {
        const id = printerSettings.printer_local_helper_id || ''
        const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
        for (let i = 0; i < copies; i++) {
          const res = await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: cut && i === copies - 1, id }) })
          if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(body || 'Local Helper error (HTTP ' + res.status + ')') }
        }
        alert('Test print dikirim via Local Helper ke ' + baseUrl)
      } else if (mode === 'local_helper_apk') {
        const id = printerSettings.printer_local_helper_id || ''
        const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
        for (let i = 0; i < copies; i++) {
          const res = await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: cut && i === copies - 1, id }) })
          if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(body || 'HelperPOS APK error (HTTP ' + res.status + ')') }
        }
        alert('Test print dikirim via HelperPOS APK ke ' + baseUrl)
      } else if (mode === 'local_helper_offline') {
        const printerName = printerSettings.printer_local_usb_name || ''
        if (!printerName) { alert('Pilih USB printer atau Bluetooth COM port terlebih dahulu'); return }
        for (let i = 0; i < copies; i++) {
          const res = await fetch('http://127.0.0.1:27128/print/usb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: cut && i === copies - 1, printerName }) })
          if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(body || 'USB Printer tidak merespon (HTTP ' + res.status + ')') }
        }
        alert('Test print dikirim via USB Offline' + (printerName.toUpperCase().startsWith('COM') ? ` (COM: ${printerName})` : ''))
      } else if (mode === 'mobile_rawbt') {
        const base64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(sample))) : ''
        window.location.href = 'rawbt:base64,' + base64
      } else if (mode === 'android_intent') {
        const encoded = typeof window !== 'undefined' ? encodeURIComponent(sample) : ''
        window.location.href = 'posprint://print?text=' + encoded + '&printer=0'
      } else if (mode === 'browser_print') {
        const w = window.open('', '_blank', 'width=480,height=640')
        if (w) {
          w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${sample.replace(/</g, '&lt;')}</pre><script>window.focus();window.print();</script>`)
          w.document.close()
        } else { alert('Popup diblokir. Izinkan popup untuk test print.') }
      } else {
        alert('Pilih Mode Cetak: Server, Mobile (RawBT), atau Browser Print')
      }
    } catch (e: any) {
      console.error(e)
      alert('Gagal test print: ' + (e?.message || e))
    } finally { setTestingPrint(false) }
  }

  const handleTestPrintCaption = async () => {
    try {
      const sample = 'TEST CAPTION ORDER\nItem Contoh\nQty: 1\n\n'
      const mode = captionCfg.cap_backend_mode || 'server'
      if (mode === 'server') {
        const host = (captionCfg.cap_network_host || '').trim()
        const port = Number(captionCfg.cap_network_port || '9100') || 9100
        if (!host) { alert('Isi IP/Host Caption Printer terlebih dahulu'); return }
        const res = await fetch('/api/print/escpos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, host, port, cut: true }) })
        if (!res.ok) { const body = await res.json().catch(()=>{}); throw new Error(body?.details || body?.error || 'Gagal kirim ke Caption Printer (Server)') }
      } else if (mode === 'local_helper') {
        const id = captionCfg.cap_local_helper_id || ''
        if (!id) { alert('Pilih printer Local Helper untuk Caption terlebih dahulu'); return }
        const res = await fetch('/api/local-helper/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('Local Helper tidak merespon untuk Caption')
      } else if (mode === 'local_helper_apk') {
        const id = captionCfg.cap_local_helper_id || ''
        if (!id) { alert('Pilih printer HelperPOS APK untuk Caption terlebih dahulu'); return }
        const h = captionCfg.cap_local_helper_ip || printerSettings.printer_local_helper_ip || ''
        if (!h.trim()) { alert('Isi IP HP untuk Caption terlebih dahulu'); return }
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
        const res = await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('HelperPOS APK tidak merespon untuk Caption')
      } else if (mode === 'local_helper_offline') {
        const printerName = captionCfg.cap_local_usb_name || ''
        if (!printerName) { alert('Pilih USB printer untuk Caption terlebih dahulu'); return }
        const res = await fetch('http://127.0.0.1:27128/print/usb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, printerName }) })
        if (!res.ok) throw new Error('USB Printer tidak merespon untuk Caption')
      } else {
        alert('Pilih backend Caption Printer terlebih dahulu')
        return
      }
      alert('Test print Caption Order dikirim')
    } catch (e: any) { console.error(e); alert('Gagal test print Caption: ' + (e?.message || e)) }
  }

  const handleTestPrintKitchenCombined = async () => {
    try {
      const sample = 'TEST DAPUR (Combined)\nItem Contoh\nQty: 1\n\n'
      const mode = kitchenCfg.combined_backend_mode || 'server'
      if (mode === 'server') {
        const host = (kitchenCfg.combined_network_host || '').trim(); const port = Number(kitchenCfg.combined_network_port || '9100') || 9100
        if (!host) { alert('Isi IP/Host Printer Gabungan terlebih dahulu'); return }
        const res = await fetch('/api/print/escpos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, host, port, cut: true }) })
        if (!res.ok) { const body = await res.json().catch(()=>{}); throw new Error(body?.details || body?.error || 'Gagal kirim ke Printer Gabungan (Server)') }
      } else if (mode === 'local_helper') {
        const id = kitchenCfg.combined_local_helper_id || ''
        if (!id) { alert('Pilih printer Local Helper untuk Printer Gabungan terlebih dahulu'); return }
        const res = await fetch('/api/local-helper/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('Local Helper tidak merespon untuk Printer Gabungan')
      } else if (mode === 'local_helper_apk') {
        const id = kitchenCfg.combined_local_helper_id || ''
        if (!id) { alert('Pilih printer HelperPOS APK untuk Printer Gabungan terlebih dahulu'); return }
        const h = kitchenCfg.combined_local_helper_ip || printerSettings.printer_local_helper_ip || ''
        if (!h.trim()) { alert('Isi IP HP untuk Printer Gabungan terlebih dahulu'); return }
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
        const res = await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('HelperPOS APK tidak merespon untuk Printer Gabungan')
      } else if (mode === 'local_helper_offline') {
        const printerName = kitchenCfg.combined_local_usb_name || ''
        if (!printerName) { alert('Pilih USB printer untuk Printer Gabungan terlebih dahulu'); return }
        const res = await fetch('http://127.0.0.1:27128/print/usb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, printerName }) })
        if (!res.ok) throw new Error('USB Printer tidak merespon untuk Printer Gabungan')
      } else { alert('Pilih backend Printer Gabungan terlebih dahulu'); return }
      alert('Test print Printer Gabungan dikirim')
    } catch (e: any) { console.error(e); alert('Gagal test print Printer Gabungan: ' + (e?.message || e)) }
  }

  const handleTestPrintPantry = async () => {
    try {
      const sample = 'TEST PANTRY\nItem Minuman Contoh\nQty: 1\n\n'
      const mode = kitchenCfg.pantry_backend_mode || 'server'
      if (mode === 'server') {
        const host = (kitchenCfg.pantry_network_host || '').trim(); const port = Number(kitchenCfg.pantry_network_port || '9100') || 9100
        if (!host) { alert('Isi IP/Host Printer Pantry terlebih dahulu'); return }
        const res = await fetch('/api/print/escpos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, host, port, cut: true }) })
        if (!res.ok) { const body = await res.json().catch(()=>{}); throw new Error(body?.details || body?.error || 'Gagal kirim ke Printer Pantry (Server)') }
      } else if (mode === 'local_helper') {
        const id = kitchenCfg.pantry_local_helper_id || ''
        if (!id) { alert('Pilih printer Local Helper untuk Pantry terlebih dahulu'); return }
        const res = await fetch('/api/local-helper/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('Local Helper tidak merespon untuk Pantry')
      } else if (mode === 'local_helper_apk') {
        const id = kitchenCfg.pantry_local_helper_id || ''
        if (!id) { alert('Pilih printer HelperPOS APK untuk Pantry terlebih dahulu'); return }
        const h = kitchenCfg.pantry_local_helper_ip || printerSettings.printer_local_helper_ip || ''
        if (!h.trim()) { alert('Isi IP HP untuk Pantry terlebih dahulu'); return }
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
        const res = await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('HelperPOS APK tidak merespon untuk Pantry')
      } else if (mode === 'local_helper_offline') {
        const printerName = kitchenCfg.pantry_local_usb_name || ''
        if (!printerName) { alert('Pilih USB printer untuk Pantry terlebih dahulu'); return }
        const res = await fetch('http://127.0.0.1:27128/print/usb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, printerName }) })
        if (!res.ok) throw new Error('USB Printer tidak merespon untuk Pantry')
      } else { alert('Pilih backend Printer Pantry terlebih dahulu'); return }
      alert('Test print Pantry dikirim')
    } catch (e: any) { console.error(e); alert('Gagal test print Pantry: ' + (e?.message || e)) }
  }

  const handleTestPrintKitchen = async () => {
    try {
      const sample = 'TEST KITCHEN\nItem Makanan Contoh\nQty: 1\n\n'
      const mode = kitchenCfg.kitchen_backend_mode || 'server'
      if (mode === 'server') {
        const host = (kitchenCfg.kitchen_network_host || '').trim(); const port = Number(kitchenCfg.kitchen_network_port || '9100') || 9100
        if (!host) { alert('Isi IP/Host Printer Kitchen terlebih dahulu'); return }
        const res = await fetch('/api/print/escpos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, host, port, cut: true }) })
        if (!res.ok) { const body = await res.json().catch(()=>{}); throw new Error(body?.details || body?.error || 'Gagal kirim ke Printer Kitchen (Server)') }
      } else if (mode === 'local_helper') {
        const id = kitchenCfg.kitchen_local_helper_id || ''
        if (!id) { alert('Pilih printer Local Helper untuk Kitchen terlebih dahulu'); return }
        const res = await fetch('/api/local-helper/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('Local Helper tidak merespon untuk Kitchen')
      } else if (mode === 'local_helper_apk') {
        const id = kitchenCfg.kitchen_local_helper_id || ''
        if (!id) { alert('Pilih printer HelperPOS APK untuk Kitchen terlebih dahulu'); return }
        const h = kitchenCfg.kitchen_local_helper_ip || printerSettings.printer_local_helper_ip || ''
        if (!h.trim()) { alert('Isi IP HP untuk Kitchen terlebih dahulu'); return }
        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
        const res = await fetch(`${baseUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, id }) })
        if (!res.ok) throw new Error('HelperPOS APK tidak merespon untuk Kitchen')
      } else if (mode === 'local_helper_offline') {
        const printerName = kitchenCfg.kitchen_local_usb_name || ''
        if (!printerName) { alert('Pilih USB printer untuk Kitchen terlebih dahulu'); return }
        const res = await fetch('http://127.0.0.1:27128/print/usb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sample, cut: true, printerName }) })
        if (!res.ok) throw new Error('USB Printer tidak merespon untuk Kitchen')
      } else { alert('Pilih backend Printer Kitchen terlebih dahulu'); return }
      alert('Test print Kitchen dikirim')
    } catch (e: any) { console.error(e); alert('Gagal test print Kitchen: ' + (e?.message || e)) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Setting Nota POS</h2>
        <p className="text-sm text-slate-600">Atur printer dan layout struk khusus perangkat ini</p>
      </div>

      {/* ── Grup: Printer POS ── */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">🖨️ Grup Printer POS</h3>
            <p className="text-xs text-slate-500">Pengaturan printer untuk cetak struk</p>
          </div>
          <button
            onClick={async () => {
              try {
                if (!deviceId) { alert('device_id tidak tersedia. Muat ulang halaman dan coba lagi.'); return }
                await saveClientGroup('printer', printerSettings)
                alert('✓ Setting printer POS tersimpan untuk perangkat ini')
              } catch (e: any) { console.error('Save printer settings error:', e); alert('Gagal menyimpan setting printer POS: ' + (e?.message || e)) }
            }}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >Simpan</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode Cetak (Current: {printerSettings.printer_backend_mode})</label>
            <select
              key={printerSettings.printer_backend_mode}
              value={printerSettings.printer_backend_mode}
              onChange={e => setPrinterSettings(v => ({ ...v, printer_backend_mode: e.target.value }))}
              className="w-full px-3 py-1.5 border rounded"
            >
              <option value="server">Server (Network TCP)</option>
              <option value="local_helper">Local Helper (USB PC)</option>
              <option value="local_helper_apk">Local Helper (Android APK)</option>
              <option value="local_helper_offline">Local Helper USB Offline</option>
              <option value="webusb">WebUSB (Chrome/Edge - USB Printer)</option>
              <option value="mobile_rawbt">Mobile (RawBT - Android)</option>
              <option value="android_intent">Mobile (Android Intent - Print Helper)</option>
              <option value="browser_print">Browser Print (AirPrint)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nama Printer Default</label>
            <input value={printerSettings.printer_device_name} onChange={e => setPrinterSettings(v => ({ ...v, printer_device_name: e.target.value }))} placeholder="Contoh: EPSON TM-T82III" className="w-full px-3 py-1.5 border rounded" />
            <div className="mt-2 text-[11px] text-slate-500">
              Untuk Mode Server gunakan IP/Port. Untuk Local Helper (USB PC) pastikan service lokal berjalan. Untuk Android gunakan Mobile (RawBT) atau Android Intent (Print Helper). Field nama printer opsional (catatan internal).
            </div>
            {printerSettings.printer_backend_mode === 'local_helper' && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    try {
                      setFindingPrinters(true)
                      const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
                      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                      const res = await fetch(`${baseUrl}/printers`)
                      const data = await res.json().catch(() => ({}))
                      const list = Array.isArray(data?.printers) ? data.printers : []
                      setLocalHelperPrinters(list)
                      if (list.length && !printerSettings.printer_local_helper_id) {
                        setPrinterSettings(v => ({ ...v, printer_local_helper_id: String(list[0]?.id || '') }))
                      }
                    } catch (e) { alert('Gagal mendeteksi printer dari Local Helper') }
                    finally { setFindingPrinters(false) }
                  }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100">
                    {findingPrinters ? 'Mencari…' : 'Deteksi (Local Helper)'}
                  </button>
                  <select value={printerSettings.printer_local_helper_id} onChange={e => { setPrinterSettings(v => ({ ...v, printer_local_helper_id: e.target.value })) }} className="px-2 py-1 text-xs border rounded min-w-[260px]">
                    {localHelperPrinters.length === 0 ? (
                      <option value="">(Belum ada daftar dari Local Helper)</option>
                    ) : (
                      localHelperPrinters.map((p: any) => <option key={String(p.id || p.path || p.name)} value={String(p.id || p.path || p.name)}>{p.name || p.device || p.path || ('Printer ' + String(p.id))}</option>)
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">Local Helper endpoint default: http://127.0.0.1:27128. Pastikan aplikasi helper berjalan di PC ini.</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Helper URL:</label>
                  <input value={printerSettings.printer_local_helper_ip} onChange={e => setPrinterSettings(v => ({ ...v, printer_local_helper_ip: e.target.value }))} placeholder="127.0.0.1" className="px-2 py-1 text-xs border rounded flex-1" />
                </div>
                <p className="text-[11px] text-slate-500">IP komputer atau URL helper (contoh: 192.168.1.100 atau https://xxx.trycloudflare.com). Default 127.0.0.1 (PC sendiri).</p>
              </div>
            )}
            {printerSettings.printer_backend_mode === 'local_helper_apk' && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    try {
                      setFindingPrinters(true)
                      const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
                      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                      const res = await fetch(`${baseUrl}/printers`)
                      const data = await res.json().catch(() => ({}))
                      const list = Array.isArray(data?.printers) ? data.printers : []
                      setLocalHelperPrinters(list)
                      if (list.length && !printerSettings.printer_local_helper_id) {
                        setPrinterSettings(v => ({ ...v, printer_local_helper_id: String(list[0]?.id || '') }))
                      }
                    } catch (e) { alert('Gagal mendeteksi printer dari HelperPOS APK') }
                    finally { setFindingPrinters(false) }
                  }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100">
                    {findingPrinters ? 'Mencari…' : 'Deteksi (HelperPOS APK)'}
                  </button>
                  <select value={printerSettings.printer_local_helper_id} onChange={e => { setPrinterSettings(v => ({ ...v, printer_local_helper_id: e.target.value })) }} className="px-2 py-1 text-xs border rounded min-w-[260px]">
                    {localHelperPrinters.length === 0 ? (
                      <option value="">(Belum ada daftar)</option>
                    ) : (
                      localHelperPrinters.map((p: any) => <option key={String(p.id || p.path || p.name)} value={String(p.id || p.path || p.name)}>{p.name || p.device || p.path || ('Printer ' + String(p.id))}</option>)
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">HelperPOS APK endpoint default: http://&lt;IP-HP&gt;:27128. Pastikan APK berjalan di HP dan HP dalam satu WiFi.</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">IP HP:</label>
                  <input value={printerSettings.printer_local_helper_ip} onChange={e => setPrinterSettings(v => ({ ...v, printer_local_helper_ip: e.target.value }))} placeholder="192.168.1.100" className="px-2 py-1 text-xs border rounded flex-1" />
                </div>
              </div>
            )}
            {printerSettings.printer_backend_mode === 'local_helper_offline' && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-xs text-slate-700 font-medium">USB Printer (Offline)</p>
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    try {
                      setFindingUsbPrinters(true)
                      const res = await fetch('http://127.0.0.1:27128/printers/usb')
                      const data = await res.json().catch(() => ({}))
                      const list = Array.isArray(data?.printers) ? data.printers : []
                      setUsbPrinters(list)
                      if (list.length && !printerSettings.printer_local_usb_name) {
                        setPrinterSettings(v => ({ ...v, printer_local_usb_name: String(list[0]?.name || '') }))
                      }
                    } catch (e) { alert('Gagal mendeteksi USB printer. Pastikan Local Helper sudah jalan di http://127.0.0.1:27128') }
                    finally { setFindingUsbPrinters(false) }
                  }} disabled={findingUsbPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100">
                    {findingUsbPrinters ? 'Mencari…' : 'Deteksi USB Printer'}
                  </button>
                  <select value={printerSettings.printer_local_usb_name} onChange={e => { setPrinterSettings(v => ({ ...v, printer_local_usb_name: e.target.value })) }} className="px-2 py-1 text-xs border rounded min-w-[260px]">
                    {usbPrinters.length === 0 && !printerSettings.printer_local_usb_name ? (
                      <option value="">(Klik Deteksi untuk lihat printer)</option>
                    ) : (
                      <>
                        {usbPrinters.map((p: any) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
                        {printerSettings.printer_local_usb_name && !usbPrinters.find((p: any) => String(p.name) === printerSettings.printer_local_usb_name) && !printerSettings.printer_local_usb_name.startsWith('COM') && (
                          <option value={printerSettings.printer_local_usb_name}>{printerSettings.printer_local_usb_name} (tersimpan)</option>
                        )}
                      </>
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">Pilih printer USB yang terdeteksi di Windows. Local Helper (index.js) harus berjalan di PC ini (http://127.0.0.1:27128).</p>

                <p className="text-xs text-slate-700 font-medium mt-1">Bluetooth Printer (COM Port)</p>
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    try {
                      setFindingBtPrinters(true)
                      const res = await fetch('http://127.0.0.1:27128/printers/bluetooth')
                      const data = await res.json().catch(() => ({}))
                      const comPorts = Array.isArray(data?.comPorts) ? data.comPorts : []
                      const outgoing = comPorts.filter((p: any) => p.isOutgoing)
                      const list = outgoing.length ? outgoing : comPorts
                      setBtPrinters(list)
                      if (list.length && !printerSettings.printer_local_usb_name) {
                        setPrinterSettings(v => ({ ...v, printer_local_usb_name: String(list[0]?.port || '') }))
                      }
                    } catch (e) { alert('Gagal mendeteksi Bluetooth printer. Pastikan Local Helper sudah jalan di http://127.0.0.1:27128') }
                    finally { setFindingBtPrinters(false) }
                  }} disabled={findingBtPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100">
                    {findingBtPrinters ? 'Mencari…' : 'Deteksi Bluetooth'}
                  </button>
                  <select value={printerSettings.printer_local_usb_name} onChange={e => { setPrinterSettings(v => ({ ...v, printer_local_usb_name: e.target.value })) }} className="px-2 py-1 text-xs border rounded min-w-[260px]">
                    {btPrinters.length === 0 && !printerSettings.printer_local_usb_name ? (
                      <option value="">(Klik Deteksi untuk lihat COM port)</option>
                    ) : (
                      <>
                        {btPrinters.map((p: any) => <option key={p.port} value={p.port}>{p.port} — {p.description}</option>)}
                        {printerSettings.printer_local_usb_name && !btPrinters.find((p: any) => String(p.port) === printerSettings.printer_local_usb_name) && (
                          <option value={printerSettings.printer_local_usb_name}>{printerSettings.printer_local_usb_name} (tersimpan)</option>
                        )}
                      </>
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">Pilih COM port Bluetooth (SPP) yang terdeteksi. Pastikan printer sudah di-pairing via Windows Settings.</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ukuran Kertas</label>
            <select value={printerSettings.printer_paper_size} onChange={e => {
              const sz = e.target.value
              const cur = Number(printerSettings.printer_chars_per_line) || 48
              const fontB = printerSettings.printer_font === 'B'
              const suggested = sz === '58mm' ? (fontB ? 42 : 32) : 48
              setPrinterSettings(v => ({ ...v, printer_paper_size: sz, printer_chars_per_line: (cur < 36 || cur > 52) ? String(suggested) : v.printer_chars_per_line }))
            }} className="w-full px-3 py-1.5 border rounded">
              <option value="58mm">58 mm</option>
              <option value="80mm">80 mm</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah Copy</label>
            <input type="number" min={1} max={5} value={printerSettings.printer_copies} onChange={e => setPrinterSettings(v => ({ ...v, printer_copies: String(Math.max(1, Math.min(5, Number(e.target.value) || 1))) }))} className="w-full px-3 py-1.5 border rounded" />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="auto_print" type="checkbox" checked={printerSettings.printer_auto_print === '1'} onChange={e => setPrinterSettings(v => ({ ...v, printer_auto_print: e.target.checked ? '1' : '0' }))} />
            <label htmlFor="auto_print" className="text-sm text-slate-700">Auto print setelah pembayaran</label>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="cut_paper" type="checkbox" checked={printerSettings.printer_cut_paper === '1'} onChange={e => setPrinterSettings(v => ({ ...v, printer_cut_paper: e.target.checked ? '1' : '0' }))} />
            <label htmlFor="cut_paper" className="text-sm text-slate-700">Potong kertas setelah cetak</label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Karakter per baris</label>
            <input type="text" inputMode="numeric" value={printerSettings.printer_chars_per_line} onChange={e => { const d = onlyDigits(e.target.value); setPrinterSettings(v => ({ ...v, printer_chars_per_line: d })) }} className="w-full px-3 py-1.5 border rounded" />
            <p className="text-[11px] text-slate-500 mt-1">
              {printerSettings.printer_paper_size === '58mm' ? `Rekomendasi 58mm: Font A=32, Font B=42. Saat ini: ${printerSettings.printer_chars_per_line || '?'}` : `Rekomendasi 80mm: Font A/B=48. Saat ini: ${printerSettings.printer_chars_per_line || '?'}`}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Font Nota</label>
            <select value={printerSettings.printer_font} onChange={e => {
              const f = e.target.value
              const is58 = printerSettings.printer_paper_size === '58mm'
              const cur = Number(printerSettings.printer_chars_per_line) || 48
              const suggested = is58 ? (f === 'B' ? 42 : 32) : 48
              setPrinterSettings(v => ({ ...v, printer_font: f, printer_chars_per_line: (cur < 36 || cur > 52) ? String(suggested) : v.printer_chars_per_line }))
            }} className="w-full px-3 py-1.5 border rounded">
              <option value="A">Font A (Normal - 12x24)</option>
              <option value="B">Font B (Kecil - 9x17)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Font A lebih besar, Font B lebih kecil dan muat lebih banyak karakter per baris.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ukuran Font</label>
            <input type="number" min={0} max={7} value={printerSettings.printer_font_height_mul || '0'} onChange={e => setPrinterSettings(v => ({ ...v, printer_font_height_mul: String(Math.max(0, Math.min(7, Number(e.target.value) || 0))), printer_font_width_mul: String(Math.max(0, Math.min(7, Number(e.target.value) || 0))) }))} className="w-full px-3 py-1.5 border rounded" />
            <p className="text-[11px] text-slate-500 mt-1">0 = terkecil, 7 = terbesar. Atur sesuai kebutuhan.</p>
          </div>
          {printerSettings.printer_backend_mode === 'webusb' && (
            <div className="md:col-span-3 border-t pt-3">
              <div className="flex items-center gap-3">
                <button onClick={async () => {
                  try {
                    setWebusbStatus('menghubungkan…')
                    const mod = await import('@/lib/printing/webusb')
                    if (!mod.isWebUSBSupported()) { setWebusbStatus('WebUSB tidak didukung browser ini'); return }
                    const dev = await mod.connectUSBPrinter()
                    if (dev) { setWebusbStatus(`Terhubung ke ${dev.productName || 'Printer USB'} (${dev.vendorId.toString(16)}:${dev.productId.toString(16)})`) }
                    else { setWebusbStatus('Gagal terhubung atau dibatalkan') }
                  } catch (e: any) { setWebusbStatus('Error: ' + e.message) }
                }} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Connect USB Printer</button>
                <button onClick={async () => {
                  try { const mod = await import('@/lib/printing/webusb'); await mod.disconnectUSBPrinter(); setWebusbStatus('') } catch { }
                }} className="px-3 py-1.5 text-xs rounded bg-red-500 text-white hover:bg-red-600">Disconnect</button>
                <button onClick={async () => {
                  try {
                    const mod = await import('@/lib/printing/webusb')
                    if (await mod.autoConnectFromRemembered()) {
                      const d = mod.getConnectedUSBPrinter()
                      setWebusbStatus(`Terhubung ke ${d?.productName || 'Printer USB'} (${d?.vendorId?.toString(16) || '?'}:${d?.productId?.toString(16) || '?'})`)
                    } else { setWebusbStatus('Tidak ada printer yang terdaftar. Klik "Connect USB Printer" untuk memilih.') }
                  } catch { }
                }} className="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300">Reconnect</button>
              </div>
              {webusbStatus && <p className="text-[11px] text-slate-500 mt-2">{webusbStatus}</p>}
              <p className="text-[11px] text-slate-500 mt-2">WebUSB hanya didukung di Chrome/Edge. Klik Connect, pilih printer thermal USB dari dialog browser.</p>
            </div>
          )}
          {printerSettings.printer_backend_mode === 'server' && (
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">IP/Host Printer Jaringan</label>
                <input value={printerSettings.printer_network_host} onChange={e => setPrinterSettings(v => ({ ...v, printer_network_host: e.target.value }))} placeholder="cth: 192.168.1.50" className="w-full px-3 py-1.5 border rounded" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
                <input type="number" min={1} max={65535} value={printerSettings.printer_network_port} onChange={e => setPrinterSettings(v => ({ ...v, printer_network_port: String(Math.max(1, Math.min(65535, Number(e.target.value) || 9100))) }))} className="w-full px-3 py-1.5 border rounded" />
              </div>
              <p className="md:col-span-3 text-[11px] text-slate-500">Mode Server akan mengirim ESC/POS ke printer jaringan dari backend. Pastikan printer di LAN dan IP/port benar (umum: 9100).</p>
            </div>
          )}
          <div className="md:col-span-3 border-t pt-3">
            <button
              onClick={handleTestPrint}
              disabled={testingPrint || (printerSettings.printer_backend_mode === 'server' && !String(printerSettings.printer_network_host || '').trim()) || (printerSettings.printer_backend_mode === 'local_helper' && !String(printerSettings.printer_local_helper_id || '').trim()) || (printerSettings.printer_backend_mode === 'local_helper_apk' && !String(printerSettings.printer_local_helper_id || '').trim())}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm"
            >{testingPrint ? 'Testing…' : 'Test Print'}</button>
            <p className="text-[11px] text-slate-500 mt-1">Gunakan sesuai mode: Server (butuh IP/Port), Local Helper (USB PC) butuh app helper berjalan, Mobile (RawBT) butuh aplikasi RawBT, Browser Print membuka dialog cetak.</p>
          </div>
        </div>
      </div>

      {/* ── Grup: Layar Pelanggan (Customer Display) ── */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">🖥️ Layar Pelanggan (Customer Display)</h3>
            <p className="text-xs text-slate-500">Upload gambar promo/info yang tampil di layar pelanggan (monitor portable)</p>
          </div>
          <button onClick={removePromo} disabled={!promoImage} className="px-3 py-1.5 rounded bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm">Hapus</button>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-48 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden bg-slate-50">
            {promoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={promoImage} alt="Promo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400 text-center px-2">Belum ada gambar</span>
            )}
          </div>
          <div className="space-y-2">
            <input ref={promoFileRef} type="file" accept="image/*" className="hidden" onChange={onPromoFile} />
            <button onClick={() => promoFileRef.current?.click()} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Pilih Gambar</button>
            {promoName && <p className="text-xs text-slate-500">{promoName}</p>}
            <p className="text-[11px] text-slate-500 max-w-xs">Gambar disimpan di browser PC ini dan otomatis tampil di Layar Pelanggan yang sedang terbuka.</p>
          </div>
        </div>
      </div>

      {/* ── Grup: Layout Nota POS (GLOBAL) ── */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">🧾 Layout Nota POS (GLOBAL)</h3>
            <p className="text-xs text-slate-500">Atur tampilan struk thermal. Berlaku untuk semua perangkat.</p>
          </div>
          <button onClick={async () => {
            try {
              const kv: KV = {
                header_title: layoutCfg.header_title, show_company: layoutCfg.show_company, show_address: layoutCfg.show_address,
                show_phone: layoutCfg.show_phone, show_invoice_code: layoutCfg.show_invoice_code, separator_char: layoutCfg.separator_char,
                thankyou_text: layoutCfg.thankyou_text, align_header: layoutCfg.align_header, columns_style: layoutCfg.columns_style,
                label_subtotal: layoutCfg.label_subtotal, label_tax: layoutCfg.label_tax, label_total: layoutCfg.label_total,
                label_paid: layoutCfg.label_paid, label_change: layoutCfg.label_change,
                header_font_bold: layoutCfg.header_font_bold, header_font_scale: layoutCfg.header_font_scale,
                total_font_bold: layoutCfg.total_font_bold, total_font_scale: layoutCfg.total_font_scale,
                item_font_condensed: layoutCfg.item_font_condensed,
              }
              await saveGroup('printer_layout', kv)
              alert('✓ Layout nota tersimpan (global)')
            } catch { alert('Gagal menyimpan layout') }
          }} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Simpan Layout</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul Header</label>
            <input value={layoutCfg.header_title} onChange={e => setLayoutCfg(v => ({ ...v, header_title: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="NOTA PENJUALAN" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Perataan Header</label>
            <select value={layoutCfg.align_header} onChange={e => setLayoutCfg(v => ({ ...v, align_header: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded">
              <option value="center">Tengah</option>
              <option value="left">Kiri</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gaya Kolom Item</label>
            <select value={layoutCfg.columns_style} onChange={e => setLayoutCfg(v => ({ ...v, columns_style: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded">
              <option value="standard">Standard (2 baris)</option>
              <option value="compact">Compact (1 baris)</option>
            </select>
          </div>
          {/* Font Layout */}
          <div className="md:col-span-3 border-t pt-3 mt-1">
            <p className="text-xs font-semibold text-slate-700 mb-2">Font & Ukuran</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Header Bold</label>
                <select value={layoutCfg.header_font_bold} onChange={e => setLayoutCfg(v => ({ ...v, header_font_bold: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded text-xs">
                  <option value="1">Ya</option>
                  <option value="0">Tidak</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Header Ukuran</label>
                <select value={layoutCfg.header_font_scale} onChange={e => setLayoutCfg(v => ({ ...v, header_font_scale: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded text-xs">
                  <option value="0">Normal</option>
                  <option value="1">Double Height</option>
                  <option value="2">Double Width</option>
                  <option value="3">Double Both</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Bold</label>
                <select value={layoutCfg.total_font_bold} onChange={e => setLayoutCfg(v => ({ ...v, total_font_bold: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded text-xs">
                  <option value="1">Ya</option>
                  <option value="0">Tidak</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Ukuran</label>
                <select value={layoutCfg.total_font_scale} onChange={e => setLayoutCfg(v => ({ ...v, total_font_scale: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded text-xs">
                  <option value="0">Normal</option>
                  <option value="1">Double Height</option>
                  <option value="2">Double Width</option>
                  <option value="3">Double Both</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Item Condensed</label>
                <select value={layoutCfg.item_font_condensed} onChange={e => setLayoutCfg(v => ({ ...v, item_font_condensed: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded text-xs">
                  <option value="0">Normal</option>
                  <option value="1">Condensed (rapat)</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Header = judul & info toko, Total = baris TOTAL, Item = daftar barang. Hanya berlaku untuk cetak ESC/POS (server / local helper).</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tampilkan Data Perusahaan</label>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={layoutCfg.show_company === '1'} onChange={e => setLayoutCfg(v => ({ ...v, show_company: e.target.checked ? '1' : '0' }))} /> Nama</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={layoutCfg.show_address === '1'} onChange={e => setLayoutCfg(v => ({ ...v, show_address: e.target.checked ? '1' : '0' }))} /> Alamat</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={layoutCfg.show_phone === '1'} onChange={e => setLayoutCfg(v => ({ ...v, show_phone: e.target.checked ? '1' : '0' }))} /> Telepon</label>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="show_invoice_code" type="checkbox" checked={layoutCfg.show_invoice_code === '1'} onChange={e => setLayoutCfg(v => ({ ...v, show_invoice_code: e.target.checked ? '1' : '0' }))} />
            <label htmlFor="show_invoice_code" className="text-sm text-slate-700">Tampilkan Kode Nota</label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Karakter Pemisah</label>
            <select value={layoutCfg.separator_char} onChange={e => setLayoutCfg(v => ({ ...v, separator_char: e.target.value as any }))} className="w-full px-3 py-1.5 border rounded">
              <option value="-">- (minus)</option>
              <option value="=">= (sama dengan)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Teks Footer</label>
            <textarea value={layoutCfg.thankyou_text} onChange={e => setLayoutCfg(v => ({ ...v, thankyou_text: e.target.value }))} className="w-full px-3 py-1.5 border rounded text-xs font-mono" rows={3} placeholder={"Terima kasih\nFollow IG: @resto_anda"} />
            <p className="text-[11px] text-slate-500 mt-1">Bisa diisi beberapa baris, misalnya ucapan terima kasih, info rekening, atau promo.</p>
          </div>
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Label Subtotal</label><input value={layoutCfg.label_subtotal} onChange={e => setLayoutCfg(v => ({ ...v, label_subtotal: e.target.value }))} className="w-full px-3 py-1.5 border rounded text-xs" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Label PPN</label><input value={layoutCfg.label_tax} onChange={e => setLayoutCfg(v => ({ ...v, label_tax: e.target.value }))} className="w-full px-3 py-1.5 border rounded text-xs" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Label TOTAL</label><input value={layoutCfg.label_total} onChange={e => setLayoutCfg(v => ({ ...v, label_total: e.target.value }))} className="w-full px-3 py-1.5 border rounded text-xs" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Label Bayar</label><input value={layoutCfg.label_paid} onChange={e => setLayoutCfg(v => ({ ...v, label_paid: e.target.value }))} className="w-full px-3 py-1.5 border rounded text-xs" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Label Kembali</label><input value={layoutCfg.label_change} onChange={e => setLayoutCfg(v => ({ ...v, label_change: e.target.value }))} className="w-full px-3 py-1.5 border rounded text-xs" /></div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Preview</label>
            <div className="bg-slate-50 border rounded p-3 overflow-auto">
              <pre className="text-[12px] leading-4 whitespace-pre-wrap font-mono">{(() => {
                const W = Math.max(24, Math.min(64, Number(printerSettings.printer_chars_per_line) || 48))
                const center = (s: string) => {
                  if (layoutCfg.align_header !== 'center') return s
                  const pad = Math.max(0, Math.floor((W - s.length) / 2))
                  return ' '.repeat(pad) + s
                }
                const sep = (layoutCfg.separator_char || '-').repeat(W)
                const lines: string[] = []
                if (layoutCfg.header_title) lines.push(center(layoutCfg.header_title.toUpperCase()))
                if (layoutCfg.show_company === '1') lines.push(center((companySettings?.company_name || '').toString()))
                if (layoutCfg.show_address === '1') lines.push(...String(companySettings?.company_address || '').split(/\n|,\s?/).map((l: string) => center(l)))
                if (layoutCfg.show_phone === '1') lines.push(center('Tel: ' + String(companySettings?.company_phone || '')))
                if (layoutCfg.show_invoice_code === '1') lines.push(center('No: SAMPLE-0001'))
                lines.push(sep)
                const itemLeft = layoutCfg.columns_style === 'compact' ? '1 x 10.000  = 10.000' : '1 x 10.000'
                const total = '10.000'
                const left = Math.max(0, W - itemLeft.length - total.length)
                if (layoutCfg.columns_style === 'standard') {
                  lines.push('Contoh Item Panjang Sekali')
                  lines.push(itemLeft + ' '.repeat(left) + total)
                } else {
                  lines.push('Contoh Item - ' + itemLeft + ' '.repeat(left) + total)
                }
                lines.push(sep)
                lines.push('TOTAL' + ' '.repeat(Math.max(0, W - 5 - total.length)) + total)
                lines.push(sep)
                if (layoutCfg.thankyou_text) lines.push(center(layoutCfg.thankyou_text))
                return lines.join('\n')
              })()}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* ── Grup: Caption Order (Per Perangkat) ── */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">🧾 Caption Order (Per Perangkat)</h3>
            <p className="text-xs text-slate-500">Struk ringkas untuk bar/line produksi. Dicetak otomatis setelah input penjualan.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleTestPrintCaption} className="px-2 py-1.5 rounded border border-emerald-600 text-emerald-700 text-xs hover:bg-emerald-50">Test Print</button>
            <button onClick={async () => {
              try {
                const kv: KV = {
                  order_caption_enabled: captionCfg.order_caption_enabled,
                  order_caption_header: captionCfg.order_caption_header,
                  order_caption_show_customer: captionCfg.order_caption_show_customer,
                  order_caption_show_table: captionCfg.order_caption_show_table,
                  order_caption_footer: captionCfg.order_caption_footer,
                  cap_backend_mode: captionCfg.cap_backend_mode,
                  cap_network_host: captionCfg.cap_network_host,
                  cap_network_port: captionCfg.cap_network_port,
                  cap_local_helper_id: captionCfg.cap_local_helper_id,
                  cap_local_helper_ip: captionCfg.cap_local_helper_ip,
                  cap_local_usb_name: captionCfg.cap_local_usb_name,
                }
                await saveClientGroup('order_caption_client', kv)
                alert('✓ Caption Order tersimpan (per perangkat)')
              } catch (e: any) { alert('Gagal menyimpan: ' + (e?.message || e)) }
            }} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Simpan Caption</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <input id="cap_enabled2" type="checkbox" checked={captionCfg.order_caption_enabled === '1'} onChange={e => setCaptionCfg(v => ({ ...v, order_caption_enabled: e.target.checked ? '1' : '0' }))} />
            <label htmlFor="cap_enabled2" className="text-sm text-slate-700">Aktifkan Caption Order Otomatis</label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul/Header</label>
            <input value={captionCfg.order_caption_header} onChange={e => setCaptionCfg(v => ({ ...v, order_caption_header: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="ORDER PESANAN" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1"><input type="checkbox" checked={captionCfg.order_caption_show_customer === '1'} onChange={e => setCaptionCfg(v => ({ ...v, order_caption_show_customer: e.target.checked ? '1' : '0' }))} /> Nama Customer</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={captionCfg.order_caption_show_table === '1'} onChange={e => setCaptionCfg(v => ({ ...v, order_caption_show_table: e.target.checked ? '1' : '0' }))} /> No Meja</label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Backend Caption Printer</label>
            <select value={captionCfg.cap_backend_mode} onChange={e => setCaptionCfg(v => ({ ...v, cap_backend_mode: e.target.value }))} className="w-full px-3 py-1.5 border rounded">
              <option value="server">Server (Network TCP)</option>
              <option value="local_helper">Local Helper (USB PC)</option>
              <option value="local_helper_apk">Local Helper (Android APK)</option>
              <option value="local_helper_offline">Local Helper USB Offline</option>
            </select>
          </div>
          {captionCfg.cap_backend_mode === 'server' && (
            <>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">IP/Host Caption Printer</label><input value={captionCfg.cap_network_host} onChange={e => setCaptionCfg(v => ({ ...v, cap_network_host: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="cth: 192.168.1.61" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Port</label><input type="number" min={1} max={65535} value={captionCfg.cap_network_port} onChange={e => setCaptionCfg(v => ({ ...v, cap_network_port: String(Math.max(1, Math.min(65535, Number(e.target.value) || 9100))) }))} className="w-full px-3 py-1.5 border rounded" /></div>
            </>
          )}
          {captionCfg.cap_backend_mode === 'local_helper' && (
            <div className="md:col-span-2 flex items-center gap-2">
              <button onClick={async () => {
                try {
                  setFindingPrinters(true)
                  const res = await fetch('/api/local-helper/printers')
                  const data = await res.json().catch(() => ({}))
                  const list = Array.isArray(data?.printers) ? data.printers : []
                  setLocalHelperPrinters(list)
                  if (list.length && !captionCfg.cap_local_helper_id) setCaptionCfg(v => ({ ...v, cap_local_helper_id: String(list[0]?.id || '') }))
                } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
              }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
              <select value={captionCfg.cap_local_helper_id} onChange={e => setCaptionCfg(v => ({ ...v, cap_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
              </select>
            </div>
          )}
          {captionCfg.cap_backend_mode === 'local_helper_apk' && (
            <div className="md:col-span-2 flex items-center gap-2">
              <input value={captionCfg.cap_local_helper_ip || printerSettings.printer_local_helper_ip || ''} onChange={e => setCaptionCfg(v => ({ ...v, cap_local_helper_ip: e.target.value }))} placeholder="IP HP (cth: 192.168.1.5)" className="w-[140px] px-2 py-1 border rounded text-xs" />
              <button onClick={async () => {
                try {
                  setFindingPrinters(true)
                  const h = captionCfg.cap_local_helper_ip || printerSettings.printer_local_helper_ip || ''
                  if (!h.trim()) { alert('Isi IP HP terlebih dahulu'); return }
                  const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                  const res = await fetch(`${baseUrl}/printers`)
                  const data = await res.json().catch(() => ({}))
                  const list = Array.isArray(data?.printers) ? data.printers : []
                  setLocalHelperPrinters(list)
                  if (list.length && !captionCfg.cap_local_helper_id) setCaptionCfg(v => ({ ...v, cap_local_helper_id: String(list[0]?.id || '') }))
                } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
              }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
              <select value={captionCfg.cap_local_helper_id} onChange={e => setCaptionCfg(v => ({ ...v, cap_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
              </select>
            </div>
          )}
          {captionCfg.cap_backend_mode === 'local_helper_offline' && (
            <div className="md:col-span-2 flex items-center gap-2">
              <button onClick={async () => {
                try {
                  setFindingUsbPrinters(true)
                  const res = await fetch('http://127.0.0.1:27128/printers/usb')
                  const data = await res.json().catch(() => ({}))
                  const list = Array.isArray(data?.printers) ? data.printers : []
                  setUsbPrinters(list)
                  if (list.length && !captionCfg.cap_local_usb_name) setCaptionCfg(v => ({ ...v, cap_local_usb_name: String(list[0]?.name || '') }))
                } catch { alert('Gagal mendeteksi USB printer') } finally { setFindingUsbPrinters(false) }
              }} disabled={findingUsbPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingUsbPrinters ? 'Mencari…' : 'Deteksi USB'}</button>
              <select value={captionCfg.cap_local_usb_name} onChange={e => setCaptionCfg(v => ({ ...v, cap_local_usb_name: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                {usbPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : usbPrinters.map((p: any) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
              </select>
            </div>
          )}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Footer (opsional)</label>
            <input value={captionCfg.order_caption_footer} onChange={e => setCaptionCfg(v => ({ ...v, order_caption_footer: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="" />
          </div>
        </div>
      </div>

      {/* ── Grup: Pantry/Kitchen (Per Perangkat) ── */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">🍽️ Pantry/Kitchen (Per Perangkat)</h3>
            <p className="text-xs text-slate-500">Pilih mode Gabung (1 printer) atau Split (2 printer terpisah untuk Pantry & Kitchen).</p>
          </div>
          <button onClick={async () => {
            try {
              const kv: KV = {
                kitchen_print_mode: kitchenCfg.kitchen_print_mode,
                combined_backend_mode: kitchenCfg.combined_backend_mode,
                combined_network_host: kitchenCfg.combined_network_host,
                combined_network_port: kitchenCfg.combined_network_port,
                combined_local_helper_id: kitchenCfg.combined_local_helper_id,
                combined_local_helper_ip: kitchenCfg.combined_local_helper_ip,
                combined_local_usb_name: kitchenCfg.combined_local_usb_name,
                pantry_backend_mode: kitchenCfg.pantry_backend_mode,
                pantry_network_host: kitchenCfg.pantry_network_host,
                pantry_network_port: kitchenCfg.pantry_network_port,
                pantry_local_helper_id: kitchenCfg.pantry_local_helper_id,
                pantry_local_helper_ip: kitchenCfg.pantry_local_helper_ip,
                pantry_local_usb_name: kitchenCfg.pantry_local_usb_name,
                kitchen_backend_mode: kitchenCfg.kitchen_backend_mode,
                kitchen_network_host: kitchenCfg.kitchen_network_host,
                kitchen_network_port: kitchenCfg.kitchen_network_port,
                kitchen_local_helper_id: kitchenCfg.kitchen_local_helper_id,
                kitchen_local_helper_ip: kitchenCfg.kitchen_local_helper_ip,
                kitchen_local_usb_name: kitchenCfg.kitchen_local_usb_name,
              }
              await saveClientGroup('kitchen_client', kv)
              alert('✓ Setting Pantry/Kitchen tersimpan (per perangkat)')
            } catch (e: any) { alert('Gagal menyimpan: ' + (e?.message || e)) }
          }} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Simpan</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode Cetak Dapur</label>
            <select value={kitchenCfg.kitchen_print_mode} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_print_mode: e.target.value }))} className="w-full px-3 py-1.5 border rounded">
              <option value="combined">Gabung (1 printer)</option>
              <option value="split">Split (2 printer)</option>
            </select>
          </div>
        </div>

        {/* Mode Combined */}
        {kitchenCfg.kitchen_print_mode === 'combined' && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">Printer Gabungan</h4>
              <button type="button" onClick={handleTestPrintKitchenCombined} className="px-2 py-1.5 rounded border border-emerald-600 text-emerald-700 text-xs hover:bg-emerald-50">Test Print</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Backend</label>
                <select value={kitchenCfg.combined_backend_mode} onChange={e => setKitchenCfg(v => ({ ...v, combined_backend_mode: e.target.value }))} className="w-full px-3 py-1.5 border rounded">
                  <option value="server">Server (Network TCP)</option>
                  <option value="local_helper">Local Helper (USB PC)</option>
                  <option value="local_helper_apk">Local Helper (Android APK)</option>
                  <option value="local_helper_offline">Local Helper USB Offline</option>
                </select>
              </div>
              {kitchenCfg.combined_backend_mode === 'server' && (
                <>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">IP/Host</label><input value={kitchenCfg.combined_network_host} onChange={e => setKitchenCfg(v => ({ ...v, combined_network_host: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="192.168.1.60" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Port</label><input type="number" min={1} max={65535} value={kitchenCfg.combined_network_port} onChange={e => setKitchenCfg(v => ({ ...v, combined_network_port: String(Math.max(1, Math.min(65535, Number(e.target.value) || 9100))) }))} className="w-full px-3 py-1.5 border rounded" /></div>
                </>
              )}
              {kitchenCfg.combined_backend_mode === 'local_helper' && (
                <div className="md:col-span-2 flex items-center gap-2">
                  <button onClick={async () => {
                    try {
                      setFindingPrinters(true)
                      const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
                      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                      const res = await fetch(`${baseUrl}/printers`)
                      const data = await res.json().catch(() => ({}))
                      const list = Array.isArray(data?.printers) ? data.printers : []
                      setLocalHelperPrinters(list)
                      if (list.length && !kitchenCfg.combined_local_helper_id) setKitchenCfg(v => ({ ...v, combined_local_helper_id: String(list[0]?.id || '') }))
                    } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
                  }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
                  <select value={kitchenCfg.combined_local_helper_id} onChange={e => setKitchenCfg(v => ({ ...v, combined_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                    {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
                  </select>
                </div>
              )}
              {kitchenCfg.combined_backend_mode === 'local_helper_apk' && (
                <div className="md:col-span-2 flex items-center gap-2">
                  <input value={kitchenCfg.combined_local_helper_ip || printerSettings.printer_local_helper_ip || ''} onChange={e => setKitchenCfg(v => ({ ...v, combined_local_helper_ip: e.target.value }))} placeholder="IP HP (cth: 192.168.1.5)" className="w-[140px] px-2 py-1 border rounded text-xs" />
                  <button onClick={async () => {
                    try {
                      setFindingPrinters(true)
                      const h = kitchenCfg.combined_local_helper_ip || printerSettings.printer_local_helper_ip || ''
                      if (!h.trim()) { alert('Isi IP HP terlebih dahulu'); return }
                      const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                      const res = await fetch(`${baseUrl}/printers`)
                      const data = await res.json().catch(() => ({}))
                      const list = Array.isArray(data?.printers) ? data.printers : []
                      setLocalHelperPrinters(list)
                      if (list.length && !kitchenCfg.combined_local_helper_id) setKitchenCfg(v => ({ ...v, combined_local_helper_id: String(list[0]?.id || '') }))
                    } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
                  }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
                  <select value={kitchenCfg.combined_local_helper_id} onChange={e => setKitchenCfg(v => ({ ...v, combined_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                    {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
                  </select>
                </div>
              )}
              {kitchenCfg.combined_backend_mode === 'local_helper_offline' && (
                <div className="md:col-span-2 flex items-center gap-2">
                  <button onClick={async () => {
                    try {
                      setFindingUsbPrinters(true)
                      const res = await fetch('http://127.0.0.1:27128/printers/usb')
                      const data = await res.json().catch(() => ({}))
                      const list = Array.isArray(data?.printers) ? data.printers : []
                      setUsbPrinters(list)
                      if (list.length && !kitchenCfg.combined_local_usb_name) setKitchenCfg(v => ({ ...v, combined_local_usb_name: String(list[0]?.name || '') }))
                    } catch { alert('Gagal mendeteksi USB printer') } finally { setFindingUsbPrinters(false) }
                  }} disabled={findingUsbPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingUsbPrinters ? 'Mencari…' : 'Deteksi USB'}</button>
                  <select value={kitchenCfg.combined_local_usb_name} onChange={e => setKitchenCfg(v => ({ ...v, combined_local_usb_name: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                    {usbPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : usbPrinters.map((p: any) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode Split */}
        {kitchenCfg.kitchen_print_mode === 'split' && (
          <>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-700">🍹 Printer Pantry (Minuman/Dessert)</h4>
                <button type="button" onClick={handleTestPrintPantry} className="px-2 py-1.5 rounded border border-emerald-600 text-emerald-700 text-xs hover:bg-emerald-50">Test Print</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Backend</label>
                  <select value={kitchenCfg.pantry_backend_mode} onChange={e => setKitchenCfg(v => ({ ...v, pantry_backend_mode: e.target.value }))} className="w-full px-3 py-1.5 border rounded">
                    <option value="server">Server (Network TCP)</option>
                    <option value="local_helper">Local Helper (USB PC)</option>
                    <option value="local_helper_apk">Local Helper (Android APK)</option>
                    <option value="local_helper_offline">Local Helper USB Offline</option>
                  </select>
                </div>
                {kitchenCfg.pantry_backend_mode === 'server' && (
                  <>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">IP/Host</label><input value={kitchenCfg.pantry_network_host} onChange={e => setKitchenCfg(v => ({ ...v, pantry_network_host: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="192.168.1.61" /></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Port</label><input type="number" min={1} max={65535} value={kitchenCfg.pantry_network_port} onChange={e => setKitchenCfg(v => ({ ...v, pantry_network_port: String(Math.max(1, Math.min(65535, Number(e.target.value) || 9100))) }))} className="w-full px-3 py-1.5 border rounded" /></div>
                  </>
                )}
                {kitchenCfg.pantry_backend_mode === 'local_helper' && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button onClick={async () => {
                      try {
                        setFindingPrinters(true)
                        const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
                        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                        const res = await fetch(`${baseUrl}/printers`)
                        const data = await res.json().catch(() => ({}))
                        const list = Array.isArray(data?.printers) ? data.printers : []
                        setLocalHelperPrinters(list)
                        if (list.length && !kitchenCfg.pantry_local_helper_id) setKitchenCfg(v => ({ ...v, pantry_local_helper_id: String(list[0]?.id || '') }))
                      } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
                    }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
                    <select value={kitchenCfg.pantry_local_helper_id} onChange={e => setKitchenCfg(v => ({ ...v, pantry_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                      {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
                    </select>
                  </div>
                )}
                {kitchenCfg.pantry_backend_mode === 'local_helper_apk' && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input value={kitchenCfg.pantry_local_helper_ip || printerSettings.printer_local_helper_ip || ''} onChange={e => setKitchenCfg(v => ({ ...v, pantry_local_helper_ip: e.target.value }))} placeholder="IP HP (cth: 192.168.1.5)" className="w-[140px] px-2 py-1 border rounded text-xs" />
                    <button onClick={async () => {
                      try {
                        setFindingPrinters(true)
                        const h = kitchenCfg.pantry_local_helper_ip || printerSettings.printer_local_helper_ip || ''
                        if (!h.trim()) { alert('Isi IP HP terlebih dahulu'); return }
                        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                        const res = await fetch(`${baseUrl}/printers`)
                        const data = await res.json().catch(() => ({}))
                        const list = Array.isArray(data?.printers) ? data.printers : []
                        setLocalHelperPrinters(list)
                        if (list.length && !kitchenCfg.pantry_local_helper_id) setKitchenCfg(v => ({ ...v, pantry_local_helper_id: String(list[0]?.id || '') }))
                      } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
                    }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
                    <select value={kitchenCfg.pantry_local_helper_id} onChange={e => setKitchenCfg(v => ({ ...v, pantry_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                      {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
                    </select>
                  </div>
                )}
                {kitchenCfg.pantry_backend_mode === 'local_helper_offline' && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button onClick={async () => {
                      try {
                        setFindingUsbPrinters(true)
                        const res = await fetch('http://127.0.0.1:27128/printers/usb')
                        const data = await res.json().catch(() => ({}))
                        const list = Array.isArray(data?.printers) ? data.printers : []
                        setUsbPrinters(list)
                        if (list.length && !kitchenCfg.pantry_local_usb_name) setKitchenCfg(v => ({ ...v, pantry_local_usb_name: String(list[0]?.name || '') }))
                      } catch { alert('Gagal mendeteksi USB printer') } finally { setFindingUsbPrinters(false) }
                    }} disabled={findingUsbPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingUsbPrinters ? 'Mencari…' : 'Deteksi USB'}</button>
                    <select value={kitchenCfg.pantry_local_usb_name} onChange={e => setKitchenCfg(v => ({ ...v, pantry_local_usb_name: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                      {usbPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : usbPrinters.map((p: any) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-700">🍳 Printer Kitchen (Makanan)</h4>
                <button type="button" onClick={handleTestPrintKitchen} className="px-2 py-1.5 rounded border border-emerald-600 text-emerald-700 text-xs hover:bg-emerald-50">Test Print</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Backend</label>
                  <select value={kitchenCfg.kitchen_backend_mode} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_backend_mode: e.target.value }))} className="w-full px-3 py-1.5 border rounded">
                    <option value="server">Server (Network TCP)</option>
                    <option value="local_helper">Local Helper (USB PC)</option>
                    <option value="local_helper_apk">Local Helper (Android APK)</option>
                    <option value="local_helper_offline">Local Helper USB Offline</option>
                  </select>
                </div>
                {kitchenCfg.kitchen_backend_mode === 'server' && (
                  <>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">IP/Host</label><input value={kitchenCfg.kitchen_network_host} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_network_host: e.target.value }))} className="w-full px-3 py-1.5 border rounded" placeholder="192.168.1.62" /></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Port</label><input type="number" min={1} max={65535} value={kitchenCfg.kitchen_network_port} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_network_port: String(Math.max(1, Math.min(65535, Number(e.target.value) || 9100))) }))} className="w-full px-3 py-1.5 border rounded" /></div>
                  </>
                )}
                {kitchenCfg.kitchen_backend_mode === 'local_helper' && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button onClick={async () => {
                      try {
                        setFindingPrinters(true)
                        const h = printerSettings.printer_local_helper_ip || '127.0.0.1'
                        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                        const res = await fetch(`${baseUrl}/printers`)
                        const data = await res.json().catch(() => ({}))
                        const list = Array.isArray(data?.printers) ? data.printers : []
                        setLocalHelperPrinters(list)
                        if (list.length && !kitchenCfg.kitchen_local_helper_id) setKitchenCfg(v => ({ ...v, kitchen_local_helper_id: String(list[0]?.id || '') }))
                      } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
                    }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
                    <select value={kitchenCfg.kitchen_local_helper_id} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                      {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
                    </select>
                  </div>
                )}
                {kitchenCfg.kitchen_backend_mode === 'local_helper_apk' && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input value={kitchenCfg.kitchen_local_helper_ip || printerSettings.printer_local_helper_ip || ''} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_local_helper_ip: e.target.value }))} placeholder="IP HP (cth: 192.168.1.5)" className="w-[140px] px-2 py-1 border rounded text-xs" />
                    <button onClick={async () => {
                      try {
                        setFindingPrinters(true)
                        const h = kitchenCfg.kitchen_local_helper_ip || printerSettings.printer_local_helper_ip || ''
                        if (!h.trim()) { alert('Isi IP HP terlebih dahulu'); return }
                        const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
                        const res = await fetch(`${baseUrl}/printers`)
                        const data = await res.json().catch(() => ({}))
                        const list = Array.isArray(data?.printers) ? data.printers : []
                        setLocalHelperPrinters(list)
                        if (list.length && !kitchenCfg.kitchen_local_helper_id) setKitchenCfg(v => ({ ...v, kitchen_local_helper_id: String(list[0]?.id || '') }))
                      } catch { alert('Gagal mendeteksi printer') } finally { setFindingPrinters(false) }
                    }} disabled={findingPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingPrinters ? 'Mencari…' : 'Deteksi'}</button>
                    <select value={kitchenCfg.kitchen_local_helper_id} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_local_helper_id: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                      {localHelperPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : localHelperPrinters.map((p: any) => <option key={String(p.id || p.name)} value={String(p.id || p.name)}>{p.name || p.id}</option>)}
                    </select>
                  </div>
                )}
                {kitchenCfg.kitchen_backend_mode === 'local_helper_offline' && (
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button onClick={async () => {
                      try {
                        setFindingUsbPrinters(true)
                        const res = await fetch('http://127.0.0.1:27128/printers/usb')
                        const data = await res.json().catch(() => ({}))
                        const list = Array.isArray(data?.printers) ? data.printers : []
                        setUsbPrinters(list)
                        if (list.length && !kitchenCfg.kitchen_local_usb_name) setKitchenCfg(v => ({ ...v, kitchen_local_usb_name: String(list[0]?.name || '') }))
                      } catch { alert('Gagal mendeteksi USB printer') } finally { setFindingUsbPrinters(false) }
                    }} disabled={findingUsbPrinters} className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300">{findingUsbPrinters ? 'Mencari…' : 'Deteksi USB'}</button>
                    <select value={kitchenCfg.kitchen_local_usb_name} onChange={e => setKitchenCfg(v => ({ ...v, kitchen_local_usb_name: e.target.value }))} className="px-2 py-1 text-xs border rounded flex-1">
                      {usbPrinters.length === 0 ? <option value="">(Klik Deteksi)</option> : usbPrinters.map((p: any) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
