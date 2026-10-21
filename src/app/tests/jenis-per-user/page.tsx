"use client"

import { useEffect, useState } from 'react'

type TestResult = { name: string; status: 'pending'|'ok'|'fail'; detail?: string }

async function getCurrentUserId(): Promise<number|null> {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!r.ok) return null
    const d = await r.json()
    return Number(d?.id) || null
  } catch { return null }
}

async function getUserDetail(id: number) {
  const r = await fetch(`/api/users/${id}`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error('get user failed')
  return await r.json()
}

async function setAllowedJenis(id: number, allowedJenis: number[]) {
  const r = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name: undefined, level_id: 1, aktif: true, allowedJenis })
  })
  // Note: name/level will be validated; to avoid changes, we fetch current first
}

async function setAllowedJenisSafe(id: number, allowedJenis: number[]) {
  const cur = await getUserDetail(id)
  const payload: any = {
    name: cur?.name,
    level_id: cur?.level_id,
    aktif: cur?.aktif !== 0,
    email: cur?.email,
    allowedJenis,
  }
  const r = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  })
  if (!r.ok) throw new Error('update allowedJenis failed')
}

async function fetchBarangJenis(): Promise<number[]> {
  const r = await fetch('/api/barang', { credentials: 'same-origin' })
  if (!r.ok) throw new Error('fetch barang failed')
  const arr = await r.json()
  return Array.isArray(arr) ? arr.map((x:any)=> Number(x?.jenis)).filter((n:number)=>!Number.isNaN(n)) : []
}

export default function Page(){
  const [results, setResults] = useState<TestResult[]>([
    { name: 'Get current user', status: 'pending' },
    { name: 'Backup allowedJenis', status: 'pending' },
    { name: 'Set allowedJenis = [1]', status: 'pending' },
    { name: 'Verify only jenis 1 returned', status: 'pending' },
    { name: 'Set allowedJenis = [2]', status: 'pending' },
    { name: 'Verify only jenis 2 returned', status: 'pending' },
    { name: 'Set allowedJenis = [1,3]', status: 'pending' },
    { name: 'Verify only jenis 1 or 3 returned', status: 'pending' },
    { name: 'Restore allowedJenis', status: 'pending' },
  ])
  const [done, setDone] = useState(false)

  useEffect(()=>{
    let alive = true
    ;(async () => {
      try {
        // Step 1: get user
        const uid = await getCurrentUserId()
        if (!uid) throw new Error('No current user')
        if (!alive) return
        setResults(r => r.map((it, i) => i===0? { ...it, status: 'ok' }: it))

        // Step 2: backup current allowedJenis
        const before = await getUserDetail(uid)
        const backup: number[] = Array.isArray(before?.allowedJenis) ? before.allowedJenis : [1,2,3]
        if (!alive) return
        setResults(r => r.map((it, i) => i===1? { ...it, status: 'ok', detail: JSON.stringify(backup) }: it))

        // Helper verify
        const verify = async (expected: number[], idxSet: number, idxVerify: number) => {
          await setAllowedJenisSafe(uid, expected)
          setResults(r => r.map((it, i) => i===idxSet? { ...it, status: 'ok' }: it))
          const list = await fetchBarangJenis()
          const ok = list.length === 0 || list.every(j => expected.includes(j))
          setResults(r => r.map((it, i) => i===idxVerify? { ...it, status: ok ? 'ok':'fail', detail: `got: ${JSON.stringify(list)}` }: it))
          if (!ok) throw new Error(`Unexpected jenis: ${JSON.stringify(list)}`)
        }

        await verify([1], 2, 3)
        await verify([2], 4, 5)
        await verify([1,3], 6, 7)

        // Restore
        await setAllowedJenisSafe(uid, backup)
        setResults(r => r.map((it, i) => i===8? { ...it, status: 'ok' }: it))
        setDone(true)
      } catch (e: any) {
        if (!alive) return
        setDone(true)
        setResults(r => {
          const firstPending = r.findIndex(x => x.status==='pending')
          if (firstPending>=0) r[firstPending] = { ...r[firstPending], status: 'fail', detail: e?.message || String(e) }
          return [...r]
        })
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-3">Self Test: Filter Jenis per User</h1>
      <ol className="space-y-2 list-decimal ml-6">
        {results.map((r, idx) => (
          <li key={idx} className="text-sm">
            <span className={`font-medium ${r.status==='ok' ? 'text-emerald-600' : r.status==='fail' ? 'text-red-600' : 'text-slate-600'}`}>{r.name} — {r.status.toUpperCase()}</span>
            {r.detail && <div className="text-[12px] text-slate-500">{r.detail}</div>}
          </li>
        ))}
      </ol>
      {done && <div className="mt-3 text-xs text-slate-600">Selesai. Tutup halaman ini, konfigurasi user telah dipulihkan.</div>}
    </div>
  )
}
