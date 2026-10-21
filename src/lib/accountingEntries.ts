import { rawAll, rawGet } from '@/db/raw'

export interface JournalEntry {
  entry_date: string
  source_type: string
  source_number: string
  description: string
  account_code: string
  account_name: string
  debit: number
  credit: number
  created_at?: string
}

interface MappingEntry {
  piutang_dagang: number | null
  penjualan_barang: number | null
  hpp: number | null
  persediaan_barang: number | null
  hutang_dagang: number | null
  potongan_penjualan: number | null
  retur_penjualan: number | null
  uang_muka_penjualan: number | null
  potongan_pembelian: number | null
  retur_pembelian: number | null
  uang_muka_pembelian: number | null
  ppn_keluaran: number | null
  ppn_keluaran_difakturkan: number | null
  ppn_masukan: number | null
  ppn_masukan_difakturkan: number | null
  service_charge: number | null
  default_cash_account: number | null
}

async function loadMappings(): Promise<MappingEntry> {
  const rows = await rawAll<any[]>('SELECT map_group, map_key, account_id FROM account_mappings')
  const m: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    m[r.map_group] = m[r.map_group] || {}
    m[r.map_group][r.map_key] = Number(r.account_id)
  }
  const accountOf = (group: string, key: string): number | null => m[group]?.[key] ?? null
  return {
    piutang_dagang: accountOf('pelanggan', 'piutang_dagang'),
    penjualan_barang: accountOf('pelanggan', 'penjualan_barang'),
    hpp: accountOf('pelanggan', 'hpp'),
    persediaan_barang: accountOf('barang', 'persediaan_barang'),
    hutang_dagang: accountOf('supplier', 'hutang_dagang'),
    potongan_penjualan: accountOf('pelanggan', 'potongan_penjualan'),
    retur_penjualan: accountOf('pelanggan', 'retur_penjualan'),
    uang_muka_penjualan: accountOf('pelanggan', 'uang_muka_penjualan'),
    potongan_pembelian: accountOf('supplier', 'potongan_pembelian'),
    retur_pembelian: accountOf('supplier', 'retur_pembelian'),
    uang_muka_pembelian: accountOf('supplier', 'uang_muka_pembelian'),
    ppn_keluaran: accountOf('pelanggan', 'ppn_keluaran'),
    ppn_keluaran_difakturkan: accountOf('pelanggan', 'ppn_keluaran_difakturkan'),
    ppn_masukan: accountOf('supplier', 'ppn_masukan'),
    ppn_masukan_difakturkan: accountOf('supplier', 'ppn_masukan_difakturkan'),
    service_charge: accountOf('pelanggan', 'service_charge'),
    default_cash_account: accountOf('pelanggan', 'default_cash_account'),
  }
}

async function accCode(id: number | null): Promise<{ code: string; name: string }> {
  if (!id) return { code: '', name: '' }
  try {
    const r = await rawGet<any>('SELECT code, name FROM accounts WHERE id = ?', [id])
    return r ? { code: r.code || '', name: r.name || '' } : { code: '', name: '' }
  } catch { return { code: '', name: '' } }
}

