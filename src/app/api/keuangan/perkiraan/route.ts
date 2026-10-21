import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { accounts } from '@/db/schema'
import { findAccountById, findAccountByCode, createAccount } from '@/lib/repositories/accountRepository'
import { hasPermission } from '@/lib/permissions'
import { getUserId } from '@/lib/audit'
import { rawGet } from '@/db/raw'
import { eq, and, ne, asc, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function normalizeBoolean(v: any, def = 0) {
  if (v === true || v === 1 || v === '1') return 1
  if (v === false || v === 0 || v === '0') return 0
  return def
}

function buildTree(rows: any[]) {
  const byId: Record<string, any> = {}
  const roots: any[] = []
  rows.forEach(r => { byId[r.id] = { ...r, children: [] } })
  rows.forEach(r => {
    const node = byId[r.id]
    if (r.parentId && byId[r.parentId]) byId[r.parentId].children.push(node)
    else roots.push(node)
  })
  return roots
}

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat perkiraan' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const isTree = searchParams.get('tree') === '1'
    const rows = await getDb().select().from(accounts).orderBy(asc(accounts.code))
    if (isTree) return NextResponse.json(buildTree(rows))
    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/keuangan/perkiraan error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat perkiraan' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const code = String(body.code || '').trim()
    const name = String(body.name || '').trim()
    const parent_id = body.parent_id ? Number(body.parent_id) : null
    const normal_balance = String(body.normal_balance || 'D').toUpperCase() === 'C' ? 'C' : 'D'
    const is_header = normalizeBoolean(body.is_header, 0)
    const is_active = normalizeBoolean(body.is_active, 1)
    const is_cash = normalizeBoolean(body.is_cash, 0)
    const is_bank_account = normalizeBoolean(body.is_bank_account, 0)
    const is_control_account = normalizeBoolean(body.is_control_account, 0)
    const posting_allowed = is_header ? 0 : normalizeBoolean(body.posting_allowed, 1)
    const currency = 'IDR'
    const golongan = body.golongan ? String(body.golongan).trim() : null

    if (!name) return NextResponse.json({ error: 'Nama akun wajib diisi' }, { status: 400 })

    let level = 1
    if (parent_id) {
      const parent = await findAccountById(parent_id)
      if (!parent) return NextResponse.json({ error: 'Parent tidak ditemukan' }, { status: 400 })
      level = Number(parent.level) + 1
      if (level > 4) return NextResponse.json({ error: 'Maksimal 4 level' }, { status: 400 })
    }

    const dup = await findAccountByCode(code)
    if (dup) return NextResponse.json({ error: 'Kode akun sudah digunakan' }, { status: 400 })

    const userId = getUserId(req)
    const created = await createAccount({
      code,
      name,
      parentId: parent_id,
      level,
      isHeader: is_header,
      normalBalance: normal_balance,
      isActive: is_active,
      isCash: is_cash,
      isBankAccount: is_bank_account,
      isControlAccount: is_control_account,
      postingAllowed: posting_allowed,
      golongan,
      userCreate: userId || null,
    })

    if (parent_id) {
      await getDb().update(accounts).set({ isHeader: 1, postingAllowed: 0, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(accounts.id, parent_id), eq(accounts.isHeader, 0)))
    }

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/keuangan/perkiraan error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create account' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah perkiraan' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await findAccountById(id)
    if (!existing) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })

    const code = body.code ? String(body.code).trim() : null
    if (code) {
      const dup = await getDb().select({ id: accounts.id }).from(accounts)
        .where(and(eq(accounts.code, code), ne(accounts.id, id))).then(r => r[0] ?? null)
      if (dup) return NextResponse.json({ error: 'Kode akun sudah digunakan' }, { status: 400 })
    }

    const name = typeof body.name === 'string' ? String(body.name).trim() : null
    const normal_balance = body.normal_balance ? (String(body.normal_balance).toUpperCase() === 'C' ? 'C' : 'D') : null
    const is_header = body.is_header !== undefined ? normalizeBoolean(body.is_header) : null
    const is_active = body.is_active !== undefined ? normalizeBoolean(body.is_active) : null
    const posting_allowed = body.posting_allowed !== undefined ? normalizeBoolean(body.posting_allowed) : null

    const parent_id = body.parent_id !== undefined ? (body.parent_id ? Number(body.parent_id) : null) : undefined
    let newLevel = Number(existing.level)
    if (parent_id !== undefined && parent_id !== (existing.parentId || null)) {
      if (parent_id !== null) {
        const parent = await findAccountById(parent_id)
        if (!parent) return NextResponse.json({ error: 'Parent tidak ditemukan' }, { status: 400 })
        if (Number(parent.id) === id) return NextResponse.json({ error: 'Tidak bisa menjadikan diri sendiri sebagai parent' }, { status: 400 })
        const db = getDb()
        const result = await db.execute(sql`
          WITH RECURSIVE descendants AS (
            SELECT id FROM accounts WHERE parent_id = ${id}
            UNION ALL
            SELECT a.id FROM accounts a JOIN descendants d ON a.parent_id = d.id
          )
          SELECT id FROM descendants
        `)
        const descendantIds = result.rows as any[]
        if (descendantIds.some(d => Number(d.id) === Number(parent_id))) {
          return NextResponse.json({ error: 'Tidak bisa menjadikan sub-akun sebagai parent (circular reference)' }, { status: 400 })
        }
        newLevel = Number(parent.level) + 1
        if (newLevel > 4) return NextResponse.json({ error: 'Maksimal 4 level' }, { status: 400 })
      } else {
        newLevel = 1
      }

      await getDb().update(accounts).set({ parentId: parent_id, level: newLevel, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(accounts.id, id))

      if (parent_id) {
        await getDb().update(accounts).set({ isHeader: 1, postingAllowed: 0, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(and(eq(accounts.id, parent_id), eq(accounts.isHeader, 0)))
      }
      const oldParentId = existing.parentId
      if (oldParentId && (!parent_id || Number(parent_id) !== Number(oldParentId))) {
        const remaining = await getDb().select({ id: accounts.id }).from(accounts)
          .where(and(eq(accounts.parentId, oldParentId), ne(accounts.id, id))).limit(1).then(r => r[0] ?? null)
        if (!remaining) {
          await getDb().update(accounts).set({ isHeader: 0, postingAllowed: 1, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(accounts.id, oldParentId))
        }
      }

      const levelDiff = newLevel - Number(existing.level)
      if (levelDiff !== 0) {
        await getDb().execute(sql`
          WITH RECURSIVE descendants AS (
            SELECT id FROM accounts WHERE parent_id = ${id}
            UNION ALL
            SELECT a.id FROM accounts a JOIN descendants d ON a.parent_id = d.id
          )
          UPDATE accounts SET level = level + ${levelDiff}, updated_at = CURRENT_TIMESTAMP
          WHERE id IN (SELECT id FROM descendants)
        `)
      }
    }

    const is_cash = body.is_cash !== undefined ? normalizeBoolean(body.is_cash) : null
    const is_bank_account = body.is_bank_account !== undefined ? normalizeBoolean(body.is_bank_account) : null
    const golongan = body.golongan !== undefined ? (body.golongan ? String(body.golongan).trim() : null) : undefined

    const updateData: Record<string, any> = {}
    if (code !== null) updateData.code = code
    if (name !== null) updateData.name = name
    if (normal_balance !== null) updateData.normalBalance = normal_balance
    if (is_header !== null) updateData.isHeader = is_header
    if (is_active !== null) updateData.isActive = is_active
    if (posting_allowed !== null) updateData.postingAllowed = posting_allowed
    if (is_cash !== null) updateData.isCash = is_cash
    if (is_bank_account !== null) updateData.isBankAccount = is_bank_account
    if (golongan !== undefined) updateData.golongan = golongan

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = sql`CURRENT_TIMESTAMP`
      updateData.userEdit = getUserId(req) || null
      await getDb().update(accounts).set(updateData).where(eq(accounts.id, id))
    }

    const updated = await findAccountById(id)
    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PUT /api/keuangan/perkiraan error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to update account' }, { status: 500 })
  }
}

const REFERENCE_CHECKS = [
  { table: 'account_mappings', label: 'Setting Perkiraan' },
  { table: 'memorial_journal_details', label: 'jurnal memorial' },
  { table: 'manufaktur_biaya', label: 'biaya manufaktur' },
  { table: 'ap_payment_methods', label: 'pembayaran hutang' },
  { table: 'ap_payment_extras', label: 'pembayaran hutang' },
  { table: 'master_banks', label: 'data bank' },
  { table: 'master_supplier', label: 'data supplier' },
  { table: 'master_customer', label: 'data pelanggan' },
  { table: 'master_barang', label: 'data barang' },
]

async function getReferenceLabel(id: number): Promise<string | null> {
  for (const { table, label } of REFERENCE_CHECKS) {
    try {
      const row = await rawGet<{ id: number }>(`SELECT 1 as id FROM ${table} WHERE account_id = ? LIMIT 1`, [id])
      if (row) return label
    } catch {
    }
  }
  return null
}

export async function DELETE(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'keu_perkiraan', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus perkiraan' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const exist = await findAccountById(id)
    if (!exist) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })

    const child = await getDb().select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.parentId, id)).limit(1).then(r => r[0] ?? null)
    if (child) return NextResponse.json({ error: 'Tidak bisa hapus akun yang memiliki sub-akun' }, { status: 400 })

    const refLabel = await getReferenceLabel(id)
    if (refLabel) {
      return NextResponse.json({ error: `Tidak bisa hapus akun ini karena masih digunakan di ${refLabel}. Hapus referensi terlebih dahulu.` }, { status: 400 })
    }

    const delAcct = await findAccountById(id)

    await getDb().delete(accounts).where(eq(accounts.id, id))

    if (delAcct?.parentId) {
      const remaining = await getDb().select({ id: accounts.id }).from(accounts)
        .where(eq(accounts.parentId, delAcct.parentId)).limit(1).then(r => r[0] ?? null)
      if (!remaining) {
        await getDb().update(accounts).set({ isHeader: 0, postingAllowed: 1, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(accounts.id, delAcct.parentId))
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/keuangan/perkiraan error:', e)
    const msg = String(e?.message || '')
    if (msg.includes('FOREIGN KEY') || msg.includes('SQLITE_CONSTRAINT')) {
      return NextResponse.json({ error: 'Tidak bisa hapus akun ini karena masih digunakan di data lain. Periksa Setting Perkiraan, data bank/supplier/pelanggan/barang, atau transaksi keuangan.' }, { status: 400 })
    }
    return NextResponse.json({ error: e?.message || 'Failed to delete account' }, { status: 500 })
  }
}
