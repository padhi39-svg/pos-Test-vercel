import { NextRequest, NextResponse } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

async function ensureTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      phone TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      pax INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      dp_amount REAL,
      dp_paid INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

const allowed = new Set(['confirm','check_in','complete','cancel','no_show'])

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(req as any, 'reservasi_booking', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah status reservasi' }, { status: 403 })
    }
    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json().catch(()=>({})) as any
    const action = String(body.action || '').toLowerCase()
    if (!allowed.has(action)) return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })

    await ensureTables()
    const resv = await rawGet<any>('SELECT * FROM reservations WHERE id=$1', [id])
    if (!resv) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

    const status: string = String(resv.status || 'pending')
    const nextStatus = (()=>{
      switch(action){
        case 'confirm':
          if (['pending'].includes(status)) return 'confirmed'
          break
        case 'check_in':
          if (['pending','confirmed'].includes(status)) return 'seated'
          break
        case 'complete':
          if (['seated','confirmed','pending'].includes(status)) return 'completed'
          break
        case 'cancel':
          if (!['completed','canceled','no_show'].includes(status)) return 'canceled'
          break
        case 'no_show':
          if (!['completed','canceled','no_show'].includes(status)) return 'no_show'
          break
      }
      return null
    })()

    if (!nextStatus) return NextResponse.json({ error: `Aksi ${action} tidak valid untuk status ${status}` }, { status: 400 })

    await rawRun('UPDATE reservations SET status=$1, created_at=created_at WHERE id=$2', [nextStatus, id])
    const updated = await rawGet<any>('SELECT * FROM reservations WHERE id=$1', [id])
    return NextResponse.json(updated)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Gagal menjalankan aksi' }, { status: 500 })
  }
}
