// Client-side helper for QZ Tray integration
// Provides utilities to load qz-tray.js, connect, list printers, and test print

'use client'

let qzLoaded: Promise<any> | null = null

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(s)
  })
}

export async function loadQZ(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('QZ can only be used in the browser')
  if ((window as any).qz) return (window as any).qz
  if (!qzLoaded) {
    // Try multiple sources for qz-tray.js to avoid CDN blocking
    const sources = [
      // Local first (if you place file under web/public/vendor/qz-tray/qz-tray.min.js)
      '/vendor/qz-tray/qz-tray.min.js',
      // CDNs
      'https://cdnjs.cloudflare.com/ajax/libs/qz-tray/2.2.7/qz-tray.min.js',
      'https://cdn.jsdelivr.net/npm/qz-tray@2.2.7/qz-tray.min.js',
      'https://unpkg.com/qz-tray@2.2.7/qz-tray.min.js',
      // Older client version fallbacks (compatible with QZ Tray 2.2.x)
      'https://cdnjs.cloudflare.com/ajax/libs/qz-tray/2.2.5/qz-tray.min.js',
      'https://cdn.jsdelivr.net/npm/qz-tray@2.2.5/qz-tray.min.js',
      'https://unpkg.com/qz-tray@2.2.5/qz-tray.min.js',
    ]
    qzLoaded = (async () => {
      let lastErr: any = null
      for (const src of sources) {
        try { await injectScript(src); break } catch (e) { lastErr = e }
      }
      if (!(window as any).qz) throw new Error('Tidak bisa memuat qz-tray.js. Detail: ' + (lastErr?.message || lastErr))
      return (window as any).qz
    })()
  }
  await qzLoaded
  const qz = (window as any).qz

  if (!qz?.security) return qz

  const qzs = qz as any
  // Try to load a real certificate from public folder
  if (qzs.security?.setCertificatePromise) {
    qzs.security.setCertificatePromise((resolve: any, reject: any) => {
      fetch('/vendor/qz-tray/qz-public.crt').then(r => {
        if (!r.ok) throw new Error('public cert not found')
        return r.text()
      }).then(txt => resolve(txt)).catch(async () => {
        // Fallback to demo cert (akan memunculkan prompt allow). Disarankan ganti dengan sertifikat asli.
        const DEMO_CERT = `-----BEGIN CERTIFICATE-----\nMIIDWjCCAkKgAwIBAgIJAJ/uH8Xo0hJ6MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAlVTMQ8wDQYDVQQIDAZOZXZhZGExEDAOBgNVBAcMB0hlbmRlcnNvbjEQMA4G\nA1UEAwwHUXogVHJheTAeFw0xNzA2MjAxOTU0NTNaFw0yNzA2MTgxOTU0NTNaMEUx\nCzAJBgNVBAYTAlVTMQ8wDQYDVQQIDAZOZXZhZGExEDAOBgNVBAcMB0hlbmRlcnNv\nbjEQMA4GA1UEAwwHUXogVHJheTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\nggEBAMJr9mRkT2u5nBv3Jq9D7FJCgYs+t2LQvU1BzvKf1G1k8yKZwQYqf8kV9ZJr\n5cD5Gd8xVh3cZ0p2H4c2I2kZtC8yS6g4T0r3jD1rVxXcLQqGg1w8Rvj6nYwK8v1o\nJeYsmkqWq3aJQw4r0q3i7dwjZr4wTq+q8j6kz6qv2kZ5J6q5V5w2q9MXcQEiV6n2\nQZQH1n6Xgn8QkZ5s1U8PK8c7bZ1cv6n4q4jVsvz6Jm1oKkZpLz9l3tY+WwOkmHLq\n0bX5Z1F0pQk9r2d8oXf2C2O0Q0x8PjV2zR0l6g8jMTQ5w4nZgM5iJ6g9r3W0sQKj\nq8lGmQ40Go7Kk0k7H5w3f/4nWg8dD6ECAwEAAaNQME4wHQYDVR0OBBYEFAk0Jp7H\nGu7sEo1XkiwzP3mG9b3wMB8GA1UdIwQYMBaAFAk0Jp7HGu7sEo1XkiwzP3mG9b3w\nMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAD7m3wQWnZ8xg+EudxG2\n4s2mKJ0nq8X6GEX4R7m0h5VtH2c+Xb4fGQ8LQ2N8e0s2mP9bG1Qj0yKpXH1+3aQm\nYxFZ2WbZQbQd6o4TQ2F8ZVw6bOeVn1B7qv3GvO3z2+X1qf9qH5nJ2LxD8w9m3n4G\n5uQ5FqQ3mCk2u9J4qgYg0+oPp2sJzq9f3e8j9p5yQJ6xZ2m6Wq8YbG8e1U+F9vM8\nzqQd1kqzjz1Vv3MZ5cN2s0w+fZ2u6XfP7m0VhVxk8Yg3z4zJxG4XwZ1r3JQ6YpQ+\nWcU3Q9pOqIu0x8QbF2s4Wz1h4lG6c8tGqO3J9D4o9fY/7p9vJHqYzA3xgH8=\n-----END CERTIFICATE-----`
        resolve(DEMO_CERT)
      })
    })
  }
  if (qzs.security?.setSignaturePromise) {
    qzs.security.setSignaturePromise((toSign: string) => new Promise(async (resolve, reject) => {
      try {
        const res = await fetch('/api/qz/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toSign }) })
        if (!res.ok) throw new Error('sign api failed')
        const data = await res.json().catch(() => null)
        const signature = (data && data.signature) ? data.signature : await res.text()
        resolve(signature)
      } catch (e) {
        console.warn('QZ sign error, falling back to unsigned (may prompt):', e)
        resolve(null)
      }
    }))
  }

  return qz
}

export async function ensureQZConnected(): Promise<any> {
  const qz = await loadQZ()
  if (qz.websocket.isActive()) return qz
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const attempts: any[] = [
    undefined,
    { host: '127.0.0.1', port: 8182, usingSecure: secure },
    { host: 'localhost', port: 8182, usingSecure: secure },
  ]
  let lastErr: any = null
  for (const opts of attempts) {
    try {
      if (opts) await qz.websocket.connect(opts)
      else await qz.websocket.connect()
      return qz
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error('Gagal konek ke QZ Tray. Pastikan QZ Tray berjalan dan izinkan koneksi pada prompt QZ. Detail: ' + (lastErr?.message || lastErr))
}

export async function listPrinters(): Promise<string[]> {
  const qz = await ensureQZConnected()
  try {
    // QZ Tray 2.2.x exposes printers.find() to list all printers
    const names = await qz.printers.find()
    return Array.isArray(names) ? names : []
  } catch (e) {
    console.warn('qz.printers.find failed:', e)
    return []
  }
}

export async function getDefaultPrinter(): Promise<string | null> {
  const qz = await ensureQZConnected()
  try { return await qz.printers.getDefault() } catch { return null }
}

export async function testPrintRaw(printer: string, text: string, cut: boolean) {
  const qz = await ensureQZConnected()
  const cfg = qz.configs.create(printer)
  const data: any[] = ["\x1B@", text + "\n\n"]
  if (cut) data.push("\x1DVA0") // full cut
  await qz.print(cfg, data)
}

export async function getQZVersion(): Promise<string | null> {
  const qz = await ensureQZConnected()
  try {
    const v = await qz.api.getVersion()
    return String(v)
  } catch {
    return null
  }
}
