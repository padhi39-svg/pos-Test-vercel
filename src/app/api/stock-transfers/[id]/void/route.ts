import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { addAuditColumns, getUserId } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }){
  const id = Number(params.id)
  try{
    const pool = (getDb() as any).$client
    addAuditColumns(pool)
    const userId = getUserId(req)
    const header = await rawGet<any>('SELECT * FROM stock_transfers WHERE id=$1', [id])
    if (!header) return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    if (Number(header.void||0) === 1) return NextResponse.json({ error: 'Dokumen sudah void' }, { status: 400 })

    await pool.query('BEGIN')
    try {
      const items = await rawAll<any>('SELECT * FROM stock_transfer_items WHERE transfer_id=$1', [id])
      for (const it of items){
        const b = Number(it.barang_id)
        const q = Number(it.qty)
        const src = await rawGet<any>('SELECT qty FROM stock_balance_by_warehouse WHERE barang_id=$1 AND warehouse_id=$2', [b, header.from_warehouse_id])
        const srcNext = Number(src?.qty || 0) + q
        if (src) await rawRun('UPDATE stock_balance_by_warehouse SET qty=$1 WHERE barang_id=$2 AND warehouse_id=$3', [srcNext, b, header.from_warehouse_id])
        else await rawRun('INSERT INTO stock_balance_by_warehouse(barang_id, warehouse_id, qty) VALUES($1,$2,$3)', [b, header.from_warehouse_id, srcNext])

        const dst = await rawGet<any>('SELECT qty FROM stock_balance_by_warehouse WHERE barang_id=$1 AND warehouse_id=$2', [b, header.to_warehouse_id])
        const dstNext = Number(dst?.qty || 0) - q
        if (dst) await rawRun('UPDATE stock_balance_by_warehouse SET qty=$1 WHERE barang_id=$2 AND warehouse_id=$3', [dstNext, b, header.to_warehouse_id])
        else await rawRun('INSERT INTO stock_balance_by_warehouse(barang_id, warehouse_id, qty) VALUES($1,$2,$3)', [b, header.to_warehouse_id, Math.max(0, dstNext)])
      }
      await rawRun('DELETE FROM stock_movements WHERE reference=$1', [header.number])
      const cols = await rawAll<any>("SELECT column_name as name FROM information_schema.columns WHERE table_name='stock_transfers'")
      const has = (n:string)=> cols.some((c: any) => String(c.name).toLowerCase()===n)
      const hasUserVoid = has('user_void')
      const hasUpdatedAt = has('updated_at')
      if (hasUserVoid && hasUpdatedAt){
        await rawRun('UPDATE stock_transfers SET void=1, user_void=$1, updated_at=NOW() WHERE id=$2', [userId || null, id])
      } else if (hasUserVoid){
        await rawRun('UPDATE stock_transfers SET void=1, user_void=$1 WHERE id=$2', [userId || null, id])
      } else if (hasUpdatedAt){
        await rawRun('UPDATE stock_transfers SET void=1, updated_at=NOW() WHERE id=$1', [id])
      } else {
        await rawRun('UPDATE stock_transfers SET void=1 WHERE id=$1', [id])
      }
      await pool.query('COMMIT')
      return NextResponse.json({ ok: true })
    } catch (e: any) {
      await pool.query('ROLLBACK')
      throw e
    }
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'Gagal melakukan void' }, { status: 500 })
  }
}
