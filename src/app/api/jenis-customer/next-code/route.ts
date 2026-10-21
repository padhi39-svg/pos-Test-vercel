import { NextResponse } from 'next/server'
import { rawGet } from '@/db/raw'

export async function GET() {
  try {
    const last = await rawGet<any>(
      "SELECT code FROM master_jenis_customer WHERE code LIKE 'JNS/%' ORDER BY id DESC LIMIT 1"
    )
    let n = 0
    if (last?.code) {
      const m = /JNS\/(\d{6})$/.exec(last.code)
      if (m) n = parseInt(m[1], 10)
    }
    const next = (n + 1).toString().padStart(6, '0')
    return NextResponse.json({ code: `JNS/${next}` })
  } catch (e: any) {
    console.error('GET /api/jenis-customer/next-code error:', e)
    return NextResponse.json({ code: 'JNS/000001' })
  }
}
