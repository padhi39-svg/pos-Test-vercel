import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function readPrivateKeyPem(): string | null {
  // Priority 1: base64-encoded PEM via env
  const b64 = process.env.QZ_PRIVATE_KEY_BASE64
  if (b64) {
    try { return Buffer.from(b64, 'base64').toString('utf-8') } catch {}
  }
  // Priority 2: raw PEM via env
  const pem = process.env.QZ_PRIVATE_KEY
  if (pem && pem.includes('BEGIN')) return pem
  // Priority 3: local file (development fallback)
  const tryFiles = [
    path.join(process.cwd(), 'public', 'vendor', 'qz-tray', 'qz-private.pem'),
    path.join(process.cwd(), 'qz-private.pem'),
  ]
  for (const f of tryFiles) {
    try {
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8')
    } catch {}
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const toSign: string = body?.toSign || ''
    if (!toSign || typeof toSign !== 'string') {
      return NextResponse.json({ error: 'toSign is required' }, { status: 400 })
    }

    const privateKeyPem = readPrivateKeyPem()
    if (!privateKeyPem) {
      return NextResponse.json({ error: 'QZ private key not configured' }, { status: 500 })
    }

    const signer = crypto.createSign('sha256')
    signer.update(toSign)
    signer.end()
    const signature = signer.sign(privateKeyPem, 'base64')
    return NextResponse.json({ signature })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to sign', details: e?.message || String(e) }, { status: 500 })
  }
}
