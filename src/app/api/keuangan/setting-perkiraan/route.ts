import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'
import { getUserId } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const GROUPS = {
  pelanggan: [
    'piutang_dagang',
    'penjualan_barang',
    'potongan_penjualan',
    'hpp',
    'retur_penjualan',
    'uang_muka_penjualan',
    'ppn_keluaran',
    'ppn_keluaran_difakturkan',
    'service_charge',
    'default_cash_account',
  ],
  supplier: [
    'hutang_dagang',
    'potongan_pembelian',
    'retur_pembelian',
    'uang_muka_pembelian',
    'ppn_masukan',
    'ppn_masukan_difakturkan',
  ],
  barang: [
    'persediaan_barang',
  ],
  laba: [
    'laba_ditahan',
    'laba_berjalan',
    'laba_bulan_ini',
  ],
} as const

type GroupKey = keyof typeof GROUPS

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_setting_perkiraan', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat setting perkiraan' }, { status: 403 })
    }
    const maps = await rawAll(`SELECT map_group, map_key, account_id FROM account_mappings`) as any[]
    const byGroup: Record<string, Record<string, number>> = {}
    for (const m of maps) {
      byGroup[m.map_group] = byGroup[m.map_group] || {}
      byGroup[m.map_group][m.map_key] = Number(m.account_id)
    }
    for (const g of Object.keys(GROUPS) as GroupKey[]) {
      byGroup[g] = byGroup[g] || {}
      for (const k of GROUPS[g]) if (!(k in byGroup[g])) (byGroup[g] as any)[k] = null
    }

    const accounts = await rawAll(`SELECT id, code, name, is_header, golongan FROM accounts WHERE is_active = 1 ORDER BY code ASC`) as any[]
    return NextResponse.json({ mappings: byGroup, accounts })
  } catch (e:any) {
    console.error('GET /api/keuangan/setting-perkiraan error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to load mappings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_setting_perkiraan', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah setting perkiraan' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const mappings = body?.mappings || {}
    const db = getDb(); const pool = (db as any).$client

    const accExists = async (id: number) => rawGet(`SELECT 1 FROM accounts WHERE id = ? LIMIT 1`, [id])

    await pool.query('BEGIN')
    try {
      const userId = getUserId(req)
      for (const g of Object.keys(GROUPS) as GroupKey[]) {
        const obj = mappings[g] || {}
        for (const k of GROUPS[g]) {
          const val = obj[k]
          if (val === null || val === undefined || val === '') continue
          const accId = Number(val)
          const acc = await accExists(accId)
          if (!acc) throw new Error(`Akun tidak ditemukan untuk ${g}/${k}`)
          const row = await rawGet(`SELECT 1 FROM account_mappings WHERE map_group = ? AND map_key = ? LIMIT 1`, [g, k])
          if (row) {
            await rawRun(`UPDATE account_mappings SET account_id = ?, user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE map_group = ? AND map_key = ?`, [accId, userId || null, g, k])
          } else {
            await rawRun(`INSERT INTO account_mappings (map_group, map_key, account_id, user_create, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [g, k, accId, userId || null])
          }
        }
      }
      await pool.query('COMMIT')
    } catch(e) {
      await pool.query('ROLLBACK')
      throw e
    }

    return NextResponse.json({ success: true })
  } catch (e:any) {
    console.error('POST /api/keuangan/setting-perkiraan error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to save mappings' }, { status: 500 })
  }
}
