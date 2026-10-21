"use client"
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { useMemo, useState, useEffect } from 'react'
import ImportBarangPembantu from '@/components/barang-pembantu/ImportBarangPembantu'
import { formatCurrency } from '@/lib/regionalNumber'
import ActionIcons from '@/components/ActionIcons'

export type BarangRow = {
  id: number
  code: string
  name: string
  kategoriId: number | null
  merkId: number | null
  jenis?: number | string
  aktif: boolean
  isdelete?: boolean
  prices?: { price: number }[]
}

export default function BarangPembantuList({
  items,
  basePath,
  title,
}: {
  items: BarangRow[]
  basePath: string
  title: string
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'kategoriName' | 'merkName' | 'hpp' | 'price' | 'aktif'>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [mounted, setMounted] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [kategoriOptions, setKategoriOptions] = useState<{id:number; code:string; name:string}[]>([])
  const [merkOptions, setMerkOptions] = useState<{id:number; code:string; name:string}[]>([])
  const [kategoriFilter, setKategoriFilter] = useState<string>('all')
  const [merkFilter, setMerkFilter] = useState<string>('all')
  const [aktifFilter, setAktifFilter] = useState<string>('all')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [resKat, resMerk] = await Promise.all([
          fetch('/api/kategori'),
          fetch('/api/merk'),
        ])
        const [kat, merk] = await Promise.all([
          resKat.ok ? resKat.json() : Promise.resolve([]),
          resMerk.ok ? resMerk.json() : Promise.resolve([]),
        ])
        if (!alive) return
        setKategoriOptions(Array.isArray(kat) ? kat : [])
        setMerkOptions(Array.isArray(merk) ? merk : [])
      } catch {
        if (!alive) return
        setKategoriOptions([]); setMerkOptions([])
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => { setPage(1) }, [query, kategoriFilter, merkFilter, aktifFilter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const mapRow = (x: any) => {
      const kategoriName = x.kategoriId ? (kategoriOptions.find(k => k.id === x.kategoriId)?.name ?? '') : ''
      const merkName = x.merkId ? (merkOptions.find(m => m.id === x.merkId)?.name ?? '') : ''
      const hpp = Number((x as any).hpp ?? 0)
      return { ...x, kategoriName, merkName, hpp }
    }
    return (items || [])
      .filter((x) => !x.isdelete)
      .map(mapRow)
      .filter((x) => {
        const codeLower = String(x.code || '').toLowerCase()
        const nameLower = String(x.name || '').toLowerCase()
        if (q && !codeLower.includes(q) && !nameLower.includes(q)) return false
        if (kategoriFilter !== 'all' && String(x.kategoriId) !== kategoriFilter) return false
        if (merkFilter !== 'all' && String(x.merkId) !== merkFilter) return false
        if (aktifFilter !== 'all' && String(x.aktif) !== aktifFilter) return false
        return true
      })
  }, [items, query, kategoriFilter, merkFilter, aktifFilter, kategoriOptions, merkOptions])

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let aVal: any
      let bVal: any
      if (sortKey === 'price') {
        aVal = a.prices?.[0]?.price ?? 0
        bVal = b.prices?.[0]?.price ?? 0
      } else {
        aVal = (a as any)[sortKey]
        bVal = (b as any)[sortKey]
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const total = sorted.length
  const start = (page - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus barang pembantu ini?')) return
    try {
      setDeletingId(id)
      const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      // simple reload to refresh data
      window.location.reload()
    } catch (e) {
      alert('Gagal menghapus data')
    } finally {
      setDeletingId(null)
    }
  }

  if (!mounted) return <div className="text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 md:px-4 py-2 bg-teal-primary text-white rounded-pill hover:bg-teal-dark transition-all active:scale-[0.97] text-xs md:text-sm shadow-teal-glow"
          >
            Import Excel
          </button>
          <Link href={`${basePath}/new`}><Button>Tambah</Button></Link>
        </div>
      </div>

      <div className="container-card p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[300px]">
            <input
              type="text"
              placeholder="Cari kode atau nama..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-2 py-1 border rounded-lg text-sm w-full"
            />
          </div>

          <select
            value={kategoriFilter}
            onChange={(e) => setKategoriFilter(e.target.value)}
            className="px-2 py-1 border rounded-lg text-sm"
          >
            <option value="all">Semua Kategori</option>
            {kategoriOptions.map(k => (
              <option key={k.id} value={String(k.id)}>{k.name}</option>
            ))}
          </select>

          <select
            value={merkFilter}
            onChange={(e) => setMerkFilter(e.target.value)}
            className="px-2 py-1 border rounded-lg text-sm"
          >
            <option value="all">Semua Merk</option>
            {merkOptions.map(m => (
              <option key={m.id} value={String(m.id)}>{m.name}</option>
            ))}
          </select>

          <select
            value={aktifFilter}
            onChange={(e) => setAktifFilter(e.target.value)}
            className="px-2 py-1 border rounded-lg text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="true">Aktif</option>
            <option value="false">Tidak Aktif</option>
          </select>

          <div className="flex items-center gap-2 ml-auto text-xs">
            <span className="text-slate-600">Tampil</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="px-2 py-1 border rounded text-xs"
            >
              {[20,50,100,200].map(n => (<option key={n} value={n}>{n}</option>))}
            </select>
            <span className="text-slate-600">per halaman</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-slate-600">
                <th className="text-left px-1 py-0.5 cursor-pointer w-[175px]" onClick={() => toggleSort('code')}>Kode{sortKey==='code' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-left px-1 py-0.5 cursor-pointer w-[345px]" onClick={() => toggleSort('name')}>Nama{sortKey==='name' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-left px-1 py-0.5 cursor-pointer" onClick={() => toggleSort('kategoriName')}>Kategori{sortKey==='kategoriName' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-left px-1 py-0.5 cursor-pointer" onClick={() => toggleSort('merkName')}>Merk{sortKey==='merkName' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-left px-1 py-0.5 whitespace-nowrap">Jenis</th>
                <th className="text-right px-1 py-0.5 pl-2 cursor-pointer w-[120px]" onClick={() => toggleSort('hpp')}>HPP{sortKey==='hpp' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-right px-1 py-0.5 pl-2 cursor-pointer w-[130px]" onClick={() => toggleSort('price')}>Harga Jual{sortKey==='price' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-left px-1 py-0.5 cursor-pointer" onClick={() => toggleSort('aktif')}>Aktif{sortKey==='aktif' ? (sortDir==='asc'?' ▲':' ▼'):''}</th>
                <th className="text-right px-1 py-0.5 w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-1 py-3 text-center text-slate-500">Belum ada data</td>
                </tr>
              ) : (
                pageRows.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-1 py-0.5 text-xs w-[175px]">{it.code}</td>
                    <td className="px-1 py-0.5 text-xs w-[345px]">{it.name}</td>
                    <td className="px-1 py-0.5 text-xs">{(it as any).kategoriName || '-'}</td>
                    <td className="px-1 py-0.5 text-xs">{(it as any).merkName || '-'}</td>
                    <td className="px-1 py-0.5 text-xs whitespace-nowrap">Barang Pembantu</td>
                    <td className="px-1 py-0.5 pl-2 text-xs text-right font-mono w-[120px]">{formatCurrency((it as any).hpp ?? 0)}</td>
                    <td className="px-1 py-0.5 pl-2 text-xs text-right font-mono w-[130px]">{formatCurrency((it as any).prices?.[0]?.price ?? 0)}</td>
                    <td className="px-1 py-0.5">
                      <span className={`px-2 py-1 rounded-full text-[10px] ${it.aktif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{it.aktif ? 'Ya' : 'Tidak'}</span>
                    </td>
                    <td className="px-1 py-0.5 text-xs text-right whitespace-nowrap">
                      <ActionIcons
                        viewHref={`${basePath}/${it.id}`}
                        editHref={`${basePath}/${it.id}/edit`}
                        showEdit={true}
                        titleView="Lihat Detail"
                        titleEdit="Edit"
                        showPrint={false}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end p-2">
          <div className="flex items-center gap-2 text-xs">
            <button disabled={page===1} onClick={() => setPage(1)} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">«</button>
            <button disabled={page===1} onClick={() => setPage(page-1)} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">‹</button>
            <span className="px-2">{page} / {totalPages}</span>
            <button disabled={page===totalPages} onClick={() => setPage(page+1)} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">›</button>
            <button disabled={page===totalPages} onClick={() => setPage(totalPages)} className="px-2 py-0.5 rounded-pill border disabled:opacity-50">»</button>
          </div>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Import Excel Barang Pembantu</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <ImportBarangPembantu onDone={() => { setShowImport(false); window.location.reload() }} />
          </div>
        </div>
      )}
    </div>
  )
}
