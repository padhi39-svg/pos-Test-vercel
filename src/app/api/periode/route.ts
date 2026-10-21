import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { masterPeriode } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    if (!hasPermission(req as any, 'periode', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat periode' }, { status: 403 })
    }
    const db = getDb()
    
    const periode = await db.select({
      id: masterPeriode.id,
      code: masterPeriode.code,
      name: masterPeriode.name,
      startDate: masterPeriode.startDate,
      endDate: masterPeriode.endDate,
      isActive: masterPeriode.isActive,
      statusBuku: masterPeriode.statusBuku,
      isdelete: masterPeriode.isdelete,
      createdAt: masterPeriode.createdAt,
      updatedAt: masterPeriode.updatedAt,
    })
      .from(masterPeriode)
      .where(eq(masterPeriode.isdelete, 0))
      .orderBy(desc(masterPeriode.startDate))
    
    return NextResponse.json(periode)
  } catch (error) {
    console.error('Error fetching periode:', error)
    return NextResponse.json({ error: 'Failed to fetch periode' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasPermission(request as any, 'periode', 'create')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses membuat periode' }, { status: 403 })
    }
    const data = await request.json()
    const db = getDb()
    
    // Format data
    const code = formatCode(data.code ?? '') || ''
    const name = formatName(data.name ?? '') || ''
    const startDate = String(data.startDate ?? '')
    const endDate = String(data.endDate ?? '')
    const isActive = Boolean(data.isActive)
    
    // Validate required fields
    if (!code || !name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Code, name, start date, and end date are required' }, { status: 400 })
    }
    
    // Validate date format and logic
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }
    
    // Check for duplicate code
    const existingArr = await db.select({ id: masterPeriode.id })
      .from(masterPeriode)
      .where(and(eq(masterPeriode.code, code), eq(masterPeriode.isdelete, 0)))
      .limit(1)
    const existing = existingArr[0]
    if (existing) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 400 })
    }
    
    // Run inside transaction
    const newPeriode = await db.transaction(async (tx) => {
      // If setting as active, deactivate others
      if (isActive) {
        await tx.update(masterPeriode)
          .set({ isActive: 0 })
          .where(eq(masterPeriode.isdelete, 0))
      }
      // Insert new periode
      const userId = getUserId(request)
      const [inserted] = await tx.insert(masterPeriode).values({
        code,
        name,
        startDate,
        endDate,
        isActive: isActive ? 1 : 0,
        statusBuku: 'OPEN',
        userCreate: userId,
        createdAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).returning()
      
      return inserted
    })
    
    return NextResponse.json(newPeriode)
  } catch (error) {
    console.error('Error creating periode:', error)
    const message = (error as any)?.message || 'Failed to create periode'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
