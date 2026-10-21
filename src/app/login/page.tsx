import LoginClient from './LoginClient'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const db = getDb()
  const pool = (db as any).$client
  let rows: any[] = []
  try {
    const { rows: resultRows } = await pool.query(
      `SELECT setting_key, setting_value
       FROM settings
       WHERE setting_key LIKE 'design_login_%'
       ORDER BY setting_key`
    )
    rows = resultRows
  } catch {
    rows = []
  }

  const initialDesign: Record<string, string> = {}
  for (const r of rows || []) {
    if (r?.setting_key) initialDesign[String(r.setting_key)] = String(r.setting_value ?? '')
  }

  return <LoginClient initialDesign={initialDesign} />
}
