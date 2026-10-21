import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: Request) {
  try {
    if (!hasPermission(req as any, 'settings', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat daftar backup' }, { status: 403 })
    }
    const backupsDir = path.join(process.cwd(), 'data', 'backups')
    if (!fs.existsSync(backupsDir)) {
      return NextResponse.json({ backups: [] })
    }

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.sql'))
      .map(name => {
        const p = path.join(backupsDir, name)
        const s = fs.statSync(p)
        return {
          name,
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
        }
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

    return NextResponse.json({ backups: files })
  } catch (e: any) {
    console.error('Backup list error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to list backups' }, { status: 500 })
  }
}
