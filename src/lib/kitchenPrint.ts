import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export type PrintItem = {
  name: string
  quantity: number
  modifier?: string | null
  kategoriId?: number | null
}

function wrap(text: string, width: number): string[] {
  const words = String(text || '').split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const cand = line ? line + ' ' + w : w
    if (cand.length <= width) line = cand
    else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

// Format teks caption persis sama dengan buildOrderCaption di PosRestoPageInner
export function buildOrderCaptionText(opts: {
  items: PrintItem[]
  customerName?: string | null
  tableDisplay?: string | null
  chars?: number
  headerText?: string
  cashierEmail?: string | null
  waiterName?: string | null
  includeHeader?: boolean
}): string {
  const W = opts.chars || 48
  const L: string[] = []
  const includeHeader = opts.includeHeader !== false
  const centerLine = (line: string) => {
    const pad = Math.max(0, Math.floor((W - line.length) / 2))
    return ' '.repeat(pad) + line
  }
  if (includeHeader) {
    const header = String(opts.headerText || 'ORDER PESANAN')
    L.push(centerLine(header.toUpperCase()))
  }
  if (opts.tableDisplay) L.push(`Table : ${opts.tableDisplay}`)
  if (opts.cashierEmail) L.push(String(opts.cashierEmail))
  if (opts.waiterName) L.push(`Nama Waiters : ${opts.waiterName}`)
  if (opts.customerName) L.push(`Customer : ${opts.customerName}`)
  L.push(''.padEnd(W, '='))
  const qtyCol = 3
  for (const it of opts.items) {
    const qtyStr = String(it.quantity).padStart(qtyCol, ' ')
    const nameLines = wrap(it.name, W - (qtyCol + 1))
    if (nameLines.length) L.push(`${qtyStr} ${nameLines[0]}`)
    for (let i = 1; i < nameLines.length; i++) {
      L.push(' '.repeat(qtyCol) + ' ' + nameLines[i])
    }
    if (it.modifier) {
      const modLines = wrap(String(it.modifier), W - (qtyCol + 3))
      for (const ml of modLines) L.push(' '.repeat(qtyCol) + ' * ' + ml)
    }
  }
  const now = new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const dt = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`
  L.push('')
  L.push(''.padEnd(W, '='))
  L.push(centerLine(dt))
  for (let i = 0; i < 5; i++) L.push('')
  L.push('\n')
  return L.join('\n')
}

async function sendToPrinterBackend(
  backend: 'server' | 'local_helper' | 'local_helper_apk' | 'local_helper_offline',
  opts: { host?: string; port?: number; localHelperId?: string; localUsbName?: string; localHelperIp?: string },
  text: string,
  cut: boolean,
  origin: string,
) {
  if (!text.trim()) return
  if (backend === 'server') {
    const host = (opts.host || '').trim()
    const port = opts.port || 9100
    if (!host) return
    try {
      await fetch(`${origin}/api/print/escpos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, host, port, cut }),
      })
    } catch {}
  } else if (backend === 'local_helper' || backend === 'local_helper_apk') {
    const id = opts.localHelperId || ''
    const h = opts.localHelperIp || '127.0.0.1'
    const baseUrl = h.trim().match(/^https?:\/\//) ? h.trim().replace(/\/+$/, '') : `http://${h.trim()}:27128`
    try {
      await fetch(`${baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, id }),
      })
    } catch {}
  } else if (backend === 'local_helper_offline') {
    const printerName = opts.localUsbName || ''
    if (!printerName) return
    try {
      await fetch('http://127.0.0.1:27128/print/usb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cut, printerName }),
      })
    } catch {}
  }
}

async function loadSettingsGroup(group: string): Promise<Record<string, string>> {
  try {
    const rows = (await rawAll(
      `SELECT setting_key, setting_value FROM settings WHERE setting_group = ?`,
      [group],
    )) as any[]
    const map: Record<string, string> = {}
    for (const r of rows) map[String(r.setting_key)] = String(r.setting_value ?? '')
    return map
  } catch {
    return {}
  }
}

// Trigger print dapur untuk order QR (dipanggil dari server: customer-pay)
export async function triggerKitchenPrintForTemp(tempOrderId: number, origin: string) {
  try {
    const temp = (await rawAll(
      `SELECT * FROM resto_temp_orders WHERE id = ?`,
      [tempOrderId],
    )) as any[]
    if (!temp.length) return
    const t = temp[0]
    if (String(t.source || 'walkin') !== 'qr') return

    const itemRows = (await rawAll(
      `SELECT barang_name, quantity, modifier, kategori_id FROM resto_temp_order_items WHERE temp_order_id = ? ORDER BY id ASC`,
      [tempOrderId],
    )) as any[]
    if (!itemRows.length) return

    const captionCfg = await loadSettingsGroup('order_caption_client')
    const kitchenCfg = await loadSettingsGroup('kitchen_client')
    const printerCfg = await loadSettingsGroup('printer')

    const chars = Math.max(24, Math.min(64, Number(printerCfg['chars_per_line'] || '48') || 48))
    const tableDisplay = `${t.table_id ? 'Meja ' + t.table_id : ''}`.trim()
    const items: PrintItem[] = itemRows.map((it) => ({
      name: String(it.barang_name || ''),
      quantity: Number(it.quantity) || 0,
      modifier: it.modifier ?? null,
      kategoriId: it.kategori_id != null ? Number(it.kategori_id) : null,
    }))

    // 1) Order caption (jika diaktifkan)
    if (captionCfg.order_caption_enabled === '1') {
      const captionText = buildOrderCaptionText({
        items,
        customerName: t.customer_name || null,
        tableDisplay,
        chars,
        headerText: captionCfg.order_caption_header || 'ORDER PESANAN',
      })
      const capMode = (captionCfg.cap_backend_mode as any) || 'server'
      await sendToPrinterBackend(
        capMode,
        {
          host: captionCfg.cap_network_host,
          port: Number(captionCfg.cap_network_port || '9100') || 9100,
          localHelperId: captionCfg.cap_local_helper_id,
          localUsbName: captionCfg.cap_local_usb_name,
          localHelperIp: captionCfg.cap_local_helper_ip,
        },
        captionText,
        true,
        origin,
      )
    }

    // 2) Kitchen print (combined default)
    const mode = kitchenCfg.kitchen_print_mode || 'combined'
    const kitchenText = buildOrderCaptionText({
      items,
      customerName: t.customer_name || null,
      tableDisplay,
      chars,
      headerText: 'KITCHEN ORDER',
    })
    if (mode === 'combined') {
      const bMode = (kitchenCfg.combined_backend_mode as any) || 'server'
      await sendToPrinterBackend(
        bMode,
        {
          host: kitchenCfg.combined_network_host,
          port: Number(kitchenCfg.combined_network_port || '9100') || 9100,
          localHelperId: kitchenCfg.combined_local_helper_id,
          localUsbName: kitchenCfg.combined_local_usb_name,
          localHelperIp: kitchenCfg.combined_local_helper_ip,
        },
        kitchenText,
        true,
        origin,
      )
    }
    // Catatan: mode 'split' (pantry/kitchen per kategori) dapat ditambahkan menyusul.
  } catch (e) {
    console.warn('triggerKitchenPrintForTemp gagal:', e)
  }
}
