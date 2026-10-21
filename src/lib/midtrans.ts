import { rawGet } from '@/db/raw'
import { decrypt } from '@/lib/crypto'

const MIDTRANS_API_BASE = 'https://api.midtrans.com'

/**
 * Get the decrypted Midtrans server key.
 * Only usable server-side. Never expose to client.
 */
export async function getMidtransServerKey(): Promise<string | null> {
  try {
    const row = await rawGet(
      `SELECT setting_value FROM settings WHERE setting_key = 'self_order_midtrans_server_key'`
    ) as any
    if (!row?.setting_value) return null
    return decrypt(row.setting_value)
  } catch {
    return null
  }
}

/**
 * Check if Midtrans is configured (has server key).
 */
export async function isMidtransConfigured(): Promise<boolean> {
  const key = await getMidtransServerKey()
  return !!key
}

/**
 * Create a QRIS charge via Midtrans.
 * Returns the QR code URL on success.
 */
export async function createQrisCharge({
  orderId,
  grossAmount,
  items,
}: {
  orderId: string
  grossAmount: number
  items: { id: string; name: string; price: number; quantity: number }[]
}): Promise<{ success: boolean; qrCodeUrl?: string; transactionId?: string; error?: string }> {
  const serverKey = await getMidtransServerKey()
  if (!serverKey) {
    return { success: false, error: 'Midtrans server key belum dikonfigurasi' }
  }

  const auth = Buffer.from(serverKey + ':').toString('base64')

  const body = {
    payment_type: 'qris',
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    item_details: items,
    qris: {
      acquirer: 'gopay',
    },
  }

  try {
    const res = await fetch(`${MIDTRANS_API_BASE}/v2/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data?.status_message || `HTTP ${res.status}` }
    }

    // Find generate-qr-code action
    const qrAction = data.actions?.find((a: any) => a.name === 'generate-qr-code')
    const qrCodeUrl = qrAction?.url

    if (!qrCodeUrl) {
      return { success: false, error: 'QR code URL tidak ditemukan dalam response' }
    }

    return {
      success: true,
      qrCodeUrl,
      transactionId: data.transaction_id,
    }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Gagal terhubung ke Midtrans' }
  }
}

/**
 * Check QRIS transaction status via Midtrans.
 */
export async function checkQrisStatus(
  orderId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const serverKey = await getMidtransServerKey()
  if (!serverKey) {
    return { success: false, error: 'Midtrans server key belum dikonfigurasi' }
  }

  const auth = Buffer.from(serverKey + ':').toString('base64')

  try {
    const res = await fetch(`${MIDTRANS_API_BASE}/v2/${orderId}/status`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data?.status_message || `HTTP ${res.status}` }
    }

    return { success: true, status: data.transaction_status }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Gagal cek status' }
  }
}
