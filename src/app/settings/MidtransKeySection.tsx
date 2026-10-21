"use client"

import { useEffect, useState } from "react"

export default function MidtransKeySection() {
  const [hasKey, setHasKey] = useState(false)
  const [masked, setMasked] = useState<string | null>(null)
  const [serverKey, setServerKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/self-order/midtrans-key")
        if (res.ok) {
          const data = await res.json()
          setHasKey(data.hasKey)
          setMasked(data.masked)
        }
      } catch {} finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    if (!serverKey.trim()) {
      alert("Server key tidak boleh kosong")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/self-order/midtrans-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverKey: serverKey.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setHasKey(true)
        setMasked(data.masked)
        setServerKey("")
        alert("✓ Server key berhasil disimpan dan dienkripsi")
      } else {
        alert(data.error || "Gagal menyimpan")
      }
    } catch {
      alert("Gagal menyimpan server key")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="border rounded-lg p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">💳 Midtrans Server Key</h3>
        <p className="text-xs text-slate-500">Kunci server Midtrans untuk pembayaran QRIS</p>
      </div>

      {hasKey && masked && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Key saat ini</p>
              <p className="text-sm font-mono text-slate-700">{masked}</p>
            </div>
            <span className="text-xs text-emerald-600 font-medium">✓ Tersimpan</span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {hasKey ? "Ganti Server Key" : "Server Key"}
        </label>
        <input
          type="password"
          value={serverKey}
          onChange={(e) => setServerKey(e.target.value)}
          placeholder={hasKey ? "Masukkan key baru untuk mengganti" : "SB-Mid-server-xxxxx"}
          className="w-full px-3 py-1.5 border rounded text-sm"
        />
        <p className="text-xs text-slate-500 mt-1">
          Key akan dienkripsi dan tidak dapat dibaca kembali setelah disimpan
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !serverKey.trim()}
        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm"
      >
        {saving ? "Menyimpan..." : "Simpan Key"}
      </button>
    </div>
  )
}
