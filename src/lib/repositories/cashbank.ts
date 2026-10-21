import { rawAll, rawGet } from '@/db/raw'

export async function getKartuKasBank(accountId?: string, startDate?: string, endDate?: string) {
  const accounts = await rawAll<any>(`SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE (is_cash = 1 OR is_bank_account = 1) AND is_active = 1 ORDER BY code`)

  if (!accountId) return { accounts }

  const entries: any[] = []

  let entryId = 0
  const cm = await rawAll<any>(`SELECT m.mutation_date as tgl, m.mutation_number as ref, COALESCE(m.notes, m.mutation_number) as deskripsi, m.mutation_type, m.total_amount as nominal, 'Mutasi Kas' as sumber FROM cash_mutations m WHERE m.cash_account_id = ? AND m.status = 'active' AND m.mutation_date >= ? AND m.mutation_date <= ? ORDER BY m.mutation_date, m.id`,
    [Number(accountId), startDate, endDate])
  for (const r of cm) entries.push({ id: ++entryId, tgl: r.tgl, ref: r.ref, deskripsi: r.deskripsi || r.ref, debet: r.mutation_type === 'MASUK' ? Number(r.nominal) : 0, kredit: r.mutation_type === 'KELUAR' ? Number(r.nominal) : 0, sumber: r.sumber })

  const ap = await rawAll<any>(`SELECT p.payment_date as tgl, p.payment_number as ref, COALESCE(p.notes, p.payment_number) as deskripsi, m.amount as nominal FROM ap_payment_methods m JOIN ap_payments p ON p.id = m.payment_id AND p.status = 'active' WHERE m.account_id = ? AND p.payment_date >= ? AND p.payment_date <= ? ORDER BY p.payment_date, p.id`,
    [Number(accountId), startDate, endDate])
  for (const r of ap) entries.push({ id: ++entryId, tgl: r.tgl, ref: r.ref, deskripsi: r.deskripsi || 'Pembayaran Hutang', debet: 0, kredit: Number(r.nominal), sumber: 'Bayar Hutang' })

  const ar = await rawAll<any>(`SELECT p.payment_date as tgl, p.payment_number as ref, COALESCE(p.notes, p.payment_number) as deskripsi, m.amount as nominal FROM ar_payment_methods m JOIN ar_payments p ON p.id = m.payment_id AND p.status = 'active' WHERE m.account_id = ? AND p.payment_date >= ? AND p.payment_date <= ? ORDER BY p.payment_date, p.id`,
    [Number(accountId), startDate, endDate])
  for (const r of ar) entries.push({ id: ++entryId, tgl: r.tgl, ref: r.ref, deskripsi: r.deskripsi || 'Penerimaan Piutang', debet: Number(r.nominal), kredit: 0, sumber: 'Terima Piutang' })

  const apAdv = await rawAll<any>(`SELECT a.tanggal as tgl, a.kode_nota as ref, COALESCE(a.notes, a.kode_nota) as deskripsi, COALESCE(l.amount, l.nominal) as nominal FROM ap_advance_lines l JOIN ap_advances a ON a.id = l.ap_advance_id AND (a.status = 'active' OR a.status IS NULL) WHERE l.account_id = ? AND a.tanggal >= ? AND a.tanggal <= ? ORDER BY a.tanggal, a.id`,
    [Number(accountId), startDate, endDate])
  for (const r of apAdv) entries.push({ id: ++entryId, tgl: r.tgl, ref: r.ref, deskripsi: r.deskripsi || 'Uang Muka Supplier', debet: 0, kredit: Number(r.nominal), sumber: 'Uang Muka Supplier' })

  const arAdv = await rawAll<any>(`SELECT a.tanggal as tgl, a.kode_nota as ref, COALESCE(a.notes, a.kode_nota) as deskripsi, COALESCE(l.amount, l.nominal) as nominal FROM ar_advance_lines l JOIN ar_advances a ON a.id = l.ar_advance_id AND (a.status = 'active' OR a.status IS NULL) WHERE l.account_id = ? AND a.tanggal >= ? AND a.tanggal <= ? ORDER BY a.tanggal, a.id`,
    [Number(accountId), startDate, endDate])
  for (const r of arAdv) entries.push({ id: ++entryId, tgl: r.tgl, ref: r.ref, deskripsi: r.deskripsi || 'Uang Muka Customer', debet: Number(r.nominal), kredit: 0, sumber: 'Uang Muka Customer' })

  const mj = await rawAll<any>(`SELECT j.journal_date as tgl, j.journal_number as ref, COALESCE(d.notes, j.notes, j.journal_number) as deskripsi, d.debit, d.credit FROM memorial_journal_details d JOIN memorial_journals j ON j.id = d.memorial_journal_id AND j.status = 'active' WHERE d.account_id = ? AND j.journal_date >= ? AND j.journal_date <= ? ORDER BY j.journal_date, j.id`,
    [Number(accountId), startDate, endDate])
  for (const r of mj) entries.push({ id: ++entryId, tgl: r.tgl, ref: r.ref, deskripsi: r.deskripsi || r.ref, debet: Number(r.debit || 0), kredit: Number(r.credit || 0), sumber: 'Jurnal Memorial' })

  const acct = await rawGet<any>('SELECT id, code, name, is_cash, is_bank_account FROM accounts WHERE id = ?', [Number(accountId)])
  entries.sort((a, b) => a.tgl.localeCompare(b.tgl) || a.id - b.id)

  let saldo = 0
  for (const e of entries) { saldo += e.debet - e.kredit; e.saldo = Math.round(saldo * 100) / 100 }

  return {
    account: acct, entries,
    total_debet: entries.reduce((s: number, e: any) => s + e.debet, 0),
    total_kredit: entries.reduce((s: number, e: any) => s + e.kredit, 0),
    saldo_akhir: Math.round(saldo * 100) / 100,
  }
}
