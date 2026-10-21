import { showError } from '@/lib/notification'

export async function ensurePeriodForDateOrToast(dateISO: string): Promise<boolean> {
  try {
    const date = String(dateISO || '').slice(0, 10)
    if (!date) return true

    const res = await fetch(`/api/periode/check?date=${encodeURIComponent(date)}`)
    const data = await res.json().catch(() => ({})) as any

    if (!res.ok) {
      showError(String(data?.error || 'Gagal cek periode'))
      return false
    }

    if (!data?.exists) {
      showError('Periode untuk tanggal tersebut belum ada')
      return false
    }

    return true
  } catch {
    showError('Gagal cek periode')
    return false
  }
}
