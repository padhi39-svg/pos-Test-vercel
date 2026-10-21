export async function POST(req: Request) {
  const base = process.env.LOCAL_HELPER_BASE || 'http://127.0.0.1:27128'
  let payload: any = {}
  try { payload = await req.json().catch(()=>({})) } catch {}
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    })
    const text = await res.text().catch(()=> '')
    if (!res.ok) return new Response(text || 'Local Helper error', { status: 502 })
    return new Response(text || 'OK', { status: 200 })
  } catch (e:any) {
    return Response.json({ error: 'Tidak dapat mengirim ke Local Helper. Pastikan aplikasi helper berjalan dan tidak diblokir firewall.' }, { status: 502 })
  } finally {
    clearTimeout(t)
  }
}
