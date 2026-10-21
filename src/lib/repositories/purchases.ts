import { rawAll } from '@/db/raw'

export async function getPurchaseJatuhTempo() {
  const cols = await rawAll<any>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases' AND table_schema = 'public'"
  )
  const hasCol = (name: string) => cols.some(c => String(c.column_name).toLowerCase() === name.toLowerCase())
  const dueDateCol = hasCol('due_date') ? 'due_date' : hasCol('expected_date') ? 'expected_date' : null

  if (!dueDateCol) return []

  const sql = `
    SELECT
      p.id,
      p.purchase_number as kode_nota,
      COALESCE(s.name, 'Umum') as supplier,
      p.purchase_date as tanggal_nota,
      p.total,
      p.${dueDateCol} as jatuh_tempo
    FROM purchases p
    LEFT JOIN master_supplier s ON p.supplier_id = s.id
    WHERE p.${dueDateCol} IS NOT NULL
      AND p.${dueDateCol}::date <= CURRENT_DATE
      AND COALESCE(p.void, 0) = 0
      AND p.status = 'active'
      AND COALESCE(p.payment_status, '') NOT IN ('Lunas', 'paid', 'Paid')
    ORDER BY p.${dueDateCol}::date ASC, p.purchase_number ASC
  `
  return rawAll<any>(sql)
}
