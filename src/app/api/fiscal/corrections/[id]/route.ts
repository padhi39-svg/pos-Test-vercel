import { NextRequest, NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'
import { hasPermission } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { account_code, account_name, amount, type } = body
    if (!account_name) return NextResponse.json({ error: 'account_name required' }, { status: 400 })
    if (type && !['positif', 'negatif'].includes(type)) {
      return NextResponse.json({ error: 'type must be positif or negatif' }, { status: 400 })
    }
    const sets: string[] = []
    const vals: any[] = []
    if (account_code !== undefined) { sets.push('account_code = ?'); vals.push(account_code) }
    if (account_name !== undefined) { sets.push('account_name = ?'); vals.push(account_name) }
    if (amount !== undefined) { sets.push('amount = ?'); vals.push(amount) }
    if (type !== undefined) { sets.push('type = ?'); vals.push(type) }
    sets.push("updated_at = NOW()")
    vals.push(id)
    await rawRun(`UPDATE fiscal_corrections SET ${sets.join(', ')} WHERE id = ?`, vals)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasPermission(req as any, 'keu_rekonsiliasi_fiskal', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    await rawRun('DELETE FROM fiscal_corrections WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
