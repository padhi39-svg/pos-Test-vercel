import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { getPeriodByDate } from '@/lib/period'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

async function ensurePurchaseRequestTables() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id SERIAL PRIMARY KEY,
      request_number TEXT UNIQUE,
      request_date TEXT,
      expected_date TEXT,
      period_id INTEGER,
      requester_id INTEGER,
      requester_name TEXT,
      notes TEXT,
      status TEXT DEFAULT 'draft',
      void INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS purchase_request_items (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL,
      barang_id INTEGER,
      barang_code TEXT,
      barang_name TEXT,
      quantity REAL DEFAULT 0,
      unit_name TEXT,
      unit_ratio REAL DEFAULT 1,
      notes TEXT,
      FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
    );
  `)
}

export async function GET(request: NextRequest) {
  try {
    if (!hasPermission(request, 'purchase_request', 'view') && !hasPermission(request, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat pengajuan pembelian' }, { status: 403 })
    }
    await ensurePurchaseRequestTables()

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const status = (searchParams.get('status') || '').trim().toLowerCase()

    const where: string[] = []
    const args: any[] = []
    let paramIdx = 0
    if (q) {
      paramIdx++; where.push(`(pr.request_number LIKE $${paramIdx} OR COALESCE(pr.requester_name, '') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM purchase_request_items pri WHERE pri.request_id = pr.id AND (pri.barang_code LIKE $${paramIdx} OR pri.barang_name LIKE $${paramIdx})))`)
      args.push(`%${q}%`)
    }
    if (status === 'draft') where.push("pr.status = 'draft' AND pr.void = 0")
    else if (status === 'approved') where.push("pr.status = 'approved' AND pr.void = 0")
    if (status === 'void') where.push('pr.void = 1')

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await rawAll<any>(`
      SELECT pr.*,
        (SELECT COUNT(1) FROM purchase_request_items i WHERE i.request_id = pr.id) AS items_count
      FROM purchase_requests pr
      ${whereSql}
      ORDER BY pr.created_at DESC
    `, args)

    const list = []
    for (const r of rows) {
      const items = await rawAll<any>('SELECT * FROM purchase_request_items WHERE request_id = $1 ORDER BY id ASC', [r.id])
      list.push({ ...r, items })
    }

    return NextResponse.json(list)
  } catch (e: any) {
    console.error('GET /api/purchase-requests error:', e)
    return NextResponse.json({ error: 'Gagal mengambil pengajuan pembelian' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request, 'purchase_request', 'create') && !hasPermission(request, 'transaksi', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat pengajuan pembelian' }, { status: 403 })
    }
    await ensurePurchaseRequestTables()

    const data = await request.json()
    const requestDate = (data.requestDate || new Date().toISOString()).slice(0, 10)

    const year = new Date(requestDate).getFullYear()
    const last = await rawGet<any>(`SELECT request_number FROM purchase_requests WHERE request_number LIKE $1 ORDER BY request_number DESC LIMIT 1`, [`PR/${year}/%`])
    let seq = 1
    if (last) {
      const parts = String(last.request_number).split('/')
      const lastSeq = parseInt(parts[2] || '0')
      seq = (isNaN(lastSeq) ? 0 : lastSeq) + 1
    }
    const requestNumber = `PR/${year}/${seq.toString().padStart(6, '0')}`

    let periodId: number | null = null
    try { const p = await rawGet<any>(`SELECT id FROM master_periode WHERE $1::date BETWEEN start_date::date AND end_date::date AND isdelete=0 LIMIT 1`, [requestDate]); periodId = p?.id ?? null } catch {}
    if (!periodId) {
      return NextResponse.json({ error: `Tidak ada periode aktif untuk tanggal ${requestDate}. Buat periode terlebih dahulu.` }, { status: 400 })
    }

    const userId = getUserId(request)
    const requesterName = data.requesterName ?? null

    const pool = (getDb() as any).$client
    const res = await pool.query(`
      INSERT INTO purchase_requests (
        request_number, request_date, expected_date, period_id,
        requester_id, requester_name, notes, status, void,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [
      requestNumber,
      requestDate,
      data.expectedDate ?? null,
      periodId,
      userId || null,
      requesterName,
      data.notes ?? null,
    ])
    const reqId = Number(res.rows[0].id)

    const items = Array.isArray(data.items) ? data.items : []

    for (const it of items) {
      const qty = Number(it.quantity ?? it.qty) || 0
      await rawRun(`
        INSERT INTO purchase_request_items (
          request_id, barang_id, barang_code, barang_name, quantity, unit_name, unit_ratio, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        reqId,
        it.barangId ?? it.barang_id ?? null,
        it.barangCode ?? it.barang_code ?? it.code ?? '',
        it.barangName ?? it.barang_name ?? it.name ?? '',
        qty,
        it.unitName ?? it.unit_name ?? 'PCS',
        Number(it.unitRatio ?? it.unit_ratio) || 1,
        it.notes ?? it.note ?? null,
      ])
    }

    return NextResponse.json({ id: reqId, requestNumber, message: 'Pengajuan Pembelian berhasil dibuat' })
  } catch (e: any) {
    console.error('POST /api/purchase-requests error:', e)
    return NextResponse.json({ error: e.message || 'Gagal membuat pengajuan pembelian' }, { status: 500 })
  }
}
