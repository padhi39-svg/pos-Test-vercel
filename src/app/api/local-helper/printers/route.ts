export async function GET() {
  const base = process.env.LOCAL_HELPER_BASE || 'http://127.0.0.1:27128'
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${base}/printers`, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) {
      return Response.json({ error: `Local Helper error (${res.status})` }, { status: 502 })
    }
    const data = await res.json().catch(() => ({}))
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: 'Tidak dapat terhubung ke Local Helper. Pastikan aplikasi helper berjalan dan tidak diblokir firewall.' }, { status: 502 })
  } finally {
    clearTimeout(t)
  }
}
