import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { INTERNAL_SERVICE_TOKEN } from '@/lib/internalAuth'
import { triggerKitchenPrintForTemp } from '@/lib/kitchenPrint'

export const dynamic = 'force-dynamic'

async function notifyTempChanged() {
  try {
    const pool = (getDb() as any).$client
    await pool.query("SELECT pg_notify('resto_temp_changed', '')")
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const tempOrderId = Number(body.tempOrderId || 0) || 0
    const qrToken = String(body.qrToken || '').trim()
    const paymentsIn = Array.isArray((body as any).payments) ? (body as any).payments : []

    if (!tempOrderId || !qrToken) {
      return NextResponse.json({ error: 'Data pesanan tidak valid' }, { status: 400 })
    }
    if (paymentsIn.length === 0) {
      return NextResponse.json({ error: 'Metode pembayaran wajib dipilih' }, { status: 400 })
    }

    const temp = (await rawGet(`SELECT * FROM resto_temp_orders WHERE id = ?`, [tempOrderId])) as any
    if (!temp) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }
    if (String(temp.source || 'walkin') !== 'qr') {
      return NextResponse.json({ error: 'Pesanan bukan dari QR' }, { status: 403 })
    }
    if (String(temp.qr_token || '') !== qrToken) {
      return NextResponse.json({ error: 'Token pesanan tidak valid' }, { status: 403 })
    }
    if (Number(temp.void) === 1) {
      return NextResponse.json({ error: 'Pesanan sudah dibatalkan' }, { status: 409 })
    }
    if (String(temp.status || '') === 'paid') {
      return NextResponse.json({ error: 'Pesanan sudah dibayar' }, { status: 409 })
    }
    if (String(temp.status || '') !== 'open' && String(temp.status || '') !== 'bill') {
      return NextResponse.json({ error: 'Pesanan tidak aktif' }, { status: 409 })
    }

    const items = (await rawAll(
      `SELECT * FROM resto_temp_order_items WHERE temp_order_id = ? ORDER BY id ASC`,
      [tempOrderId],
    )) as any[]
    if (items.length === 0) {
      return NextResponse.json({ error: 'Pesanan kosong' }, { status: 400 })
    }

    const total = items.reduce((s, it) => s + Number(it.total_price || 0), 0)

    const payments = paymentsIn
      .map((p: any) => ({
        method: String(p.method || '').trim(),
        amount: Number(p.amount || 0) || 0,
        bankId: p.bankId != null ? Number(p.bankId) : null,
        cardNumber: p.cardNumber != null ? String(p.cardNumber) : null,
      }))
      .filter((p: any) => p.method && p.amount > 0)

    if (payments.length === 0) {
      return NextResponse.json({ error: 'Metode pembayaran tidak valid' }, { status: 400 })
    }
    const totalPaid = payments.reduce((s: number, p: any) => s + p.amount, 0)
    if (totalPaid < total) {
      return NextResponse.json(
        { error: `Pembayaran kurang: dibayar ${totalPaid}, total ${total}` },
        { status: 400 },
      )
    }

    const transactionItems = items.map((it) => ({
      barangId: Number(it.barang_id),
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      unitPriceIncludeTax: Number(it.unit_price),
      totalPrice: Number(it.total_price),
      modifier: it.modifier ?? null,
      kategoriId: it.kategori_id != null ? Number(it.kategori_id) : null,
    }))

    const transactionData: any = {
      customerId: 1,
      items: transactionItems,
      subtotal: total,
      total,
      transactionType: 1,
      transactionDate: new Date().toISOString().slice(0, 10),
      includeTax: false,
      ppnPercent: 0,
      ppnAmount: 0,
      discountPercent: 0,
      discountAmount: 0,
      serviceChargePercent: 0,
      serviceChargeAmount: 0,
      price_include_tax: 0,
      payments,
      paymentMethod: payments.length === 1 ? payments[0].method : 'multi',
      paymentAmount: totalPaid,
      changeAmount: Math.max(0, totalPaid - total),
      bankId: payments.find((p: any) => p.method !== 'cash')?.bankId || null,
      cardNumber: payments.find(
        (p: any) => p.method === 'Debit Card' || p.method === 'Credit Card',
      )?.cardNumber || null,
      tableId: Number(temp.table_id),
      restoTempId: tempOrderId,
      Nm_cust: temp.customer_name || null,
    }

    const txUrl = new URL('/api/transactions', req.url).toString()
    const txRes = await fetch(txUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify(transactionData),
    })

    if (!txRes.ok) {
      let msg = 'Gagal memproses pembayaran'
      try {
        const raw = await txRes.text()
        try {
          const err = JSON.parse(raw)
          msg = String(err?.error || err?.details || msg)
        } catch {
          msg = raw.slice(0, 200) || msg
        }
      } catch {}
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const txResult = await txRes.json().catch(() => ({}))
    const transactionNumber = String(txResult?.transactionNumber || '')

    // Cetak ke dapur (caption + kitchen) — sama format dengan resto table.
    // Dipanggil setelah lunas; gagal print tidak boleh gagalkan respon.
    try {
      const origin = new URL(req.url).origin
      await triggerKitchenPrintForTemp(tempOrderId, origin)
    } catch (e) {
      console.warn('customer-pay kitchen print gagal:', e)
    }

    // Tandai temp order sebagai lunas agar meja kembali kosong
    await rawRun(
      `UPDATE resto_temp_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [tempOrderId],
    )
    await notifyTempChanged()

    return NextResponse.json({ success: true, transactionNumber, tempOrderId })
  } catch (e: any) {
    console.error('Error customer-pay:', e)
    return NextResponse.json({ error: e?.message || 'Gagal memproses pembayaran' }, { status: 500 })
  }
}
