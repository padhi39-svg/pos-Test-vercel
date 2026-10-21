"use client"
import { useRef, useState } from 'react'

type Props = {
  title?: string
  accept?: string
  value: string | null
  onChange: (url: string | null) => void
  readonly?: boolean
  uploadEndpoint?: string
  emptyText?: string
  emptyIcon?: 'image' | 'file'
}

export default function FileUpload({
  title,
  accept = 'image/*',
  value,
  onChange,
  readonly = false,
  uploadEndpoint = '/api/upload',
  emptyText = 'Belum ada file',
  emptyIcon = 'image',
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const objUrl = URL.createObjectURL(f)
    setLocalPreview(objUrl)
    try {
      setUploading(true)
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(uploadEndpoint, { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Upload gagal (${res.status})`)
      }
      const out = await res.json()
      onChange(out.url)
    } catch (err: any) {
      console.error('Upload error:', err)
      alert(err?.message || 'Gagal upload file.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => {
        URL.revokeObjectURL(objUrl)
        setLocalPreview(null)
      }, 1500)
    }
  }

  return (
    <div>
      {title && <div className="text-[10px] text-slate-600 mb-1">{title}</div>}
      <div className="flex items-start gap-3">
        {value || localPreview ? (
          <div className="relative w-32 h-32 rounded-card border border-teal-bg overflow-hidden bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(value || localPreview) as string} alt="Preview" className="w-full h-full object-cover" />
            {!readonly && (
              <button
                type="button"
                className="absolute top-1 right-1 p-0.5 rounded-full bg-white/80 text-slate-600 hover:text-red-600 shadow-sm"
                onClick={() => onChange(null)}
                title="Hapus"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="w-32 h-32 rounded-card border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 bg-slate-50/50">
            {emptyIcon === 'file' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            <span className="text-[10px] text-center px-1">{emptyText}</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleUpload}
            disabled={readonly || uploading}
          />
          {!readonly && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-pill border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg text-sm flex items-center gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? 'Mengunggah...' : value ? 'Ganti File' : 'Upload File'}
            </button>
          )}
          {uploading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 border-2 border-teal-primary rounded-full border-t-transparent animate-spin inline-block" />
              Mengunggah...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
