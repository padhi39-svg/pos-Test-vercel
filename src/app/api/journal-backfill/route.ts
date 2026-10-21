import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { loadAllEntries } from '@/lib/accountingEntries'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

async function lookupSourceId(sourceType: string, sourceNumber: string): Promise<number> {
  try {
    if (sourceType === 'Terima Piutang') {
      // Cek AR payment dulu
      const ar = await rawGet<any>('SELECT id FROM ar_payments WHERE payment_number = ?', [sourceNumber])
      if (ar) return ar.id
      // Mungkin auto-generated dari POS (source_number = transaction_number)
      const tx = await rawGet<any>('SELECT id FROM transactions WHERE transaction_number = ?', [sourceNumber])
      if (tx) return tx.id
    } else if (sourceType === 'Bayar Hutang') {
      const r = await rawGet<any>('SELECT id FROM ap_payments WHERE payment_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Penjualan') {
      const r = await rawGet<any>('SELECT id FROM transactions WHERE transaction_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Retur Penjualan') {
      const r = await rawGet<any>('SELECT id FROM transactions WHERE transaction_number = ? AND is_return = 1', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Pembelian') {
      const r = await rawGet<any>('SELECT id FROM purchases WHERE purchase_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Retur Pembelian') {
      const r = await rawGet<any>('SELECT id FROM purchases WHERE purchase_number = ? AND is_return = 1', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Mutasi Kas') {
      const r = await rawGet<any>('SELECT id FROM cash_mutations WHERE mutation_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Uang Muka Customer' || sourceType === 'Terima Uang Muka Customer') {
      const r = await rawGet<any>('SELECT id FROM ar_advances WHERE kode_nota = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Uang Muka Supplier' || sourceType === 'Bayar Uang Muka Supplier') {
      const r = await rawGet<any>('SELECT id FROM ap_advances WHERE kode_nota = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Jurnal Memorial') {
      const r = await rawGet<any>('SELECT id FROM memorial_journals WHERE journal_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Pemakaian Stok' || sourceType === 'Pemakaian Barang') {
      const r = await rawGet<any>('SELECT id FROM stock_usage WHERE usage_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Manufaktur' || sourceType === 'Produksi') {
      const r = await rawGet<any>('SELECT id FROM manufacturing WHERE manufactur_number = ?', [sourceNumber])
      if (r) return r.id
    } else if (sourceType === 'Stok Opname') {
      const r = await rawGet<any>('SELECT id FROM stock_opname WHERE opname_number = ?', [sourceNumber])
      if (r) return r.id
    }
  } catch {}
  return 0
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_jurnal_memorial', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getDb()

    const allEntries = await loadAllEntries('2000-01-01', '2099-12-31')

    const groups = new Map<string, { source_type: string; source_id: number; source_number: string; entry_date: string; entries: any[] }>()
    for (const e of allEntries) {
      const key = `${e.source_type}|${e.source_number}`
      if (!groups.has(key)) {
        groups.set(key, {
          source_type: e.source_type,
          source_id: 0,
          source_number: e.source_number,
          entry_date: e.entry_date,
          entries: [],
        })
      }
      groups.get(key)!.entries.push(e)
    }

    const body = await req.json().catch(()=>({}))
    const dryRun = body.dryRun === true

    let insertedEntries = 0
    let replaced = 0
    let skipped = 0
    let total = 0
    for (const [key, group] of groups) {
      total++
      const srcNum = group.source_number || ''
      const srcDate = group.entry_date || '2000-01-01'
      let srcId = group.source_id
      if (!srcId) {
        srcId = await lookupSourceId(group.source_type, srcNum)
      }
      // Hitung entries yang diharapkan (non zero)
      const expectedEntries = group.entries.filter((e: any) => Number(e.debit || 0) !== 0 || Number(e.credit || 0) !== 0)
      if (expectedEntries.length === 0) { skipped++; continue }

      // Cek apakah jurnal sudah ada dan lengkap
      let needsRegen = true
      if (srcId) {
        const actual = await rawAll<any[]>('SELECT debit, credit FROM journal_entries WHERE source_type = ? AND source_id = ?', [group.source_type, srcId])
        if (actual.length > 0) {
          const actualDebit = actual.reduce((s: number, r: any) => s + Number(r.debit || 0), 0)
          const actualCredit = actual.reduce((s: number, r: any) => s + Number(r.credit || 0), 0)
          const expectedDebit = expectedEntries.reduce((s: number, e: any) => s + Number(e.debit || 0), 0)
          const expectedCredit = expectedEntries.reduce((s: number, e: any) => s + Number(e.credit || 0), 0)
          const match = Math.abs(actualDebit - expectedDebit) < 0.01 && Math.abs(actualCredit - expectedCredit) < 0.01
          if (match) {
            needsRegen = false
          }
        }
      }
      if (!needsRegen) { skipped++; continue }

      if (!dryRun) {
        // Hapus entries lama (jika ada) lalu insert baru
        if (srcId) {
          await rawRun('DELETE FROM journal_entries WHERE source_type = ? AND source_id = ?', [group.source_type, srcId])
        }
        for (const e of expectedEntries) {
          await rawRun(`
            INSERT INTO journal_entries (entry_date, source_type, source_id, source_number, account_code, account_name, debit, credit, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            srcDate,
            group.source_type,
            srcId,
            srcNum,
            e.account_code || '',
            e.account_name || '',
            Number(e.debit || 0),
            Number(e.credit || 0),
            e.description || '',
          ])
          insertedEntries++
        }
        replaced++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Selesai: ${replaced} transaksi diperbaiki (${insertedEntries} jurnal), ${skipped} transaksi sudah benar (dilewati). Total ${total} transaksi diproses.`,
      groups: total,
      replaced,
      insertedEntries,
      skipped,
      dryRun,
    })
  } catch (e: any) {
    console.error('POST /api/journal-backfill error:', e)
    return NextResponse.json({ error: e?.message || 'Gagal' }, { status: 500 })
  }
}