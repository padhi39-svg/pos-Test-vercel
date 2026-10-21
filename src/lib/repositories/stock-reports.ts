import { rawAll } from '@/db/raw'

export async function getInventoryValuation(endDate?: string, warehouseId?: number | null) {
  const ed = (endDate || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const params: any[] = [ed]
  let whClause = ''
  if (warehouseId !== null && warehouseId !== undefined) {
    whClause = 'AND l.warehouse_id = ?'
    params.push(warehouseId)
  }
  const rows = await rawAll<any>(`
    WITH mv AS (
      SELECT sm.*, COALESCE(sm.transaction_date::text, sm.created_at::text) AS tx_date
      FROM stock_movements sm
    ), latest AS (
      SELECT m.* FROM mv m
      JOIN (SELECT ingredient_id, warehouse_id, MAX(tx_date) AS max_date FROM mv WHERE DATE(tx_date) <= DATE(?::date) GROUP BY ingredient_id, warehouse_id) t
      ON t.ingredient_id = m.ingredient_id AND t.warehouse_id = m.warehouse_id AND t.max_date = m.tx_date
    )
    SELECT l.ingredient_id AS barang_id, l.warehouse_id,
      b.code AS barang_code, b.name AS barang_name, b.jenis AS barang_jenis,
      COALESCE(l.balance_qty, 0) AS quantity, COALESCE(l.balance_avg_cost, 0) AS avg_cost,
      COALESCE(l.balance_cost, COALESCE(l.balance_qty,0) * COALESCE(l.balance_avg_cost,0)) AS value
    FROM latest l JOIN master_barang b ON b.id = l.ingredient_id
    WHERE b.jenis IN (1,2,3) ${whClause}
    ORDER BY b.name ASC
  `, params)

  let totalQuantity = 0; let totalValue = 0
  for (const r of rows) { totalQuantity += Number(r.quantity) || 0; totalValue += Number(r.value) || 0 }
  return { endDate: ed, warehouseId, count: rows.length, totalQuantity, totalValue, items: rows }
}

export async function getKonversiStok(
  tanggalAwal?: string, tanggalAkhir?: string, barangId?: number | null, gudangId?: number | null, status?: string
) {
  const whereParts: string[] = []
  const params: any[] = []
  if (tanggalAwal) { whereParts.push('m.tanggal >= ?'); params.push(tanggalAwal) }
  if (tanggalAkhir) { whereParts.push('m.tanggal <= ?'); params.push(tanggalAkhir) }
  if (barangId) { whereParts.push('m.barang_id = ?'); params.push(barangId) }
  if (gudangId) { whereParts.push('m.warehouse_id = ?'); params.push(gudangId) }
  if (status) { whereParts.push('m.status = ?'); params.push(status) }
  const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : ''

  const rows = await rawAll<any>(`
    SELECT m.id, m.nomor, m.tanggal, m.barang_id, m.barang_code, m.barang_name, m.quantity, m.status, m.notes,
      m.warehouse_id, g.code AS gudang_code, g.name AS gudang_name,
      m.hpp_sebelum, m.hpp_sesudah, m.total_biaya_bahan, m.total_biaya_lain, m.total_biaya,
      m.user_create, u.name AS user_name, m.created_at, m.approved_at,
      (SELECT COUNT(*) FROM manufaktur_detail md WHERE md.manufaktur_id = m.id) AS jumlah_komponen
    FROM manufaktur m
    LEFT JOIN master_gudang g ON g.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.user_create
    ${whereClause}
    ORDER BY m.tanggal DESC, m.nomor DESC
  `, params)
  return rows
}

export async function getKonversiStokMeta() {
  const barangHasil = await rawAll<any>(`SELECT DISTINCT m.barang_id AS id, m.barang_code AS code, m.barang_name AS name FROM manufaktur m ORDER BY m.barang_name ASC`)
  const warehouses = await rawAll<any>(`SELECT id, code, name FROM master_gudang WHERE COALESCE(isdelete,0)=0 ORDER BY code ASC`)
  return { barangHasil, warehouses }
}
