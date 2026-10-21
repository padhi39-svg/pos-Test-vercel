import { NextRequest, NextResponse } from 'next/server'
import { getTodayDate } from '@/lib/date-utils'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { addAuditColumns, getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getPeriodByDate } from '@/lib/period'
import { generateEntriesForSingleSource, saveJournalEntriesForSource } from '@/lib/journalHelpers'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'manufaktur', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || ''
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
    const offset = (page - 1) * limit

    const whereParts: string[] = []
    const params: any[] = []

    if (search) {
      whereParts.push('(m.nomor LIKE ? OR m.barang_code LIKE ? OR m.barang_name LIKE ? OR m.notes LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like, like)
    }
    if (status) {
      whereParts.push('m.status = ?')
      params.push(status)
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    const countRow = await rawGet(`SELECT COUNT(*) as total FROM manufaktur m ${whereClause}`, params.length > 0 ? params : undefined) as any
    const total = countRow?.total || 0

    const rows = await rawAll(`
      SELECT m.*, b.code as barang_code_join, b.name as barang_name_join, b.jenis as barang_jenis,
             g.name as gudang_name
      FROM manufaktur m
      LEFT JOIN master_barang b ON b.id = m.barang_id
      LEFT JOIN master_gudang g ON g.id = m.warehouse_id
      ${whereClause}
      ORDER BY m.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]) as any[]

    const data = rows.map((r: any) => ({
      ...r,
      barang_code: r.barang_code_join || r.barang_code,
      barang_name: r.barang_name_join || r.barang_name,
    }))

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'manufaktur', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getDb(); const pool = (db as any).$client
    addAuditColumns(db)
    const userId = getUserId(request)

    const body = await request.json()

    const barangId = Number(body.barang_id) || 0
    if (!barangId) return NextResponse.json({ error: 'barang_id wajib diisi' }, { status: 400 })

    const barang = await rawGet(`SELECT id, code, name, jenis, hpp FROM master_barang WHERE id = ?`, [barangId]) as any
    if (!barang) return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 400 })
    if (Number(barang.jenis) !== 1 && Number(barang.jenis) !== 3) {
      return NextResponse.json({ error: 'Barang harus berjenis Barang Jadi (1) atau Barang Setengah Jadi (3)' }, { status: 400 })
    }

    const quantity = Number(body.quantity) || 0
    if (quantity <= 0) return NextResponse.json({ error: 'quantity harus > 0' }, { status: 400 })

    const details = Array.isArray(body.details) ? body.details : []
    if (details.length === 0) return NextResponse.json({ error: 'Minimal 1 detail item' }, { status: 400 })

    for (const d of details) {
      const dBarang = await rawGet(`SELECT id, code, name, jenis FROM master_barang WHERE id = ?`, [Number(d.barang_id)]) as any
      if (!dBarang) return NextResponse.json({ error: `Detail barang ID ${d.barang_id} tidak ditemukan` }, { status: 400 })
      if (Number(dBarang.jenis) !== 2 && Number(dBarang.jenis) !== 3) {
        return NextResponse.json({ error: `Barang ${dBarang.name} harus berjenis Bahan Baku (2) atau Barang Setengah Jadi (3)` }, { status: 400 })
      }
      if (Number(d.quantity) <= 0) {
        return NextResponse.json({ error: `Quantity detail barang ${dBarang.name} harus > 0` }, { status: 400 })
      }
    }

    const biayaList = Array.isArray(body.biaya) ? body.biaya : []

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `MF/${year}/`
    const last = await rawGet(`SELECT nomor FROM manufaktur WHERE nomor LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]) as any
    let seq = 1
    if (last?.nomor) {
      const parts = String(last.nomor).split('/')
      const lastSeq = parseInt(parts[2] || '0', 10)
      seq = isNaN(lastSeq) ? 1 : lastSeq + 1
    }
    const nomor = `${prefix}${String(seq).padStart(6, '0')}`

    const getTodayLocal = () => getTodayDate()
    const tanggal = body.tanggal ? String(body.tanggal).slice(0, 10) : getTodayLocal()
    if (tanggal < getTodayLocal() && !hasPermission(request as any, 'manufaktur', 'backdate')) {
      return NextResponse.json({ error: 'Tidak diizinkan input tanggal mundur' }, { status: 403 })
    }
    const period = await getPeriodByDate(tanggal)
    if (!period) {
      return NextResponse.json({ error: `Periode belum ada untuk tanggal ${tanggal}` }, { status: 400 })
    }
    const hppSebelum = Number(barang.hpp) || 0

    let totalBiayaBahan = 0
    for (const d of details) {
      const hppSatuan = Number(d.hpp_satuan) || 0
      const qty = Number(d.quantity) || 0
      totalBiayaBahan += hppSatuan * qty
    }

    let totalBiayaLain = 0
    for (const b of biayaList) {
      totalBiayaLain += (Number(b.debit) || 0) - (Number(b.credit) || 0)
    }

    const totalBiaya = totalBiayaBahan + totalBiayaLain

    const warehouseId = Number(body.warehouse_id) || 1
    const notes = body.notes || null

    const result = await pool.query(`
      INSERT INTO manufaktur (nomor, tanggal, barang_id, barang_code, barang_name,
        quantity, status, notes, warehouse_id,
        hpp_sebelum, total_biaya_bahan, total_biaya_lain, total_biaya,
        user_create, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [
      nomor, tanggal, barang.id, barang.code, barang.name,
      quantity, notes, warehouseId,
      hppSebelum, totalBiayaBahan, totalBiayaLain, totalBiaya,
      userId || null,
    ])

    const manufakturId = Number(result.rows[0].id)

    for (const d of details) {
      const dBarang = await rawGet(`SELECT id, code, name FROM master_barang WHERE id = ?`, [Number(d.barang_id)]) as any
      const hppSatuan = Number(d.hpp_satuan) || 0
      const qty = Number(d.quantity) || 0
      await rawRun(`
        INSERT INTO manufaktur_detail (manufaktur_id, barang_id, barang_code, barang_name, quantity, hpp_satuan, total_hpp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [manufakturId, dBarang.id, dBarang.code, dBarang.name, qty, hppSatuan, hppSatuan * qty])
    }

    if (biayaList.length > 0) {
      for (const b of biayaList) {
        const acctId = b.account_id ? Number(b.account_id) : null
        let acctCode = b.account_code || null
        let acctName = b.account_name || null
        if (acctId && (!acctCode || !acctName)) {
          const found = await rawGet(`SELECT code, name FROM accounts WHERE id = ?`, [acctId]) as any
          if (found) {
            acctCode = found.code
            acctName = found.name
          }
        }
        const rawDebit = Number(b.debit) || 0
        const rawCredit = Number(b.credit) || 0
        const amt = rawDebit - rawCredit
        await rawRun(`
          INSERT INTO manufaktur_biaya (manufaktur_id, account_id, account_code, account_name, notes, debit, credit)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          manufakturId,
          acctId,
          acctCode,
          acctName,
          b.notes || null,
          amt > 0 ? amt : 0,
          amt < 0 ? Math.abs(amt) : 0,
        ])
      }
    }

    try {
      const mfEntries = await generateEntriesForSingleSource('Manufaktur', nomor, tanggal)
      if (mfEntries.length > 0) {
        await saveJournalEntriesForSource('Manufaktur', manufakturId, nomor, tanggal, mfEntries)
      }
    } catch (e) {
      console.warn('[Manufaktur] failed to save journal entries:', e)
    }

    return NextResponse.json({
      success: true,
      id: manufakturId,
      nomor,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
