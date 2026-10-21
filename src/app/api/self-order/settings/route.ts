import { NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tz = process.env.TIMEZONE || '+7'

  // Fetch self order settings from database
  let cacheTtlHours = 3
  let selfPay = false

  try {
    const rows = await rawAll(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('self_order_cache_ttl_hours', 'self_order_self_pay')`
    )
    for (const row of rows) {
      if (row.setting_key === 'self_order_cache_ttl_hours') {
        cacheTtlHours = Math.max(1, Math.min(5, Number(row.setting_value) || 3))
      }
      if (row.setting_key === 'self_order_self_pay') {
        selfPay = row.setting_value === '1'
      }
    }
  } catch {}

  return NextResponse.json({
    timezone: tz,
    cacheTtlHours,
    selfPay,
  })
}
