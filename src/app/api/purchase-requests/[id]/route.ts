import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'po', 'view') && !hasPermission(request, 'transaksi', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensurePurchaseRequestTables()
    const id = Number(params.id)
    const head = await rawGet<any>('SELECT * FROM purchase_requests WHERE id = $1', [id])
    if (!head) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const items = await rawAll<any>('SELECT * FROM purchase_request_items WHERE request_id = $1 ORDER BY id ASC', [id])
    return NextResponse.json({ ...head, items })
  } catch (e: any) {
    console.error('GET /api/purchase-requests/[id] error:', e)
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request, 'po', 'edit') && !hasPermission(request, 'transaksi', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensurePurchaseRequestTables()
    const id = Number(params.id)
    const body = await request.json().catch(() => ({}))

    if (body?.void === 1 || body?.void === true) {
      await rawRun('UPDATE purchase_requests SET void = 1, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['void', id])
      return NextResponse.json({ id, message: 'Pengajuan di-void' })
    }

    const fields: string[] = []
    const args: any[] = []
    let pidx = 0
    if (body.request_date) { pidx++; fields.push(`request_date = $${pidx}`); args.push(String(body.request_date).slice(0,10)) }
    if (body.expected_date) { pidx++; fields.push(`expected_date = $${pidx}`); args.push(String(body.expected_date).slice(0,10)) }
    if (body.requester_name != null) { pidx++; fields.push(`requester_name = $${pidx}`); args.push(String(body.requester_name)) }
    if (body.notes != null) { pidx++; fields.push(`notes = $${pidx}`); args.push(String(body.notes)) }
    if (body.status) { pidx++; fields.push(`status = $${pidx}`); args.push(String(body.status)) }
    if (fields.length) {
      pidx++; const sql = `UPDATE purchase_requests SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${pidx}`
      await rawRun(sql, [...args, id])
    }

    if (Array.isArray(body.items)) {
      await rawRun('DELETE FROM purchase_request_items WHERE request_id = $1', [id])
      for (const it of body.items) {
        const qty = Number(it.quantity ?? it.qty) || 0
        await rawRun(`
          INSERT INTO purchase_request_items (
            request_id, barang_id, barang_code, barang_name, quantity, unit_name, unit_ratio, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          id,
          it.barangId ?? it.barang_id ?? null,
          it.barangCode ?? it.barang_code ?? it.code ?? '',
          it.barangName ?? it.barang_name ?? it.name ?? '',
          qty,
          it.unitName ?? it.unit_name ?? 'PCS',
          Number(it.unitRatio ?? it.unit_ratio) || 1,
          it.notes ?? it.note ?? null,
        ])
      }
    }

    return NextResponse.json({ id, message: 'Pengajuan berhasil diperbarui' })
  } catch (e: any) {
    console.error('PUT /api/purchase-requests/[id] error:', e)
    return NextResponse.json({ error: 'Gagal memperbarui pengajuan' }, { status: 500 })
  }
}
