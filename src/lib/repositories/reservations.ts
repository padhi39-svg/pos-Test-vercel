import { rawAll } from '@/db/raw'

export async function getReservationRecap(from?: string, to?: string, status?: string) {
  let sql = `
    SELECT
      r.id,
      r.number,
      r.customer_name,
      r.phone,
      r.date,
      r.start_time,
      r.end_time,
      r.pax,
      r.status,
      COALESCE(r.dp_amount, 0) as dp_amount,
      r.dp_paid,
      r.notes,
      r.transfer_name,
      r.created_at,
      (
        SELECT STRING_AGG(m.name, ', ')
        FROM reservation_tables rt
        JOIN master_meja m ON m.id = rt.table_id
        WHERE rt.reservation_id = r.id
      ) AS table_names,
      (
        SELECT STRING_AGG(m.code, ', ')
        FROM reservation_tables rt
        JOIN master_meja m ON m.id = rt.table_id
        WHERE rt.reservation_id = r.id
      ) AS table_codes,
      (
        SELECT STRING_AGG(f.name, ', ')
        FROM reservation_tables rt
        JOIN master_meja m ON m.id = rt.table_id
        LEFT JOIN floors f ON f.id = m.floor_id
        WHERE rt.reservation_id = r.id
      ) AS floor_names
    FROM reservations r
    WHERE 1=1
  `
  const params: any[] = []
  if (from) { sql += ` AND r.date >= $${params.length + 1}`; params.push(from) }
  if (to) { sql += ` AND r.date <= $${params.length + 1}`; params.push(to) }
  if (status) { sql += ` AND r.status = $${params.length + 1}`; params.push(status) }
  sql += ` ORDER BY r.date DESC, r.start_time ASC, r.id DESC`
  return rawAll<any>(sql, params.length > 0 ? params : undefined)
}
