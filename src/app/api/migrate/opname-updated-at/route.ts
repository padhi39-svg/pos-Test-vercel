import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function run() {
  const db = getDb()
  const messages: string[] = []
  const ensureCol = async (table:string, col:string, type:string)=>{
    try{
      const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?`, [table])
      const has = (n:string)=> cols.some((c:any)=> String(c.name).toLowerCase()===n)
      if (!has(col)){
        await rawRun(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
        messages.push(`✓ Added ${table}.${col}`)
      } else {
        messages.push(`• ${table}.${col} exists`)
      }
    }catch(e:any){ messages.push(`! Failed ${table}.${col}: ${e?.message}`) }
  }
  await ensureCol('stock_opname','updated_at','TEXT')
  await ensureCol('stock_opname_items','updated_at','TEXT')
  await ensureCol('stock_opname','user_edit','INTEGER')
  return { ok:true, messages }
}

export async function GET(_req: NextRequest){
  const r = await run(); return NextResponse.json(r, { status: r.ok?200:500 })
}
export async function POST(_req: NextRequest){
  const r = await run(); return NextResponse.json(r, { status: r.ok?200:500 })
}
