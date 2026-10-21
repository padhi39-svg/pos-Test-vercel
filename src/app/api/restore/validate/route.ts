import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { getDb } from '@/db'
import { hasPermission } from '@/lib/permissions'

export async function POST(req: Request) {
  try {
    if (!hasPermission(req as any, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses memvalidasi restore' }, { status: 403 })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const arrayBuf = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuf)

    // Only accept .sql files
    const content = buf.toString('utf8')
    const isSql = file.name.endsWith('.sql') || content.startsWith('--')

    if (!isSql) {
      return NextResponse.json({
        error: 'Format file tidak didukung. Gunakan file .sql (plain text backup).'
      }, { status: 400 })
    }

    const dataDir = path.join(process.cwd(), 'data')
    const restoreDir = path.join(dataDir, 'restore')
    if (!fs.existsSync(restoreDir)) fs.mkdirSync(restoreDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const tempName = `restore-upload-${timestamp}.sql`
    const tempPath = path.join(restoreDir, tempName)
    fs.writeFileSync(tempPath, buf)

    // Parse INSERT INTO statements from SQL file
    const tableMatches = content.matchAll(/INSERT\s+INTO\s+"?(\w+)"?\s/gmi)
    const tableSet = new Set<string>()
    for (const m of tableMatches) {
      tableSet.add(m[1])
    }
    const detectedTables = Array.from(tableSet).sort()

    // Get current live schema info
    const pool = (getDb() as any).$client
    let liveTables: string[] = []
    try {
      const liveTablesResult = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      )
      liveTables = liveTablesResult.rows.map((r: any) => r.table_name)
    } catch { }

    const uploadedTables = new Set(detectedTables.map(t => t.toLowerCase()))
    const liveTableSet = new Set(liveTables.map((t: string) => t.toLowerCase()))
    const missingTables: string[] = liveTables.filter((t: string) => !uploadedTables.has(t.toLowerCase()))
    const extraTables: string[] = detectedTables.filter(t => !liveTableSet.has(t.toLowerCase()))

    return NextResponse.json({
      success: true,
      tempFile: tempName,
      integrity: 'sql',
      tables: detectedTables,
      size: buf.length,
      schemaDiff: { missingTables, extraTables, perTable: [] },
    })
  } catch (e: any) {
    console.error('Restore validate error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to validate restore file' }, { status: 500 })
  }
}
