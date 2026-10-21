import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { hasPermission } from '@/lib/permissions'

export async function DELETE(req: Request, { params }: { params: { name: string } }) {
  try {
    if (process.env.VERCEL) {
      return NextResponse.json({ error: 'Hapus backup lokal tidak tersedia di Vercel' }, { status: 503 })
    }
    if (!hasPermission(req as any, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus backup' }, { status: 403 })
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

    fs.unlinkSync(filePath)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Backup delete error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to delete backup' }, { status: 500 })
  }
}
