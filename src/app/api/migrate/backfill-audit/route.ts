import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getUserId } from '@/lib/audit'

function todayYmd(): string { return new Date().toISOString().slice(0,10) }

async function hasCol(table:string, col:string){
  try{
    const cols = await rawAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?`, [table])
    return cols.some((c:any) => String(c.name).toLowerCase() === col.toLowerCase())
  }catch{ return false }
}

async function backfillStockOpname(ymd:string, uid:number, which:'create'|'edit'|'both'){
  const msgs:string[] = []
  if (!await hasCol('stock_opname','tdate')){ msgs.push('! stock_opname.tdate tidak ada'); return msgs }
  if (which==='create' || which==='both'){
    if (await hasCol('stock_opname','user_create')){
      const info = await rawRun(`UPDATE stock_opname SET user_create=? WHERE date(tdate)=date(?) AND (user_create IS NULL OR user_create=0)`, [uid, ymd])
      msgs.push(`✓ stock_opname.user_create backfilled: ${info.rowCount}`)
    } else msgs.push('! kolom stock_opname.user_create tidak ada')
  }
  if (which==='edit' || which==='both'){
    if (await hasCol('stock_opname','user_edit')){
      const info = await rawRun(`UPDATE stock_opname SET user_edit=? WHERE date(tdate)=date(?) AND (user_edit IS NULL OR user_edit=0)`, [uid, ymd])
      msgs.push(`✓ stock_opname.user_edit backfilled: ${info.rowCount}`)
    } else msgs.push('! kolom stock_opname.user_edit tidak ada')
  }
  return msgs
}

async function handle(req: NextRequest){
  const url = new URL(req.url)
  const table = (url.searchParams.get('table') || 'stock_opname').toLowerCase()
  const scope = (url.searchParams.get('which') || 'create').toLowerCase() as 'create'|'edit'|'both'
  const date = url.searchParams.get('date') || todayYmd()
  const qpUid = Number(url.searchParams.get('user_id') || '')
  const uid = Number.isFinite(qpUid) && qpUid>0 ? qpUid : getUserId(req)
  if (!uid) return NextResponse.json({ ok:false, error: 'user_id tidak ditemukan (set cookie x-user-id atau kirim ?user_id=...)' }, { status: 400 })

  const messages:string[] = []
  try{
    if (table==='stock_opname'){
      messages.push(...await backfillStockOpname(date, uid, scope))
    } else {
      return NextResponse.json({ ok:false, error: `table ${table} belum didukung` }, { status: 400 })
    }
    return NextResponse.json({ ok:true, table, date, user_id: uid, messages })
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || 'Gagal backfill audit' }, { status: 500 })
  }
}

export async function GET(req: NextRequest){ return handle(req) }
export async function POST(req: NextRequest){ return handle(req) }
