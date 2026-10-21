import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

async function run(){
  const db = getDb()
  const messages: string[] = []
  try{
    const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'stock_opname'`)
    const has = (n:string)=> cols.some((c:any)=> String(c.name).toLowerCase()===n)
    if (!has('void')){
      try{ await rawRun('ALTER TABLE stock_opname ADD COLUMN void INTEGER DEFAULT 0'); messages.push('✓ Added stock_opname.void') }catch(e:any){ messages.push('! Failed add void: '+(e?.message||'')) }
    }else{
      messages.push('• stock_opname.void already exists')
    }
    // Backfill from status='void'
    try{ const info = await rawRun(`UPDATE stock_opname SET void=1 WHERE LOWER(COALESCE(status,''))='void' AND (void IS NULL OR void=0)`); messages.push(`✓ Backfilled void from status: ${info.rowCount}`)}catch(e:any){ messages.push('! Failed backfill: '+(e?.message||'')) }
    return NextResponse.json({ ok:true, messages })
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'migration failed', messages })
  }
}

export async function GET(_req: NextRequest){ return run() }
export async function POST(_req: NextRequest){ return run() }
