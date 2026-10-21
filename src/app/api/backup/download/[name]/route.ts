import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { hasPermission } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: { name: string }}) {
  try {
    if (!hasPermission(_req as any, 'settings', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses download backup' }, { status: 403 })
    }
    const name = decodeURIComponent(params.name)
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }

    const backupsDir = path.join(process.cwd(), 'data', 'backups')
    const filePath = path.join(backupsDir, name)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const data = fs.readFileSync(filePath)
    return new NextResponse(data, {
      status: 200,
      headers: new Headers({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`
      })
    })
  } catch (e: any) {
    console.error('Backup download error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to download backup' }, { status: 500 })
  }
}
