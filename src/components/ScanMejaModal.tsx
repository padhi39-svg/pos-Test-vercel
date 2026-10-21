import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'

type Props = {
  onResult: (code: string) => void
  onClose: () => void
}

export default function ScanMejaModal({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)
  const doneRef = useRef(false)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let controls: { stop: () => void } | null = null
    let cancelled = false

    const finish = (text: string) => {
      if (doneRef.current) return
      doneRef.current = true
      try { controls?.stop() } catch {}
      onResultRef.current(text)
    }

    ;(async () => {
      try {
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current as HTMLVideoElement,
          (result) => {
            if (result && !cancelled) {
              const text = result.getText()
              if (text) finish(text)
            }
          },
        )
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message ||
              'Gagal membuka kamera. Pastikan izin kamera diberikan dan halaman diakses lewat HTTPS.',
          )
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    })()

    return () => {
      cancelled = true
      try { controls?.stop() } catch {}
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70]" onClick={onClose}>
      <div
        className="bg-white rounded-modal shadow-2xl w-[460px] max-w-[95vw] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <div className="font-medium text-sm">Scan Meja</div>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Tutup
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {starting && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-7 w-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <span className="text-xs text-center text-rose-200">{error}</span>
              </div>
            )}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-8 h-0.5 bg-teal-300/70 pointer-events-none" />
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Arahkan kamera ke QR meja. Atau masukkan kode meja secara manual di bawah.
          </p>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const v = (e.currentTarget.elements.namedItem('code') as HTMLInputElement).value.trim()
              if (v) onResult(v)
            }}
          >
            <input
              name="code"
              className="flex-1 rounded-pill border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
              placeholder="Kode meja (mis. MEJA01)"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-pill bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold"
            >
              Cari
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
