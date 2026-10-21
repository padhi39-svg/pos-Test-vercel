import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { settings as settingsTable, transactions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { hasPermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'generate_faktur_pajak', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { invoice_ids } = body
    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ error: 'invoice_ids array required' }, { status: 400 })
    }

    const db = getDb()

    const settingRows = await db.select({
      settingKey: settingsTable.settingKey,
      settingValue: settingsTable.settingValue,
    })
      .from(settingsTable)
      .where(eq(settingsTable.settingGroup, 'faktur_pajak'))

    const map: Record<string, string> = {}
    for (const r of settingRows) {
      map[r.settingKey] = r.settingValue || ''
    }

    const prefix = map.faktur_pajak_prefix || '010.000-24.'
    const padding = parseInt(map.faktur_pajak_padding || '5', 10)
    let nextNum = parseInt(map.faktur_pajak_next_number || '1', 10)

    const results: { id: number; nomor: string }[] = []

    await db.transaction(async (tx) => {
      for (const id of invoice_ids) {
        const padded = String(nextNum).padStart(padding, '0')
        const nomor = `${prefix}${padded}`

        await tx.update(transactions)
          .set({ fakturPajak: nomor })
          .where(eq(transactions.id, id))

        results.push({ id, nomor })
        nextNum++
      }

      await tx.update(settingsTable)
        .set({ settingValue: String(nextNum), updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(settingsTable.settingKey, 'faktur_pajak_next_number'))
    })

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
