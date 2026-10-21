import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

function genToken(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return 'qr_' + (crypto as any).randomUUID().replace(/-/g, '')
    }
  } catch {}
  return 'qr_' + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

async function resolvePrice(barangId: number, unitId: number | null): Promise<number> {
  const priceRows = (await rawAll(
    `SELECT unit_id, price FROM barang_prices WHERE barang_id = ? AND effective_date <= CURRENT_DATE ORDER BY effective_date DESC, id DESC`,
    [barangId],
  )) as any[]
  if (priceRows.length === 0) return 0
  const match = priceRows.find((p) => Number(p.unit_id) === Number(unitId))
  if (match) return Number(match.price) || 0
  return Number(priceRows[0].price) || 0
}

async function notifyTempChanged() {
  try {
    const pool = (getDb() as any).$client
    await pool.query("SELECT pg_notify('resto_temp_changed', '')")
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const tableCode = String(body.tableCode || body.table_code || '').trim()
    const customerName = String(body.customerName || body.customer_name || '').trim()
    const itemsIn = Array.isArray((body as any).items) ? (body as any).items : []

    if (!tableCode) {
      return NextResponse.json({ error: 'Kode meja wajib diisi' }, { status: 400 })
    }
    if (!customerName) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    }

    const table = (await rawGet(
      `SELECT id, code, name FROM master_meja WHERE UPPER(code) = UPPER(?) AND COALESCE(isdelete,0) = 0 AND COALESCE(is_active,1) = 1`,
      [tableCode],
    )) as any
    if (!table) {
      return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 })
    }
    const tableId = Number(table.id)

    // Validasi item & hitung harga dari server (anti tamper)
    const items: any[] = []
    for (const it of itemsIn) {
      const barangId = Number(it.barangId || it.barang_id || 0) || 0
      const qty = Number(it.quantity || it.qty || 0) || 0
      const unitId = it.unitId ?? it.unit_id ?? null
      if (!barangId || qty <= 0) continue
      const barang = (await rawGet(
        `SELECT code, name, kategori_id FROM master_barang WHERE id = ? AND COALESCE(isdelete,0) = 0 AND COALESCE(aktif,1) = 1`,
        [barangId],
      )) as any
      if (!barang) continue
      const unitPrice = await resolvePrice(barangId, unitId != null ? Number(unitId) : null)
      const totalPrice = unitPrice * qty
      items.push({
        barangId,
        code: barang.code,
        name: barang.name,
        qty,
        unitId,
        unitPrice,
        totalPrice,
        kategoriId: barang.kategori_id != null ? Number(barang.kategori_id) : null,
      })
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Pesanan kosong atau item tidak valid' }, { status: 400 })
    }

    // Cek order aktif di meja ini
    const existing = (await rawGet(
      `SELECT * FROM resto_temp_orders WHERE table_id = ? AND (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0) ORDER BY id DESC LIMIT 1`,
      [tableId],
    )) as any

    let tempOrderId: number
    let qrToken: string

    if (existing) {
      if (String(existing.source || 'walkin') === 'walkin') {
        return NextResponse.json(
          { error: 'Meja sedang digunakan oleh kasir, silakan hubungi petugas' },
          { status: 409 },
        )
      }
      // Reuse order QR yang sudah ada
      tempOrderId = Number(existing.id)
      qrToken = genToken()
      await rawRun(
        `UPDATE resto_temp_orders SET customer_name = ?, qr_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [customerName, qrToken, tempOrderId],
      )
      await rawRun('DELETE FROM resto_temp_order_items WHERE temp_order_id = ?', [tempOrderId])
    } else {
      qrToken = genToken()
      const r = await (getDb() as any).$client.query(
        `INSERT INTO resto_temp_orders (table_id, customer_name, guest_count, status, void, source, qr_token)
         VALUES ($1, $2, 1, 'open', 0, 'qr', $3) RETURNING id`,
        [tableId, customerName, qrToken],
      )
      tempOrderId = Number(r.rows[0].id)
    }

    for (const it of items) {
      await rawRun(
        `INSERT INTO resto_temp_order_items (temp_order_id, barang_id, barang_code, barang_name, quantity, unit_price, total_price, kategori_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tempOrderId, it.barangId, it.code, it.name, it.qty, it.unitPrice, it.totalPrice, it.kategoriId],
      )
    }

    await notifyTempChanged()

    return NextResponse.json({
      tempOrderId,
      qrToken,
      table: { id: tableId, code: table.code, name: table.name },
    })
  } catch (e: any) {
    console.error('Error customer-order:', e)
    return NextResponse.json({ error: e?.message || 'Gagal memproses pesanan' }, { status: 500 })
  }
}