/** Load all journal entries from ALL transaction sources */
export async function loadAllEntries(
  startDate: string,
  endDate: string,
): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = []
  const map = await loadMappings()

  // 1. Memorial journals
  try {
    const rows = await rawAll<any[]>(`
      SELECT j.journal_date::text as journal_date, j.journal_number, j.notes as description,
             d.account_code, (SELECT name FROM accounts a WHERE a.id = d.account_id LIMIT 1) AS account_name,
              d.debit, d.credit, d.notes as line_notes, j.created_at
      FROM memorial_journals j
      JOIN memorial_journal_details d ON d.memorial_journal_id = j.id
      WHERE j.status = 'active'
        AND j.journal_date >= ? AND j.journal_date <= ?
      ORDER BY j.journal_date, j.id, d.line_no
    `, [startDate, endDate])
    for (const r of rows) {
      entries.push({
        entry_date: r.journal_date,
        source_type: 'Jurnal Memorial',
        source_number: r.journal_number,
        description: 'jurnal memorial' + (r.line_notes ? ' - ' + r.line_notes : (r.description ? ' - ' + r.description : '')),
        account_code: r.account_code || '',
        account_name: r.account_name || '',
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
        created_at: r.created_at || '',
      })
    }
  } catch {}

  // 2. Sales transactions
  try {
    const sales = await rawAll<any[]>(`
      SELECT t.id, t.transaction_number, t.created_at,
             COALESCE(t.transaction_date::text, t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) as tdate, t.total, t.subtotal,
             t.discount_amount, t.ppn_amount, COALESCE(t.service_charge_amount,0) as service_charge_amount, t.customer_name, t.customer_id,
             COALESCE(t.is_return, 0) as is_return
      FROM transactions t
      WHERE COALESCE(t.transaction_date::text, t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) >= ? AND COALESCE(t.transaction_date::text, t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) <= ?
        AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
        AND COALESCE(t.is_return, 0) = 0
      ORDER BY tdate, t.id
    `, [startDate, endDate])
    for (const s of sales) {
      const total = Number(s.total || 0)
      const subtotal = Number(s.subtotal || 0)
      const discAmt = Number(s.discount_amount || 0)
      const ppnAmt = Number(s.ppn_amount || 0)
      if (total <= 0) continue

      let arId = map.piutang_dagang
      if (s.customer_id) {
        const custAcc = await rawGet<any>('SELECT account_id FROM master_customer WHERE id = ? AND account_id IS NOT NULL', [s.customer_id])
        if (custAcc?.account_id) arId = Number(custAcc.account_id)
      }
      const svcAmt = Number(s.service_charge_amount || 0)
      const arAcc = await accCode(arId)
      const revAcc = await accCode(map.penjualan_barang)
      const discAcc = await accCode(map.potongan_penjualan)
      const ppnKelAcc = await accCode(map.ppn_keluaran)
      const svcAcc = await accCode(map.service_charge)

      if (arAcc.code) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Penjualan',
          source_number: s.transaction_number,
          description: 'penjualan',
          account_code: arAcc.code,
          account_name: arAcc.name,
          debit: total,
          credit: 0,
          created_at: s.created_at || '',
        })
      }
      if (revAcc.code) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Penjualan',
          source_number: s.transaction_number,
          description: 'penjualan',
          account_code: revAcc.code,
          account_name: revAcc.name,
          debit: 0,
          credit: subtotal,
          created_at: s.created_at || '',
        })
      }
      if (discAcc.code && discAmt > 0) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Penjualan',
          source_number: s.transaction_number,
          description: 'penjualan',
          account_code: discAcc.code,
          account_name: discAcc.name,
          debit: discAmt,
          credit: 0,
          created_at: s.created_at || '',
        })
      }
      if (ppnKelAcc.code && ppnAmt > 0) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Penjualan',
          source_number: s.transaction_number,
          description: 'penjualan',
          account_code: ppnKelAcc.code,
          account_name: ppnKelAcc.name,
          debit: 0,
          credit: ppnAmt,
          created_at: s.created_at || '',
        })
      }
      if (svcAcc.code && svcAmt > 0) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Penjualan',
          source_number: s.transaction_number,
          description: 'penjualan',
          account_code: svcAcc.code,
          account_name: svcAcc.name,
          debit: 0,
          credit: svcAmt,
          created_at: s.created_at || '',
        })
      }

      // HPP
      if (map.hpp && map.persediaan_barang) {
        try {
          const cogsRow = await rawGet<any>(`
            SELECT COALESCE(SUM(cogs_total), 0) as total
            FROM transaction_items
            WHERE transaction_id = ? AND COALESCE(cogs_total, 0) > 0
          `, [s.id])
          const cogsTotal = Number(cogsRow?.total || 0)
          if (cogsTotal > 0) {
            const hppAcc = await accCode(map.hpp)
            const persAcc = await accCode(map.persediaan_barang)
            if (hppAcc.code && persAcc.code) {
              entries.push({
                entry_date: s.tdate,
                source_type: 'Penjualan',
                source_number: s.transaction_number,
                description: 'penjualan',
                account_code: hppAcc.code,
                account_name: hppAcc.name,
                debit: cogsTotal,
                credit: 0,
                created_at: s.created_at || '',
              })
              entries.push({
                entry_date: s.tdate,
                source_type: 'Penjualan',
                source_number: s.transaction_number,
                description: 'penjualan',
                account_code: persAcc.code,
                account_name: persAcc.name,
                debit: 0,
                credit: cogsTotal,
                created_at: s.created_at || '',
              })
            }
          }
        } catch {}
      }

      // Auto-generate AR Payment dari transaction_payments
      try {
        const tps = await rawAll<any[]>('SELECT method, amount, account_id FROM transaction_payments WHERE transaction_id = ?', [s.id])
        if (tps.length > 0 && arAcc.code) {
          const allHaveAccount = tps.every((tp: any) => tp.account_id != null)
          if (allHaveAccount) {
            const existingAr = await rawGet<any>('SELECT COUNT(*) as cnt FROM ar_payment_items pai JOIN ar_payments ap ON ap.id = pai.payment_id AND ap.status = \'active\' WHERE pai.sale_id = ?', [s.id])
            if (!existingAr?.cnt) {
              entries.push({
                entry_date: s.tdate,
                source_type: 'Terima Piutang',
                source_number: s.transaction_number,
                description: 'penjualan',
                account_code: arAcc.code,
                account_name: arAcc.name,
                debit: 0,
                credit: total,
                created_at: s.created_at || '',
              })
              for (const tp of tps as any[]) {
                const tpAcc = await accCode(Number(tp.account_id))
                if (tpAcc.code) {
                  entries.push({
                    entry_date: s.tdate,
                    source_type: 'Terima Piutang',
                    source_number: s.transaction_number,
                    description: 'penjualan',
                    account_code: tpAcc.code,
                    account_name: tpAcc.name,
                    debit: Number(tp.amount || 0),
                    credit: 0,
                    created_at: s.created_at || '',
                  })
                }
              }
            }
          }
        }
      } catch {}
    }
  } catch {}

  // 2b. Sales Returns
  try {
    const returns = await rawAll<any[]>(`
      SELECT t.id, t.transaction_number, t.created_at,
             COALESCE(t.transaction_date::text, t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) as tdate, t.total, t.subtotal,
             t.discount_amount, t.ppn_amount, t.customer_name, t.customer_id
      FROM transactions t
      WHERE COALESCE(t.transaction_date::text, t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) >= ? AND COALESCE(t.transaction_date::text, t.tgl_nota::text, SUBSTRING(t.created_at::text,1,10)) <= ?
        AND COALESCE(t.status, '') NOT IN ('void', 'cancelled')
        AND COALESCE(t.is_return, 0) = 1
      ORDER BY tdate, t.id
    `, [startDate, endDate])
    for (const s of returns) {
      const total = Math.abs(Number(s.total || 0))
      const subtotal = Math.abs(Number(s.subtotal || 0))
      const ppnAmt = Math.abs(Number(s.ppn_amount || 0))
      if (total <= 0) continue
      let arId = map.piutang_dagang
      if (s.customer_id) {
        const custAcc = await rawGet<any>('SELECT account_id FROM master_customer WHERE id = ? AND account_id IS NOT NULL', [s.customer_id])
        if (custAcc?.account_id) arId = Number(custAcc.account_id)
      }
      const arAcc = await accCode(arId)
      const revAcc = await accCode(map.penjualan_barang)
      const discAcc = await accCode(map.potongan_penjualan)
      const ppnKelAcc = await accCode(map.ppn_keluaran)
      if (arAcc.code) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Retur Penjualan',
          source_number: s.transaction_number,
          description: 'retur penjualan',
          account_code: arAcc.code,
          account_name: arAcc.name,
          debit: 0,
          credit: total,
          created_at: s.created_at || '',
        })
      }
      if (revAcc.code && subtotal > 0) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Retur Penjualan',
          source_number: s.transaction_number,
          description: 'retur penjualan',
          account_code: revAcc.code,
          account_name: revAcc.name,
          debit: subtotal,
          credit: 0,
          created_at: s.created_at || '',
        })
      }
      if (ppnKelAcc.code && ppnAmt > 0) {
        entries.push({
          entry_date: s.tdate,
          source_type: 'Retur Penjualan',
          source_number: s.transaction_number,
          description: 'retur penjualan',
          account_code: ppnKelAcc.code,
          account_name: ppnKelAcc.name,
          debit: ppnAmt,
          credit: 0,
          created_at: s.created_at || '',
        })
      }
    }
  } catch {}

  // 3. Purchases
  try {
    const purchases = await rawAll<any[]>(`
      SELECT p.id, p.purchase_number, p.purchase_date as tdate, p.total, COALESCE(p.ppn_amount,0) as ppn_amount, p.supplier_id,
             COALESCE((SELECT s.name FROM master_supplier s WHERE s.id = p.supplier_id), '') as supplier_name,
             COALESCE(p.notes, '') as notes, COALESCE(p.faktur_pajak, '') as faktur_pajak, p.created_at
      FROM purchases p
      WHERE p.purchase_date >= ? AND p.purchase_date <= ?
        AND (p.is_return IS NULL OR p.is_return = 0)
        AND COALESCE(p.void, 0) = 0
      ORDER BY p.purchase_date, p.id
    `, [startDate, endDate])
    for (const pr of purchases) {
      const total = Number(pr.total || 0)
      const ppnAmt = Number(pr.ppn_amount || 0)
      const invTotal = total - ppnAmt
      if (total <= 0) continue
      let apId = map.hutang_dagang
      if (pr.supplier_id) {
        const suppAcc = await rawGet<any>('SELECT account_id FROM master_supplier WHERE id = ? AND account_id IS NOT NULL', [pr.supplier_id])
        if (suppAcc?.account_id) apId = Number(suppAcc.account_id)
      }
      const apAcc = await accCode(apId)
      const ppnMasAcc = await accCode(map.ppn_masukan)
      const ppnMasDifAcc = await accCode(map.ppn_masukan_difakturkan)
      const hasFakturPajak = !!(pr.faktur_pajak || '').trim()
      const items = await rawAll<any[]>(`
        SELECT pi.quantity, pi.unit_price, pi.total_price, b.account_id
        FROM purchase_items pi
        LEFT JOIN master_barang b ON b.id = pi.barang_id
        WHERE pi.purchase_id = ?
      `, [pr.id])
      const invByAccount: Record<number, { id: number; total: number }> = {}
      let rawInvTotal = 0
      for (const item of items) {
        const invId = item.account_id || map.persediaan_barang || 0
        if (!invId) continue
        const lineTotal = Number(item.total_price || item.quantity * item.unit_price || 0)
        rawInvTotal += lineTotal
        invByAccount[invId] = invByAccount[invId] || { id: invId, total: 0 }
        invByAccount[invId].total += lineTotal
      }
      const ratio = rawInvTotal > 0 ? invTotal / rawInvTotal : 1
      const invAccounts = Object.values(invByAccount)
      if (invAccounts.length > 0) {
        for (const ia of invAccounts) {
          const iaAcc = await accCode(ia.id)
          if (iaAcc.code) {
            entries.push({
              entry_date: pr.tdate,
              source_type: 'Pembelian',
              source_number: pr.purchase_number,
              description: 'pembelian' + (pr.notes ? ' - ' + pr.notes : ''),
              account_code: iaAcc.code,
              account_name: iaAcc.name,
              debit: Math.round(ia.total * ratio * 100) / 100,
              credit: 0,
              created_at: pr.created_at || '',
            })
          }
        }
      } else {
        const invAcc = await accCode(map.persediaan_barang)
        if (invAcc.code) {
          entries.push({
            entry_date: pr.tdate,
            source_type: 'Pembelian',
            source_number: pr.purchase_number,
            description: 'pembelian' + (pr.notes ? ' - ' + pr.notes : ''),
            account_code: invAcc.code,
            account_name: invAcc.name,
            debit: Math.round(invTotal * 100) / 100,
            credit: 0,
            created_at: pr.created_at || '',
          })
        }
      }
      if (ppnAmt > 0) {
        if (hasFakturPajak && ppnMasDifAcc.code) {
          entries.push({
            entry_date: pr.tdate,
            source_type: 'Pembelian',
            source_number: pr.purchase_number,
            description: 'pembelian' + (pr.notes ? ' - ' + pr.notes : ''),
            account_code: ppnMasDifAcc.code,
            account_name: ppnMasDifAcc.name,
            debit: Math.round(ppnAmt * 100) / 100,
            credit: 0,
            created_at: pr.created_at || '',
          })
        } else if (ppnMasAcc.code) {
          entries.push({
            entry_date: pr.tdate,
            source_type: 'Pembelian',
            source_number: pr.purchase_number,
            description: 'pembelian' + (pr.notes ? ' - ' + pr.notes : ''),
            account_code: ppnMasAcc.code,
            account_name: ppnMasAcc.name,
            debit: Math.round(ppnAmt * 100) / 100,
            credit: 0,
            created_at: pr.created_at || '',
          })
        }
      }
      if (apAcc.code) {
        entries.push({
          entry_date: pr.tdate,
          source_type: 'Pembelian',
          source_number: pr.purchase_number,
          description: 'pembelian' + (pr.notes ? ' - ' + pr.notes : ''),
          account_code: apAcc.code,
          account_name: apAcc.name,
          debit: 0,
          credit: total,
          created_at: pr.created_at || '',
        })
      }
    }
  } catch (e) { console.warn('Purchases entries error:', e) }

  // 3b. Purchase Returns
  try {
    const returns = await rawAll<any[]>(`
      SELECT p.id, p.purchase_number, p.purchase_date as tdate, p.total, COALESCE(p.ppn_amount,0) as ppn_amount, p.supplier_id,
             COALESCE((SELECT s.name FROM master_supplier s WHERE s.id = p.supplier_id), '') as supplier_name,
             COALESCE(p.faktur_pajak, '') as faktur_pajak, p.created_at
      FROM purchases p
      WHERE p.purchase_date >= ? AND p.purchase_date <= ?
        AND p.is_return = 1
        AND COALESCE(p.void, 0) = 0
      ORDER BY p.purchase_date, p.id
    `, [startDate, endDate])
    for (const pr of returns) {
      const total = Math.abs(Number(pr.total || 0))
      const ppnAmt = Math.abs(Number(pr.ppn_amount || 0))
      const invTotal = total - ppnAmt
      if (total <= 0) continue
      let apId = map.hutang_dagang
      if (pr.supplier_id) {
        const suppAcc = await rawGet<any>('SELECT account_id FROM master_supplier WHERE id = ? AND account_id IS NOT NULL', [pr.supplier_id])
        if (suppAcc?.account_id) apId = Number(suppAcc.account_id)
      }
      const apAcc = await accCode(apId)
      const ppnMasAcc = await accCode(map.ppn_masukan)
      const ppnMasDifAcc = await accCode(map.ppn_masukan_difakturkan)
      const hasFakturPajak = !!(pr.faktur_pajak || '').trim()
      const items = await rawAll<any[]>(`
        SELECT pi.quantity, pi.unit_price, pi.total_price, b.account_id
        FROM purchase_items pi
        LEFT JOIN master_barang b ON b.id = pi.barang_id
        WHERE pi.purchase_id = ?
      `, [pr.id])
      const invByAccount: Record<number, { id: number; total: number }> = {}
      let rawInvTotal = 0
      for (const item of items) {
        const invId = item.account_id || map.persediaan_barang || 0
        if (!invId) continue
        const lineTotal = Number(item.total_price || item.quantity * item.unit_price || 0)
        rawInvTotal += lineTotal
        invByAccount[invId] = invByAccount[invId] || { id: invId, total: 0 }
        invByAccount[invId].total += lineTotal
      }
      const ratio = rawInvTotal > 0 ? invTotal / rawInvTotal : 1
      const invAccounts = Object.values(invByAccount)
      if (invAccounts.length > 0) {
        for (const ia of invAccounts) {
          const iaAcc = await accCode(ia.id)
          if (iaAcc.code) {
            entries.push({
              entry_date: pr.tdate,
              source_type: 'Retur Pembelian',
              source_number: pr.purchase_number,
              description: 'retur pembelian',
              account_code: iaAcc.code,
              account_name: iaAcc.name,
              debit: 0,
              credit: Math.round(ia.total * ratio * 100) / 100,
              created_at: pr.created_at || '',
            })
          }
        }
      } else {
        const invAcc = await accCode(map.persediaan_barang)
        if (invAcc.code && invTotal > 0) {
          entries.push({
            entry_date: pr.tdate,
            source_type: 'Retur Pembelian',
            source_number: pr.purchase_number,
            description: 'retur pembelian',
            account_code: invAcc.code,
            account_name: invAcc.name,
            debit: 0,
            credit: Math.round(invTotal * 100) / 100,
            created_at: pr.created_at || '',
          })
        }
      }
      if (ppnAmt > 0) {
        if (hasFakturPajak && ppnMasDifAcc.code) {
          entries.push({
            entry_date: pr.tdate,
            source_type: 'Retur Pembelian',
            source_number: pr.purchase_number,
            description: 'retur pembelian',
            account_code: ppnMasDifAcc.code,
            account_name: ppnMasDifAcc.name,
            debit: 0,
            credit: Math.round(ppnAmt * 100) / 100,
            created_at: pr.created_at || '',
          })
        } else if (ppnMasAcc.code) {
          entries.push({
            entry_date: pr.tdate,
            source_type: 'Retur Pembelian',
            source_number: pr.purchase_number,
            description: 'retur pembelian',
            account_code: ppnMasAcc.code,
            account_name: ppnMasAcc.name,
            debit: 0,
            credit: Math.round(ppnAmt * 100) / 100,
            created_at: pr.created_at || '',
          })
        }
      }
      if (apAcc.code) {
        entries.push({
          entry_date: pr.tdate,
          source_type: 'Retur Pembelian',
          source_number: pr.purchase_number,
          description: 'retur pembelian',
          account_code: apAcc.code,
          account_name: apAcc.name,
          debit: total,
          credit: 0,
          created_at: pr.created_at || '',
        })
      }
    }
  } catch (e) { console.warn('Purchase returns entries error:', e) }

  // 4. AP Payments
  try {
    const apPayments = await rawAll<any[]>(`
      SELECT p.id, p.payment_number, p.payment_date, p.notes, p.supplier_id,
             COALESCE((SELECT s.name FROM master_supplier s WHERE s.id = p.supplier_id), '') as supplier_name,
             p.created_at
      FROM ap_payments p
      WHERE p.payment_date >= ? AND p.payment_date <= ? AND p.status = 'active'
      ORDER BY p.payment_date, p.id
    `, [startDate, endDate])
    for (const ap of apPayments) {
      let apId = map.hutang_dagang
      if (ap.supplier_id) {
        const suppAcc = await rawGet<any>('SELECT account_id FROM master_supplier WHERE id = ? AND account_id IS NOT NULL', [ap.supplier_id])
        if (suppAcc?.account_id) apId = Number(suppAcc.account_id)
      }
      const apAcc = await accCode(apId)
      if (apAcc.code) {
        const items = await rawAll<any[]>('SELECT source_type, SUM(pay_amount) as sum_amount FROM ap_payment_items WHERE payment_id = ? GROUP BY source_type', [ap.id])
        let purchaseTotal = 0, advanceTotal = 0, returnTotal = 0
        for (const it of items) {
          const amt = Number(it.sum_amount || 0)
          const st = String(it.source_type || '')
          if (st === 'ap_advance') advanceTotal += amt
          else if (st === 'purchase_return') returnTotal += amt
          else purchaseTotal += amt
        }
        const methodsTotal = (await rawGet<any>('SELECT COALESCE(SUM(amount),0) as total FROM ap_payment_methods WHERE payment_id = ?', [ap.id]))?.total || 0
        const extraDebit = (await rawGet<any>('SELECT COALESCE(SUM(debit),0) as total FROM ap_payment_extras WHERE payment_id = ?', [ap.id]))?.total || 0
        const extraCredit = (await rawGet<any>('SELECT COALESCE(SUM(credit),0) as total FROM ap_payment_extras WHERE payment_id = ?', [ap.id]))?.total || 0

        if (purchaseTotal > 0) {
          entries.push({
            entry_date: ap.payment_date,
            source_type: 'Bayar Hutang',
            source_number: ap.payment_number,
            description: 'bayar hutang' + (ap.notes ? ' - ' + ap.notes : ''),
            account_code: apAcc.code,
            account_name: apAcc.name,
            debit: purchaseTotal,
            credit: 0,
            created_at: ap.created_at || '',
          })
        }
        if (returnTotal > 0) {
          entries.push({
            entry_date: ap.payment_date,
            source_type: 'Bayar Hutang',
            source_number: ap.payment_number,
            description: 'bayar hutang',
            account_code: apAcc.code,
            account_name: apAcc.name,
            debit: 0,
            credit: returnTotal,
            created_at: ap.created_at || '',
          })
        }

        const methodsTotalMinusExtras = methodsTotal - extraDebit + extraCredit
        const invoicePortion = purchaseTotal - returnTotal - advanceTotal
        const methods = await rawAll<any[]>('SELECT m.account_id, m.amount FROM ap_payment_methods m WHERE m.payment_id = ?', [ap.id])
        for (const m of methods) {
          const mac = await accCode(Number(m.account_id))
          if (mac.code) {
            let methodCredit = Number(m.amount || 0)
            if (methodsTotal > invoicePortion + 0.005) {
              methodCredit = Math.round((methodCredit / methodsTotal) * invoicePortion * 100) / 100
            }
            if (methodCredit > 0) {
              entries.push({
                entry_date: ap.payment_date,
                source_type: 'Bayar Hutang',
                source_number: ap.payment_number,
                description: 'bayar hutang',
                account_code: mac.code,
                account_name: mac.name,
                debit: 0,
                credit: methodCredit,
                created_at: ap.created_at || '',
              })
            }
          }
        }
        const extras = await rawAll<any[]>('SELECT e.account_id, e.debit, e.credit, e.notes FROM ap_payment_extras e WHERE e.payment_id = ?', [ap.id])
        for (const e of extras) {
          const eac = await accCode(Number(e.account_id))
          if (eac.code) {
            entries.push({
              entry_date: ap.payment_date,
              source_type: 'Bayar Hutang',
              source_number: ap.payment_number,
              description: 'bayar hutang' + (e.notes ? ' - ' + e.notes : ''),
              account_code: eac.code,
              account_name: eac.name,
              debit: Number(e.debit || 0),
              credit: Number(e.credit || 0),
              created_at: ap.created_at || '',
            })
          }
        }
      }
    }
  } catch {}

  // 5. AR Receipts
  try {
    const arPayments = await rawAll<any[]>(`
      SELECT p.id, p.payment_number, p.payment_date, p.notes,
             COALESCE((SELECT c.name FROM master_customer c WHERE c.id = p.customer_id), '') as customer_name,
             p.created_at
      FROM ar_payments p
      WHERE p.payment_date >= ? AND p.payment_date <= ? AND p.status = 'active'
      ORDER BY p.payment_date, p.id
    `, [startDate, endDate])
    for (const ar of arPayments) {
      const arAcc = await accCode(map.piutang_dagang)
      if (arAcc.code) {
        const methodsTotal = (await rawGet<any>('SELECT COALESCE(SUM(amount),0) as total FROM ar_payment_methods WHERE payment_id = ?', [ar.id]))?.total || 0
        const extraDebit = (await rawGet<any>('SELECT COALESCE(SUM(debit),0) as total FROM ar_payment_extras WHERE payment_id = ?', [ar.id]))?.total || 0
        const extraCredit = (await rawGet<any>('SELECT COALESCE(SUM(credit),0) as total FROM ar_payment_extras WHERE payment_id = ?', [ar.id]))?.total || 0

        const items = await rawAll<any[]>('SELECT source_type, SUM(pay_amount) as sum_amount FROM ar_payment_items WHERE payment_id = ? GROUP BY source_type', [ar.id])
        let transactionTotal = 0, advanceTotal = 0, returnTotal = 0
        for (const it of items) {
          const amt = Number(it.sum_amount || 0)
          const st = String(it.source_type || '')
          if (st === 'ar_advance') advanceTotal += amt
          else if (st === 'sales_return') returnTotal += amt
          else transactionTotal += amt
        }

        const arCredit = transactionTotal - returnTotal
        if (arCredit > 0) {
          entries.push({
            entry_date: ar.payment_date,
            source_type: 'Terima Piutang',
            source_number: ar.payment_number,
            description: 'terima piutang' + (ar.notes ? ' - ' + ar.notes : ''),
            account_code: arAcc.code,
            account_name: arAcc.name,
            debit: 0,
            credit: arCredit,
            created_at: ar.created_at || '',
          })
        }
        const methods = await rawAll<any[]>('SELECT m.account_id, m.account_code, m.account_name, m.amount FROM ar_payment_methods m WHERE m.payment_id = ?', [ar.id])
        if (advanceTotal > 0) {
          const umAcc = await accCode(map.uang_muka_penjualan)
          if (umAcc.code) {
            entries.push({
              entry_date: ar.payment_date,
              source_type: 'Terima Piutang',
              source_number: ar.payment_number,
              description: 'terima piutang',
              account_code: umAcc.code,
              account_name: umAcc.name,
              debit: advanceTotal,
              credit: 0,
              created_at: ar.created_at || '',
            })
          }
        }
        const invoicePortionAr = transactionTotal - returnTotal - advanceTotal
        for (const m of methods) {
          let code = m.account_code || ''
          let name = m.account_name || ''
          if (!code) {
            const mac = await accCode(Number(m.account_id))
            code = mac.code
            name = mac.name
          }
          if (code) {
            let methodDebit = Number(m.amount || 0)
            if (methodsTotal > invoicePortionAr + 0.005) {
              methodDebit = Math.round((methodDebit / methodsTotal) * invoicePortionAr * 100) / 100
            }
            if (methodDebit > 0) {
              entries.push({
                entry_date: ar.payment_date,
                source_type: 'Terima Piutang',
                source_number: ar.payment_number,
                description: 'mutasi kas',
                account_code: code,
                account_name: name,
                debit: methodDebit,
                credit: 0,
                created_at: ar.created_at || '',
              })
            }
          }
        }
        const extras = await rawAll<any[]>('SELECT e.account_id, e.debit, e.credit, e.notes FROM ar_payment_extras e WHERE e.payment_id = ?', [ar.id])
        for (const e of extras) {
          const eac = await accCode(Number(e.account_id))
          if (eac.code) {
            entries.push({
              entry_date: ar.payment_date,
              source_type: 'Terima Piutang',
              source_number: ar.payment_number,
              description: 'terima piutang' + (e.notes ? ' - ' + e.notes : ''),
              account_code: eac.code,
              account_name: eac.name,
              debit: Number(e.debit || 0),
              credit: Number(e.credit || 0),
              created_at: ar.created_at || '',
            })
          }
        }
      }
    }
  } catch {}

  // 6. Cash mutations
  try {
    const cm = await rawAll<any[]>(`
      SELECT m.id, m.mutation_number, m.mutation_date, m.cash_account_code, m.cash_account_id,
             m.mutation_type, m.total_amount, m.notes, m.created_at
      FROM cash_mutations m
      WHERE m.mutation_date >= ? AND m.mutation_date <= ? AND m.status = 'active'
      ORDER BY m.mutation_date, m.id
    `, [startDate, endDate])
    for (const m of cm) {
      const total = Number(m.total_amount || 0)
      if (total <= 0) continue
      const cashAcc = await accCode(Number(m.cash_account_id))
      if (m.mutation_type === 'MASUK') {
        if (cashAcc.code) {
          entries.push({
            entry_date: m.mutation_date,
            source_type: 'Mutasi Kas',
            source_number: m.mutation_number,
            description: 'mutasi kas' + (m.notes ? ' - ' + m.notes : ''),
            account_code: cashAcc.code,
            account_name: cashAcc.name,
            debit: total,
            credit: 0,
            created_at: m.created_at || '',
          })
        }
        const details = await rawAll<any[]>('SELECT d.account_id, d.account_code, d.amount FROM cash_mutation_details d WHERE d.cash_mutation_id = ?', [m.id])
        for (const d of details) {
          let dac = await accCode(Number(d.account_id))
          if (!dac.code && d.account_code) {
            const byCode = await rawGet<any>('SELECT code, name FROM accounts WHERE code = ?', [d.account_code])
            if (byCode) { dac = { code: byCode.code, name: byCode.name } }
            else dac = { code: d.account_code, name: '' }
          }
          if (dac.code) {
            entries.push({
              entry_date: m.mutation_date,
              source_type: 'Mutasi Kas',
              source_number: m.mutation_number,
              description: 'mutasi kas',
              account_code: dac.code,
              account_name: dac.name,
              debit: 0,
              credit: Number(d.amount || 0),
              created_at: m.created_at || '',
            })
          }
        }
      } else {
        if (cashAcc.code) {
          entries.push({
            entry_date: m.mutation_date,
            source_type: 'Mutasi Kas',
            source_number: m.mutation_number,
            description: 'mutasi kas' + (m.notes ? ' - ' + m.notes : ''),
            account_code: cashAcc.code,
            account_name: cashAcc.name,
            debit: 0,
            credit: total,
            created_at: m.created_at || '',
          })
        }
        const details = await rawAll<any[]>('SELECT d.account_id, d.account_code, d.amount FROM cash_mutation_details d WHERE d.cash_mutation_id = ?', [m.id])
        for (const d of details) {
          let dac = await accCode(Number(d.account_id))
          if (!dac.code && d.account_code) {
            const byCode = await rawGet<any>('SELECT code, name FROM accounts WHERE code = ?', [d.account_code])
            if (byCode) { dac = { code: byCode.code, name: byCode.name } }
            else dac = { code: d.account_code, name: '' }
          }
          if (dac.code) {
            entries.push({
              entry_date: m.mutation_date,
              source_type: 'Mutasi Kas',
              source_number: m.mutation_number,
              description: 'mutasi kas',
              account_code: dac.code,
              account_name: dac.name,
              debit: Number(d.amount || 0),
              credit: 0,
              created_at: m.created_at || '',
            })
          }
        }
      }
    }
  } catch {}

  // 7. AP Advance items used in payments
  try {
    const uangMukaAcc = await accCode(map.uang_muka_pembelian)
    if (uangMukaAcc.code) {
      const advItems = await rawAll<any[]>(`
        SELECT pi.pay_amount, p.payment_date, p.payment_number, p.created_at,
               COALESCE((SELECT s.name FROM master_supplier s WHERE s.id = p.supplier_id), '') as supplier_name
        FROM ap_payment_items pi
        JOIN ap_payments p ON p.id = pi.payment_id AND p.status = 'active'
        WHERE pi.source_type = 'ap_advance' AND pi.pay_amount > 0
          AND p.payment_date >= ? AND p.payment_date <= ?
        ORDER BY p.payment_date, p.id
      `, [startDate, endDate])
      for (const ai of advItems) {
        entries.push({
          entry_date: ai.payment_date,
          source_type: 'Bayar Hutang',
          source_number: ai.payment_number,
          description: 'bayar hutang',
          account_code: uangMukaAcc.code,
          account_name: uangMukaAcc.name,
          debit: 0,
          credit: Number(ai.pay_amount || 0),
          created_at: ai.created_at || '',
        })
      }
    }
  } catch {}

  // 8. AP Advances
  try {
    const uangMukaAcc = await accCode(map.uang_muka_pembelian)
    const advances = await rawAll<any[]>(`
      SELECT a.id, a.kode_nota, a.tanggal as tdate, a.supplier_id,
             COALESCE((SELECT s.name FROM master_supplier s WHERE s.id = a.supplier_id), '') as supplier_name,
             COALESCE(a.total_amount, a.total, 0) as total, a.created_at
      FROM ap_advances a
      WHERE a.tanggal >= ? AND a.tanggal <= ? AND (a.status = 'active' OR a.status IS NULL)
      ORDER BY a.tanggal, a.id
    `, [startDate, endDate])

    let fkCol = 'ap_advance_id'
    try {
      const lineCols = await rawAll<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'ap_advance_lines' AND table_schema = 'public'")
      const colNames = lineCols.map((x:any)=>String(x.column_name).toLowerCase())
      fkCol = colNames.includes('ap_advance_id') ? 'ap_advance_id' : colNames.includes('advance_id') ? 'advance_id' : 'ap_advance_id'
    } catch {}
    let amtCol = 'amount'
    try {
      const lineCols = await rawAll<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'ap_advance_lines' AND table_schema = 'public'")
      const colNames = lineCols.map((x:any)=>String(x.column_name).toLowerCase())
      amtCol = colNames.includes('amount') ? 'amount' : 'nominal'
    } catch {}
    for (const adv of advances) {
      const total = Number(adv.total || 0)
      if (total <= 0) continue
      if (uangMukaAcc.code) {
        entries.push({
          entry_date: adv.tdate,
          source_type: 'Uang Muka Supplier',
          source_number: adv.kode_nota,
          description: 'uang muka supplier',
          account_code: uangMukaAcc.code,
          account_name: uangMukaAcc.name,
          debit: total,
          credit: 0,
          created_at: adv.created_at || '',
        })
      }
      const lines = await rawAll<any[]>(`SELECT account_id, account_code, ${amtCol} as amount FROM ap_advance_lines WHERE ${fkCol} = ?`, [adv.id])
      for (const ln of lines) {
        let lac = await accCode(Number(ln.account_id))
        if (!lac.code && ln.account_code) {
          const byCode = await rawGet<any>('SELECT code, name FROM accounts WHERE code = ?', [ln.account_code])
          lac = byCode ? { code: byCode.code, name: byCode.name } : { code: ln.account_code, name: '' }
        }
        if (lac.code && Number(ln.amount||0) > 0) {
          entries.push({
            entry_date: adv.tdate,
            source_type: 'Uang Muka Supplier',
            source_number: adv.kode_nota,
            description: 'uang muka supplier',
            account_code: lac.code,
            account_name: lac.name,
            debit: 0,
            credit: Number(ln.amount || 0),
            created_at: adv.created_at || '',
          })
        }
      }
    }
  } catch {}

  // 8b. AR Advances
  try {
    const uangMukaArAcc = await accCode(map.uang_muka_penjualan)
    const arAdvances = await rawAll<any[]>(`
      SELECT a.id, a.kode_nota, a.tanggal as tdate, a.customer_id,
             COALESCE((SELECT c.name FROM master_customer c WHERE c.id = a.customer_id), '') as customer_name,
             COALESCE(a.total_amount, a.total, 0) as total, a.created_at
      FROM ar_advances a
      WHERE a.tanggal >= ? AND a.tanggal <= ? AND (a.status = 'active' OR a.status IS NULL)
      ORDER BY a.tanggal, a.id
    `, [startDate, endDate])
    let arFkCol = 'ar_advance_id'
    try {
      const lineCols = await rawAll<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'ar_advance_lines' AND table_schema = 'public'")
      const colNames = lineCols.map((x:any)=>String(x.column_name).toLowerCase())
      arFkCol = colNames.includes('ar_advance_id') ? 'ar_advance_id' : colNames.includes('advance_id') ? 'advance_id' : 'ar_advance_id'
    } catch {}
    let arAmtCol = 'amount'
    try {
      const lineCols = await rawAll<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'ar_advance_lines' AND table_schema = 'public'")
      const colNames = lineCols.map((x:any)=>String(x.column_name).toLowerCase())
      arAmtCol = colNames.includes('amount') ? 'amount' : 'nominal'
    } catch {}
    for (const adv of arAdvances) {
      const total = Number(adv.total || 0)
      if (total <= 0) continue
      if (uangMukaArAcc.code) {
        entries.push({
          entry_date: adv.tdate,
          source_type: 'Uang Muka Customer',
          source_number: adv.kode_nota,
          description: 'uang muka customer',
          account_code: uangMukaArAcc.code,
          account_name: uangMukaArAcc.name,
          debit: 0,
          credit: total,
          created_at: adv.created_at || '',
        })
      }
      const lines = await rawAll<any[]>(`SELECT account_id, account_code, ${arAmtCol} as amount FROM ar_advance_lines WHERE ${arFkCol} = ?`, [adv.id])
      for (const ln of lines) {
        let lac = await accCode(Number(ln.account_id))
        if (!lac.code && ln.account_code) {
          const byCode = await rawGet<any>('SELECT code, name FROM accounts WHERE code = ?', [ln.account_code])
          lac = byCode ? { code: byCode.code, name: byCode.name } : { code: ln.account_code, name: '' }
        }
        if (lac.code && Number(ln.amount||0) > 0) {
          entries.push({
            entry_date: adv.tdate,
            source_type: 'Uang Muka Customer',
            source_number: adv.kode_nota,
            description: 'uang muka customer',
            account_code: lac.code,
            account_name: lac.name,
            debit: Number(ln.amount || 0),
            credit: 0,
            created_at: adv.created_at || '',
          })
        }
      }
    }
  } catch {}

  // 9. Stock Usage
  try {
    const hppAcc = await accCode(map.hpp)
    const usages = await rawAll<any[]>(`
      SELECT u.id, u.number, u.tdate, u.notes, u.created_at
      FROM stock_usage u
      WHERE u.tdate >= ? AND u.tdate <= ?
        AND (u.void IS NULL OR u.void = 0)
        AND (u.status IS NULL OR u.status = 'approved')
      ORDER BY u.tdate, u.id
    `, [startDate, endDate])
    for (const u of usages) {
      try {
        const items = await rawAll<any[]>(`
          SELECT ui.qty_total, ui.cogs_total, b.account_id
          FROM stock_usage_items ui
          LEFT JOIN master_barang b ON b.id = ui.barang_id
          WHERE ui.usage_id = ?
        `, [u.id])
        let totalCogs = 0
        const invByAccount: Record<number, { id: number; total: number }> = {}
        for (const item of items) {
          const cogs = Math.abs(Number(item.cogs_total || 0))
          if (cogs <= 0) continue
          totalCogs += cogs
          const invId = item.account_id || map.persediaan_barang || 0
          if (!invId) continue
          invByAccount[invId] = invByAccount[invId] || { id: invId, total: 0 }
          invByAccount[invId].total += cogs
        }
        if (totalCogs <= 0) continue
        if (hppAcc.code) {
          entries.push({
            entry_date: u.tdate,
            source_type: 'Pemakaian Stok',
            source_number: u.number,
            description: 'pemakaian stok' + (u.notes ? ' - ' + u.notes : ''),
            account_code: hppAcc.code,
            account_name: hppAcc.name,
            debit: Math.round(totalCogs * 100) / 100,
            credit: 0,
            created_at: u.created_at || '',
          })
        }
        const invAccounts = Object.values(invByAccount)
        if (invAccounts.length > 0) {
          for (const ia of invAccounts) {
            const iaAcc = await accCode(ia.id)
            if (iaAcc.code) {
              entries.push({
                entry_date: u.tdate,
                source_type: 'Pemakaian Stok',
                source_number: u.number,
                description: 'pemakaian stok' + (u.notes ? ' - ' + u.notes : ''),
                account_code: iaAcc.code,
                account_name: iaAcc.name,
                debit: 0,
                credit: Math.round(ia.total * 100) / 100,
                created_at: u.created_at || '',
              })
            }
          }
        } else {
          const invAcc = await accCode(map.persediaan_barang)
          if (invAcc.code) {
            entries.push({
              entry_date: u.tdate,
              source_type: 'Pemakaian Stok',
              source_number: u.number,
              description: 'pemakaian stok' + (u.notes ? ' - ' + u.notes : ''),
              account_code: invAcc.code,
              account_name: invAcc.name,
              debit: 0,
              credit: Math.round(totalCogs * 100) / 100,
              created_at: u.created_at || '',
            })
          }
        }
      } catch (e2) { console.warn(`Section 9 usage #${u.id} error:`, e2) }
    }
  } catch (e) { console.warn('Section 9 (Stock Usage) error:', e) }

  // 10. Manufacturing
  try {
    const manufakturs = await rawAll<any[]>(`
      SELECT m.id, m.nomor, m.tanggal as tdate, m.total_biaya_bahan, m.total_biaya_lain, m.total_biaya,
             m.barang_id, m.barang_code, m.barang_name, m.quantity, m.created_at
      FROM manufaktur m
      WHERE m.tanggal >= ? AND m.tanggal <= ?
        AND m.status = 'approved'
      ORDER BY m.tanggal, m.id
    `, [startDate, endDate])
    for (const mf of manufakturs) {
      const totalBiaya = Number(mf.total_biaya || 0)
      if (totalBiaya <= 0) continue

      let fgInvId = map.persediaan_barang
      if (mf.barang_id) {
        const fgAcc = await rawGet<any>('SELECT account_id FROM master_barang WHERE id = ? AND account_id IS NOT NULL', [mf.barang_id])
        if (fgAcc?.account_id) fgInvId = Number(fgAcc.account_id)
      }
      const fgInvAcc = await accCode(fgInvId)

      if (fgInvAcc.code) {
        entries.push({
          entry_date: mf.tdate,
          source_type: 'Manufaktur',
          source_number: mf.nomor,
          description: 'manufaktur',
          account_code: fgInvAcc.code,
          account_name: fgInvAcc.name,
          debit: Math.round(totalBiaya * 100) / 100,
          credit: 0,
          created_at: mf.created_at || '',
        })
      }

      const items = await rawAll<any[]>(`
        SELECT md.barang_id, md.quantity, md.hpp_satuan, md.total_hpp,
               b.account_id as barang_account_id
        FROM manufaktur_detail md
        LEFT JOIN master_barang b ON b.id = md.barang_id
        WHERE md.manufaktur_id = ?
      `, [mf.id])
      const totalBiayaBahan = Number(mf.total_biaya_bahan || 0)
      const invByAccount: Record<number, { id: number; total: number }> = {}
      let missedCost = 0
      for (const item of items) {
        const cost = Number(item.total_hpp || item.hpp_satuan * item.quantity || 0)
        if (cost <= 0) continue
        const invId = item.barang_account_id || map.persediaan_barang || 0
        if (!invId) {
          missedCost += cost
          continue
        }
        invByAccount[invId] = invByAccount[invId] || { id: invId, total: 0 }
        invByAccount[invId].total += cost
      }
      if (missedCost > 0 && map.persediaan_barang) {
        invByAccount[map.persediaan_barang] = invByAccount[map.persediaan_barang] || { id: map.persediaan_barang, total: 0 }
        invByAccount[map.persediaan_barang].total += missedCost
      }
      const invAccounts = Object.values(invByAccount)
      if (invAccounts.length > 0) {
        for (const ia of invAccounts) {
          const iaAcc = await accCode(ia.id)
          if (iaAcc.code) {
            entries.push({
              entry_date: mf.tdate,
              source_type: 'Manufaktur',
              source_number: mf.nomor,
              description: 'manufaktur',
              account_code: iaAcc.code,
              account_name: iaAcc.name,
              debit: 0,
              credit: Math.round(ia.total * 100) / 100,
              created_at: mf.created_at || '',
            })
          }
        }
      } else if (totalBiayaBahan > 0) {
        const invAcc = await accCode(map.persediaan_barang)
        if (invAcc.code) {
          entries.push({
            entry_date: mf.tdate,
            source_type: 'Manufaktur',
            source_number: mf.nomor,
            description: 'manufaktur',
            account_code: invAcc.code,
            account_name: invAcc.name,
            debit: 0,
            credit: Math.round(totalBiayaBahan * 100) / 100,
            created_at: mf.created_at || '',
          })
        }
      }

      const biayas = await rawAll<any[]>('SELECT account_id, debit, credit FROM manufaktur_biaya WHERE manufaktur_id = ?', [mf.id])
      for (const b of biayas) {
        const amt = Number(b.debit || 0) - Number(b.credit || 0)
        if (amt <= 0 || !b.account_id) continue
        const bAcc = await accCode(Number(b.account_id))
        if (bAcc.code) {
          entries.push({
            entry_date: mf.tdate,
            source_type: 'Manufaktur',
            source_number: mf.nomor,
            description: 'manufaktur',
            account_code: bAcc.code,
            account_name: bAcc.name,
            debit: 0,
            credit: Math.round(amt * 100) / 100,
            created_at: mf.created_at || '',
          })
        }
      }
    }
  } catch (e) { console.warn('Section 10 (Manufaktur) error:', e) }

  // 11. Stock Opname
  try {
    const hppRow = await rawGet<any>(`
      SELECT a.code, a.name FROM account_mappings m
      JOIN accounts a ON a.id = m.account_id
      WHERE m.map_group = 'pelanggan' AND m.map_key = 'hpp'
    `)
    const defInvRow = await rawGet<any>(`
      SELECT a.code, a.name FROM account_mappings m
      JOIN accounts a ON a.id = m.account_id
      WHERE m.map_group = 'barang' AND m.map_key = 'persediaan_barang'
    `)
    if (hppRow?.code) {
      const opnames = await rawAll<any[]>(`
        SELECT so.id, so.number, so.tdate, so.created_at
        FROM stock_opname so
        WHERE so.tdate >= ? AND so.tdate <= ?
          AND so.status = 'posted'
          AND (so.void IS NULL OR so.void = 0)
        ORDER BY so.tdate, so.id
      `, [startDate, endDate])
      for (const o of opnames) {
        try {
          const items = await rawAll<any[]>(`
            SELECT soi.barang_id, soi.variance_qty, b.hpp, b.account_id, b.code, b.name
            FROM stock_opname_items soi
            LEFT JOIN master_barang b ON b.id = soi.barang_id
            WHERE soi.opname_id = ?
          `, [o.id])
          for (const it of items) {
            const variance = Number(it.variance_qty || 0)
            if (!variance) continue
            const hppPrice = Number(it.hpp || 0)
            if (hppPrice <= 0) continue
            const value = Math.round(Math.abs(variance) * hppPrice * 100) / 100
            if (value <= 0) continue
            let invCode = defInvRow?.code || ''
            let invName = defInvRow?.name || ''
            if (it.account_id) {
              const invAcc = await rawGet<any>('SELECT code, name FROM accounts WHERE id = ?', [it.account_id])
              if (invAcc?.code) { invCode = invAcc.code; invName = invAcc.name }
            }
            if (!invCode) continue
            const desc = `opname ${it.code || it.barang_id} selisih ${variance > 0 ? '+' : ''}${variance}`
            if (variance > 0) {
              entries.push({ entry_date: o.tdate, source_type: 'Stok Opname', source_number: o.number, description: desc, account_code: invCode, account_name: invName, debit: value, credit: 0, created_at: o.created_at || '' })
              entries.push({ entry_date: o.tdate, source_type: 'Stok Opname', source_number: o.number, description: desc, account_code: hppRow.code, account_name: hppRow.name, debit: 0, credit: value, created_at: o.created_at || '' })
            } else {
              entries.push({ entry_date: o.tdate, source_type: 'Stok Opname', source_number: o.number, description: desc, account_code: hppRow.code, account_name: hppRow.name, debit: value, credit: 0, created_at: o.created_at || '' })
              entries.push({ entry_date: o.tdate, source_type: 'Stok Opname', source_number: o.number, description: desc, account_code: invCode, account_name: invName, debit: 0, credit: value, created_at: o.created_at || '' })
            }
          }
        } catch (e2) { console.warn(`Section 11 opname #${o.id} error:`, e2) }
      }
    }
  } catch (e) { console.warn('Section 11 (Stock Opname) error:', e) }

  const toStr = (v: any) => typeof v === 'string' ? v : ''
  return entries.sort((a, b) => {
    const da = toStr(a.entry_date)
    const db = toStr(b.entry_date)
    if (da !== db) return da.localeCompare(db)
    const ca = toStr(a.created_at) || da
    const cb = toStr(b.created_at) || db
    return ca.localeCompare(cb)
  })
}
