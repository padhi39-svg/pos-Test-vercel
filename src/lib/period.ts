import { rawGet } from '@/db/raw'

export type Period = {
  id: number
  name: string
  start_date?: string
  end_date?: string
  is_closed?: number
}

export async function getPeriodByDate(dateISO: string): Promise<Period | null> {
  const d = (dateISO || new Date().toISOString()).slice(0, 10)
  try {
    const row = await rawGet<any>(`
      SELECT id, name, status_buku, COALESCE(is_closed, 0) as is_closed
      FROM master_periode
        WHERE isdelete = 0 AND (?)::date BETWEEN start_date::date AND end_date::date
      LIMIT 1
    `, [d])
    if (!row) return null
    const closed = row?.status_buku ? (String(row.status_buku).toUpperCase() === 'CLOSED' ? 1 : 0) : Number(row.is_closed)
    return { id: row.id, name: row.name, is_closed: closed }
  } catch {
    try {
      const row = await rawGet<any>(`
        SELECT id, name
        FROM master_periode
      WHERE isdelete = 0 AND (?)::date BETWEEN start_date::date AND end_date::date
        LIMIT 1
      `, [d])
      if (!row) return null
      return { id: row.id, name: row.name, is_closed: 0 }
    } catch {
      return null
    }
  }
}
