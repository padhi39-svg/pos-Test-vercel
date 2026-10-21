import { NextRequest } from 'next/server'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function queryOpenTemps(client: Client) {
  const result = await client.query(`
    SELECT id, table_id, customer_id, customer_name, waiter_id, waiter_name,
           guest_count, void, status, notes,
           TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at,
           TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as updated_at
    FROM resto_temp_orders
    WHERE (status = 'open' OR status = 'bill') AND (void IS NULL OR void = 0)
    ORDER BY created_at DESC
  `)
  return result.rows
}

export async function GET(req: NextRequest) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()
  await client.query('LISTEN resto_temp_changed')

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let notifyPending = false

      const send = async () => {
        if (closed) return
        try {
          const rows = await queryOpenTemps(client)
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
