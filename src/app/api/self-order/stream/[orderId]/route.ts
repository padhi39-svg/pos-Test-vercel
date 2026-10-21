import { NextRequest } from 'next/server'
import { rawGet, rawRun } from '@/db/raw'
import { isMidtransConfigured, checkQrisStatus } from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

/**
 * SSE endpoint to stream payment status updates.
 * Client connects via EventSource, server polls DB and pushes status changes.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  if (!orderId) {
    return new Response('orderId required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let pollCount = 0
      const MAX_POLLS = 100 // ~5 minutes at 3s interval

      const sendEvent = (data: Record<string, any>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      const cleanup = () => {
        closed = true
      }

      // Handle client disconnect
      req.signal.addEventListener('abort', cleanup)

      // Send initial connected event
      sendEvent({ type: 'connected', orderId })

      // Poll for payment status
      const poll = async () => {
        if (closed || pollCount >= MAX_POLLS) {
          sendEvent({ type: 'timeout' })
          try { controller.close() } catch {}
          return
        }

        pollCount++

        try {
          // Check local DB status
          const localOrder = await rawGet(
            `SELECT payment_status FROM self_orders WHERE uid = $1`,
            [orderId]
          )

          if (localOrder?.payment_status === 'paid') {
            sendEvent({ type: 'paid', orderId })
            try { controller.close() } catch {}
            return
          }

          if (localOrder?.payment_status === 'cancelled') {
            sendEvent({ type: 'failed', status: 'cancelled', orderId })
            try { controller.close() } catch {}
            return
          }

          // If Midtrans is configured, also check their status
          if (isMidtransConfigured()) {
            const result = await checkQrisStatus(orderId)

            if (result.success && result.status) {
              const isPaid = result.status === 'settlement' || result.status === 'capture'
              const isFailed = result.status === 'expire' || result.status === 'deny'

              if (isPaid) {
                await rawRun(
                  `UPDATE self_orders SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE uid = $1`,
                  [orderId]
                )
                sendEvent({ type: 'paid', orderId })
                try { controller.close() } catch {}
                return
              }

              if (isFailed) {
                await rawRun(
                  `UPDATE self_orders SET payment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE uid = $1`,
                  [orderId]
                )
                sendEvent({ type: 'failed', status: result.status, orderId })
                try { controller.close() } catch {}
                return
              }
            }
          }

          sendEvent({ type: 'pending', status: localOrder?.payment_status || 'unpaid', pollCount })
        } catch (e: any) {
          sendEvent({ type: 'error', message: e?.message || 'Poll error' })
        }

        // Schedule next poll
        if (!closed) {
          setTimeout(poll, 3000)
        }
      }

      // Start polling
      poll()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
