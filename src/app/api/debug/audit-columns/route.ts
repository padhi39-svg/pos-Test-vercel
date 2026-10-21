import { NextRequest, NextResponse } from 'next/server'
import { rawAll } from '@/db/raw'

export async function GET(_req: NextRequest){
  const tables = ['stock_opname','stock_usage','stock_transfers']
  const result: Record<string, any> = {}
  for (const t of tables){
    try{
      const cols = await rawAll<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`
      )
      const names = cols.map(c => String(c.column_name))
      result[t] = {
        columns: names,
        has_user_create: names.some(n => n.toLowerCase()==='user_create'),
        has_user_edit: names.some(n => n.toLowerCase()==='user_edit'),
        has_period_id: names.some(n => n.toLowerCase()==='period_id'),
      }
    }catch(e:any){
      result[t] = { error: e?.message || 'failed to read table' }
    }
  }
  try{
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements'"
    )
    const names = cols.map(c => String(c.column_name))
    result['stock_movements'] = {
      columns: names,
      has_period_id: names.some(n => n.toLowerCase()==='period_id'),
    }
  }catch(e:any){
    result['stock_movements'] = { error: e?.message || 'failed to read table' }
  }
  return NextResponse.json(result)
}
