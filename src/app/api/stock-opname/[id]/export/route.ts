import { NextRequest } from 'next/server'
import { rawAll, rawGet } from '@/db/raw'
import { addAuditColumns } from '@/lib/audit'

async function getLatestCounts(db: any, opnameId: number){
  try{
    const rows = await rawAll<any[]>(`
      WITH latest AS (
        SELECT MAX(id) AS max_id
        FROM stock_opname_counts
        WHERE opname_id = ?
        GROUP BY barang_id
      )
      SELECT b.code AS kode, c.qty_base
      FROM latest l
      JOIN stock_opname_counts c ON c.id = l.max_id
      LEFT JOIN master_barang b ON b.id = c.barang_id
      ORDER BY b.code
    `, [opnameId])
    return rows
  }catch{
    const rows = await rawAll<any[]>(`
      SELECT mb.code AS kode, c1.qty_base
      FROM stock_opname_counts c1
      LEFT JOIN master_barang mb ON mb.id = c1.barang_id
      WHERE c1.opname_id = ?
        AND c1.id = (
          SELECT MAX(c2.id)
          FROM stock_opname_counts c2
          WHERE c2.opname_id = c1.opname_id AND c2.barang_id = c1.barang_id
        )
      ORDER BY mb.code
    `, [opnameId])
    return rows
  }
}

function sanitizeFileName(name: string){
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }){
  const id = Number(params.id)
  if (!Number.isFinite(id) || id<=0){
    return new Response(JSON.stringify({ error: 'Dokumen tidak valid' }), { status: 400 })
  }
  await addAuditColumns()

  const hdr = await rawGet<any>('SELECT number, status, void FROM stock_opname WHERE id=?', [id])
  if (!hdr) return new Response(JSON.stringify({ error: 'Dokumen tidak ditemukan' }), { status: 404 })
  const stStr = String(hdr.status)
  const stNum = Number(hdr.status)
  const isApproved = stStr==='approved' || stNum===1
  if (!isApproved){
    return new Response(JSON.stringify({ error: 'Dokumen belum approved' }), { status: 400 })
  }
  if (Number(hdr.void)===1){
    return new Response(JSON.stringify({ error: 'Dokumen void tidak dapat diexport' }), { status: 400 })
  }

  const rows = await getLatestCounts(null, id)

  try{
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Opname')
    ws.columns = [
      { header: 'Kode Barang', key: 'kode', width: 24 },
      { header: 'Qty (Base)', key: 'qty_base', width: 16 },
    ]
    for (const r of rows){
      ws.addRow({ kode: r.kode || '', qty_base: Number(r.qty_base || 0) })
    }
    ws.getRow(1).font = { bold: true }
    const buf = await wb.xlsx.writeBuffer()
    const number: string = hdr.number || `Opname-${id}`
    const fileName = sanitizeFileName(`Opname ${number}.xlsx`)
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      }
    })
  }catch(e:any){
    return new Response(JSON.stringify({ error: 'Fitur export XLSX membutuhkan dependensi exceljs. Silakan install paket exceljs.' }), { status: 500 })
  }
}
