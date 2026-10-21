import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'
import { getDb } from '@/db'

export async function GET(req: NextRequest) {
  try {
    const db = getDb(); const pool = (db as any).$client
    await pool.query(`
      CREATE TABLE IF NOT EXISTS barang_units (
        id SERIAL PRIMARY KEY,
        barang_id INTEGER,
        unit_name TEXT,
        unit_ratio REAL DEFAULT 1
      );
    `)
    const cols = await rawAll(`SELECT column_name as name FROM information_schema.columns WHERE table_name = 'barang_units' AND table_schema = 'public'`) as any[]
    const has = (n:string)=> cols.some(c=> String(c.name).toLowerCase()===n)
    const unitNameCol = has('unit_name') ? 'unit_name' : (has('name') ? 'name' : (has('unit') ? 'unit' : 'unit_name'))
    const unitRatioCol = has('unit_ratio') ? 'unit_ratio' : (has('ratio') ? 'ratio' : 'unit_ratio')
    const { searchParams } = new URL(req.url)
    const barangId = Number(searchParams.get('barang_id') || 0)
    const sql = `SELECT id, barang_id, ${unitNameCol} as unit_name, COALESCE(${unitRatioCol},1) as unit_ratio FROM barang_units`
    const rows = barangId
      ? await rawAll(`${sql} WHERE barang_id=? ORDER BY CASE WHEN COALESCE(${unitRatioCol},1)=1 THEN 0 ELSE 1 END, id`, [barangId])
      : await rawAll(`${sql} ORDER BY barang_id, CASE WHEN COALESCE(${unitRatioCol},1)=1 THEN 0 ELSE 1 END, id`)
    return NextResponse.json({ rows })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Failed to get units' }, { status: 500 })
  }
}
