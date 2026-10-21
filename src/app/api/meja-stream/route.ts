import { NextRequest } from 'next/server'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INT_FIELDS = ['id', 'floor_id', 'capacity', 'is_active', 'is_mergeable', 'is_smoking', 'isdelete', 'user_create', 'user_edit']

function normalizeRow(r: any) {
  if (!r) return r
  const o: any = {}
  for (const k of Object.keys(r)) {
    o[k] = INT_FIELDS.includes(k) ? Number(r[k]) : r[k]
  }
  return o
}

async function queryMeja(client: Client) {
  const result = await client.query(`
    SELECT m.*, f.name as floor_name, f.code as floor_code
    FROM master_meja m
    LEFT JOIN floors f ON f.id = m.floor_id
    WHERE COALESCE(m.isdelete,0)=0 AND COALESCE(m.is_active,1)=1
    ORDER BY COALESCE(f.level_no,0), f.id, m.id
  `)
  return result.rows.map(normalizeRow)
}

export async function GET(req: NextRequest) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()
  await client.query('LISTEN meja_changed')

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let notifyPending = false

      const send = async () => {
        if (closed) return
        try {
          const rows = await queryMeja(client)
          const msg = `data: ${JSON.stringify(rows)}\n\n`
          controller.enqueue(new TextEncoder().encode(msg))
        } catch {
          // connection lost
        }
      }

      const debouncedNotify = () => {
        if (!notifyPending) {
          notifyPending = true
          setImmediate(() => {
            notifyPending = false
            send()
          })
        }
      }

      send()

      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return }
        try { controller.enqueue(new TextEncoder().encode(': keepalive\n\n')) } catch { closed = true }
      }, 25000)

      client.on('notification', debouncedNotify)

      client.on('error', () => {
        closed = true
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(heartbeat)
        client.removeListener('notification', debouncedNotify)
        client.end().catch(() => {})
        try { controller.close() } catch {}
      })
    },
    cancel() {
      client.end().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
