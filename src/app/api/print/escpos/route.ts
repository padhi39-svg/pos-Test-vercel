import { NextRequest, NextResponse } from 'next/server'
import net from 'net'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text: string = String(body?.text ?? '')
    const host: string = String(body?.host ?? '')
    const port: number = Number(body?.port ?? 9100)
    const cut: boolean = Boolean(body?.cut ?? true)

    if (!host || !port || !text) {
      return NextResponse.json({ error: 'text, host, port are required' }, { status: 400 })
    }

    const init = Buffer.from([0x1b, 0x40]) // ESC @
    const boldOn = Buffer.from([0x1b, 0x45, 0x01]) // ESC E 1 (bold on)
    const content = Buffer.from(text.replace(/\n/g, '\n'), 'utf8')
    const boldOff = Buffer.from([0x1b, 0x45, 0x00]) // ESC E 0 (bold off)
    const feed = Buffer.from('\n\n', 'utf8')
    const cutCmd = cut ? Buffer.from([0x1d, 0x56, 0x00]) : Buffer.alloc(0) // GS V 0 (full cut)
    const payload = Buffer.concat([init, boldOn, content, boldOff, feed, cutCmd])

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()
      const timeoutMs = 10000
      const onFail = (err: any) => {
        try { socket.destroy() } catch {}
        const code = (err?.code || '').toString()
        if (code === 'ETIMEDOUT') reject(new Error(`Printer connection timeout (${host}:${port})`))
        else if (code === 'ECONNREFUSED') reject(new Error(`Printer refused connection (${host}:${port})`))
        else if (code === 'EHOSTUNREACH') reject(new Error(`Printer host unreachable (${host})`))
        else if (code === 'ENETUNREACH') reject(new Error(`Network unreachable to printer (${host})`))
        else reject(new Error(err?.message || `Failed to connect to printer (${host}:${port})`))
      }

      const timer = setTimeout(() => onFail({ code: 'ETIMEDOUT' }), timeoutMs)
      socket.setTimeout(timeoutMs, () => onFail({ code: 'ETIMEDOUT' }))
      socket.once('error', (err) => { clearTimeout(timer); onFail(err) })

      socket.connect(port, host, () => {
        socket.write(payload, (err) => {
          clearTimeout(timer)
          if (err) {
            onFail(err)
            return
          }
          socket.end(() => resolve())
        })
      })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to print', details: e?.message || String(e) }, { status: 500 })
  }
}
