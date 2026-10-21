import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

async function checkAccountsUsedInJournal(): Promise<boolean> {
  const queries = [
    'SELECT 1 FROM journal_entries LIMIT 1',
    'SELECT 1 FROM memorial_journal_details LIMIT 1',
    'SELECT 1 FROM account_mappings LIMIT 1',
    'SELECT 1 FROM ap_payment_methods LIMIT 1',
    'SELECT 1 FROM ap_payment_extras LIMIT 1',
    'SELECT 1 FROM manufaktur_biaya LIMIT 1',
    'SELECT 1 FROM master_banks WHERE account_id IS NOT NULL LIMIT 1',
    'SELECT 1 FROM master_supplier WHERE account_id IS NOT NULL LIMIT 1',
    'SELECT 1 FROM master_customer WHERE account_id IS NOT NULL LIMIT 1',
    'SELECT 1 FROM master_barang WHERE account_id IS NOT NULL LIMIT 1',
  ]
  for (const sql of queries) {
    try {
      const row = await rawGet(sql)
      if (row) return true
    } catch {
      // table may not exist, skip
    }
  }
  return false
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const used = await checkAccountsUsedInJournal()
    return NextResponse.json({ canDelete: !used })
  } catch (e: any) {
    console.error('GET /api/keuangan/perkiraan/delete-all error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal memeriksa' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus perkiraan' }, { status: 403 })
    }

    if (await checkAccountsUsedInJournal()) {
      return NextResponse.json({
        error: 'Tidak bisa menghapus semua akun karena sudah ada transaksi jurnal yang menggunakan akun-akun tersebut'
      }, { status: 400 })
    }

    await rawRun('DELETE FROM accounts')

    return NextResponse.json({ success: true, message: 'Semua akun berhasil dihapus' })
  } catch (e: any) {
    console.error('DELETE /api/keuangan/perkiraan/delete-all error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal menghapus semua akun' }, { status: 500 })
  }
}
