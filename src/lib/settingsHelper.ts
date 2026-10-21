import { Pool } from 'pg'

export async function getAllowBackdate(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(`SELECT setting_value FROM settings WHERE setting_key = $1`, ['general_allow_backdate'])
    const row = result.rows[0] as any
    return row ? String(row.setting_value) === '1' : false
  } catch {
    return false
  }
}
