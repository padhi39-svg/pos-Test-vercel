"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { ChevronDownIcon, ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const GOLONGAN_LIST = [
  { value: 'aset', label: 'ASET' },
  { value: 'aset_lancar_kas', label: 'Aset Lancar - Kas & Bank' },
  { value: 'aset_lancar_piutang', label: 'Aset Lancar - Piutang' },
  { value: 'aset_lancar_persediaan', label: 'Aset Lancar - Persediaan' },
  { value: 'aset_lancar_lainnya', label: 'Aset Lancar - Lainnya' },
  { value: 'aset_lancar', label: 'Aset Lancar' },
  { value: 'aset_tidak_lancar', label: 'Aset Tidak Lancar' },
  { value: 'kewajiban', label: 'KEWAJIBAN' },
  { value: 'kewajiban_lancar', label: 'Kewajiban Lancar' },
  { value: 'kewajiban_tidak_lancar', label: 'Kewajiban Tidak Lancar' },
  { value: 'ekuitas', label: 'Ekuitas' },
  { value: 'pendapatan', label: 'Pendapatan' },
  { value: 'hpp', label: 'HPP' },
  { value: 'beban', label: 'Beban' },
  { value: 'pendapatan_lain', label: 'Pendapatan Lain-lain' },
  { value: 'beban_lain', label: 'Beban Lain-lain' },
] as const

const GOLONGAN_MAP = Object.fromEntries(GOLONGAN_LIST.map(g => [g.value, g.label])) as Record<string, string>

export type AccountNode = {
  id: string
  code: string
  name: string
  normal_balance: 'D' | 'C'
  is_header: boolean
  is_cash: boolean
  is_bank_account: boolean
  golongan: string | null
  parent_id: string | null
  children?: AccountNode[]
}

function findNodeById(nodes: AccountNode[], id: string): AccountNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const f = findNodeById(n.children, id)
      if (f) return f
    }
  }
  return null
}

function clone(nodes: AccountNode[]): AccountNode[] {
  return nodes.map(n => ({ ...n, children: n.children ? clone(n.children) : undefined }))
}

function flattenWithDepth(nodes: AccountNode[], depth = 0): { node: AccountNode; depth: number }[] {
  const result: { node: AccountNode; depth: number }[] = []
  for (const n of nodes) {
    result.push({ node: n, depth })
    if (n.children) result.push(...flattenWithDepth(n.children, depth + 1))
  }
  return result
}

function getDescendantIds(nodes: AccountNode[], id: string): string[] {
  const ids: string[] = []
  const node = findNodeById(nodes, id)
  if (node?.children) {
    for (const c of node.children) {
      ids.push(c.id)
      ids.push(...getDescendantIds(nodes, c.id))
    }
  }
  return ids
}

interface NodeRowProps {
  node: AccountNode
  depth: number
  expanded: Record<string, boolean>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  toggleExpand: (id: string) => void
  startAdd: (parentId: string | null) => void
  startEdit: (node: AccountNode) => void
  deleteNode: (id: string) => void
}

function NodeRow({ node, depth, expanded, selectedId, setSelectedId, toggleExpand, startAdd, startEdit, deleteNode }: NodeRowProps) {
  const hasChildren = !!(node.children && node.children.length)
  const open = !!expanded[node.id]
  const canAddChild = depth < 3

  return (
    <div className="group">
      <div className={clsx('flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50', selectedId === node.id && 'bg-blue-50')}
        onClick={() => setSelectedId(node.id)}>
        <div className="w-[1.25rem]">
          {hasChildren ? (
            <button className="h-5 w-5 grid place-items-center rounded hover:bg-slate-100" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpand(node.id) }}>
              {open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        <div className="text-xs text-slate-500" style={{ paddingLeft: depth * 8 }}>
          {node.code}
        </div>
        <div className="flex-1 text-sm text-slate-800 truncate">{node.name}</div>
        <div className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">{node.normal_balance === 'D' ? 'Debit' : 'Kredit'}</div>
        <div className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">{node.is_header ? 'Header' : 'Detail'}</div>
        {node.is_cash && <div className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Kas</div>}
        {node.is_bank_account && <div className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Bank</div>}
        {node.golongan && GOLONGAN_MAP[node.golongan] && <div className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">{GOLONGAN_MAP[node.golongan]}</div>}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {canAddChild && (
            <button className="h-7 w-7 grid place-items-center rounded hover:bg-slate-100" title="Tambah sub-akun" onClick={(e) => { e.stopPropagation(); startAdd(node.id) }}>
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
          <button className="h-7 w-7 grid place-items-center rounded hover:bg-slate-100" title="Ubah" onClick={(e) => { e.stopPropagation(); startEdit(node) }}>
            <PencilIcon className="h-4 w-4" />
          </button>
          <button className="h-7 w-7 grid place-items-center rounded hover:bg-slate-100" title="Hapus" onClick={(e) => { e.stopPropagation(); deleteNode(node.id) }}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>
      {hasChildren && open && (
        <div className="ml-5 border-l border-slate-200 pl-2">
          {node.children!.map((c) => (
            <NodeRow key={c.id} node={c} depth={depth + 1} expanded={expanded} selectedId={selectedId} setSelectedId={setSelectedId} toggleExpand={toggleExpand} startAdd={startAdd} startEdit={startEdit} deleteNode={deleteNode} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PerkiraanTree() {
  const [tree, setTree] = useState<AccountNode[]>([])
  const [loading, setLoading] = useState(false)

  async function loadTree() {
    setLoading(true)
    try {
      const res = await fetch('/api/keuangan/perkiraan?tree=1', { cache: 'no-store' })
      const data = await res.json()
      const mapped = (data || []).map((n: any) => mapNode(n)) as AccountNode[]
      setTree(mapped)
      await checkDeleteAll()
    } catch {
      // fallback: keep empty
    } finally {
      setLoading(false)
    }
  }

  async function checkDeleteAll() {
    try {
      const res = await fetch('/api/keuangan/perkiraan/delete-all')
      if (res.ok) {
        const data = await res.json()
        setCanDeleteAll(data.canDelete)
      }
    } catch (e) {
      console.warn('checkDeleteAll gagal:', e)
    }
  }

  async function deleteAllAccounts() {
    setDeletingAll(true)
    setShowConfirmDeleteAll(false)
    try {
      const res = await fetch('/api/keuangan/perkiraan/delete-all', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus semua akun')
      await loadTree()
    } catch (e: any) {
      setError(e?.message || 'Gagal menghapus semua akun')
    } finally {
      setDeletingAll(false)
    }
  }

  async function seedDefault() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/keuangan/perkiraan/seed', { method: 'POST' })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'Gagal mengisi default COA')
      await loadTree()
    } catch (e:any) {
      setError(e?.message || 'Gagal mengisi default COA')
    } finally {
      setLoading(false)
    }
  }

  function mapNode(n: any): AccountNode {
    return {
      id: String(n.id),
      code: String(n.code),
      name: String(n.name),
      normal_balance: String(n.normalBalance || 'D') === 'C' ? 'C' : 'D',
      is_header: !!Number(n.isHeader),
      is_cash: !!Number(n.isCash),
      is_bank_account: !!Number(n.isBankAccount),
      golongan: n.golongan || null,
      parent_id: n.parentId ? String(n.parentId) : null,
      children: Array.isArray(n.children) ? n.children.map((c: any) => mapNode(c)) : undefined,
    }
  }

  useEffect(() => { loadTree() }, [])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '1': true, '1.1': true, '1.1.1': true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => selectedId ? findNodeById(tree, selectedId) : null, [selectedId, tree])

  const [form, setForm] = useState({
    mode: 'create' as 'create' | 'edit',
    parentId: '' as string | null,
    id: '' as string | null,
    code: '',
    name: '',
    normal_balance: 'D' as 'D' | 'C',
    is_header: false,
    is_cash: false,
    is_bank_account: false,
    golongan: '' as string,
  })
  const [error, setError] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [canDeleteAll, setCanDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const allNodeIds = useMemo(() => {
    const ids: string[] = []
    function walk(nodes: AccountNode[]) {
      for (const n of nodes) {
        ids.push(n.id)
        if (n.children) walk(n.children)
      }
    }
    walk(tree)
    return ids
  }, [tree])

  function expandAll() {
    setExpanded(Object.fromEntries(allNodeIds.map(id => [id, true])))
  }

  function collapseAll() {
    setExpanded(Object.fromEntries(allNodeIds.map(id => [id, false])))
  }

  function startAdd(parentId: string | null) {
    setError(null)
    setForm({ mode: 'create', parentId, id: null, code: '', name: '', normal_balance: 'D', is_header: false, is_cash: false, is_bank_account: false, golongan: '' })
  }

  function startEdit(node: AccountNode) {
    setError(null)
    setForm({ mode: 'edit', parentId: node.parent_id, id: node.id, code: node.code, name: node.name, normal_balance: node.normal_balance, is_header: false, is_cash: node.is_cash, is_bank_account: node.is_bank_account, golongan: node.golongan || '' })
  }

  async function upsertNode() {
    if (!form.name.trim()) {
      setError('Nama akun wajib diisi')
      return
    }
    try {
      if (form.mode === 'create') {
        const payload: any = {
          code: form.code.trim(),
          name: form.name.trim(),
          parent_id: form.parentId ? Number(form.parentId) : null,
          normal_balance: form.normal_balance,
          is_header: form.is_header ? 1 : 0,
          is_cash: form.is_cash ? 1 : 0,
          is_bank_account: form.is_bank_account ? 1 : 0,
          golongan: form.golongan || null,
          is_active: 1,
          posting_allowed: form.is_header ? 0 : 1,
        }
        const res = await fetch('/api/keuangan/perkiraan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan')
        setSelectedId(String(data.id))
      } else {
        const payload: any = {
          id: Number(form.id),
          code: form.code.trim(),
          name: form.name.trim(),
          normal_balance: form.normal_balance,
          is_header: form.is_header ? 1 : 0,
          is_cash: form.is_cash ? 1 : 0,
          is_bank_account: form.is_bank_account ? 1 : 0,
          golongan: form.golongan || null,
          parent_id: form.parentId ? Number(form.parentId) : null,
        }
        const res = await fetch('/api/keuangan/perkiraan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan perubahan')
        setSelectedId(String(data.id))
      }
      setForm({ mode: 'create', parentId: null, id: null, code: '', name: '', normal_balance: 'D', is_header: false, is_cash: false, is_bank_account: false })
      setError(null)
      await loadTree()
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan')
    }
  }

  async function downloadTemplate() {
    try {
      const res = await fetch('/api/accounts/template')
      if (!res.ok) throw new Error('Gagal download template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Template-COA.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setImportMsg(e?.message || 'Gagal download template')
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg(null)
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/accounts/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal import')
      const total = data.total || 0
      const imported = data.imported || 0
      const failed = data.failed || 0
      setImportMsg(`Import selesai: ${imported}/${total} berhasil${failed > 0 ? `, ${failed} gagal` : ''}`)
      await loadTree()
    } catch (e: any) {
      setImportMsg(e?.message || 'Gagal import file')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deleteNode(id: string) {
    try {
      const res = await fetch(`/api/keuangan/perkiraan?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus')
      if (selectedId === id) setSelectedId(null)
      await loadTree()
      setError(null)
    } catch (e:any) {
      setError(e?.message || 'Gagal menghapus')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-[calc(100vh-96px)]">
      <div className="lg:col-span-2 border rounded-md bg-white h-[calc(100vh-96px)] flex flex-col">
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <div className="font-semibold text-slate-800">Daftar Akun (COA)</div>
          <div className="ml-auto flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
            <button disabled={importing} className="h-8 px-3 rounded border border-slate-300 text-slate-700 text-sm flex items-center gap-1 hover:bg-slate-50" onClick={downloadTemplate}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download Template
            </button>
            <button disabled={importing} className="h-8 px-3 rounded border border-slate-300 text-slate-700 text-sm flex items-center gap-1 hover:bg-slate-50" onClick={() => fileRef.current?.click()}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {importing ? 'Importing...' : 'Import Excel'}
            </button>
            <button className="h-8 px-3 rounded bg-[#3C3C3C] text-white text-sm flex items-center gap-2" onClick={() => startAdd(null)}>
              <PlusIcon className="h-4 w-4" /> Tambah Akun Utama
            </button>
            <div className="w-px h-6 bg-slate-200"></div>
            <button className="h-8 px-2 rounded border border-slate-300 text-slate-600 text-xs hover:bg-slate-50" onClick={expandAll} title="Expand all">
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <svg className="w-4 h-4 inline -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button className="h-8 px-2 rounded border border-slate-300 text-slate-600 text-xs hover:bg-slate-50" onClick={collapseAll} title="Collapse all">
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              <svg className="w-4 h-4 inline -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </button>
            {tree.length > 0 && (
              <>
                <div className="w-px h-6 bg-slate-200"></div>
                <button
                  disabled={!canDeleteAll || deletingAll}
                  className={clsx(
                    'h-8 px-3 rounded text-sm flex items-center gap-1',
                    canDeleteAll
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-red-50 text-red-300 cursor-not-allowed'
                  )}
                  title={
                    !canDeleteAll
                      ? 'Tidak bisa dihapus karena sudah digunakan di transaksi atau data lain'
                      : 'Hapus semua akun'
                  }
                  onClick={() => setShowConfirmDeleteAll(true)}>
                  <TrashIcon className="h-4 w-4" />
                  {deletingAll ? 'Menghapus...' : 'Hapus Semua'}
                </button>
              </>
            )}
          </div>
        </div>
        {importMsg && (
          <div className="px-3 py-1.5 text-xs border-b bg-blue-50 text-blue-700 flex items-center justify-between">
            <span>{importMsg}</span>
            <button onClick={() => setImportMsg(null)} className="ml-2 text-blue-500 hover:text-blue-700">&times;</button>
          </div>
        )}
        <div className="p-2 flex-1 overflow-auto">
          {loading ? (
            <div className="text-xs text-slate-500 px-2 py-1">Memuat akun...</div>
          ) : tree.length === 0 ? (
            <div className="h-full grid place-items-center">
              <div className="text-center">
                <div className="text-sm text-slate-600 mb-2">Belum ada akun. Isi COA standar Indonesia?</div>
                <button onClick={seedDefault} className="h-9 px-3 rounded bg-[#3C3C3C] text-white text-sm">Isi Default COA</button>
              </div>
            </div>
          ) : (
            tree.map((n) => (
              <NodeRow key={n.id} node={n} depth={0} expanded={expanded} selectedId={selectedId} setSelectedId={setSelectedId} toggleExpand={toggleExpand} startAdd={startAdd} startEdit={startEdit} deleteNode={deleteNode} />
            ))
          )}
        </div>
      </div>
      <div className="border rounded-md bg-white h-[calc(100vh-96px)]">
        <div className="px-3 py-2 border-b font-semibold text-slate-800">{form.mode === 'create' ? 'Tambah Akun' : 'Ubah Akun'}</div>
        <div className="p-3 space-y-2">
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Kode</label>
            <input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="Kode akun" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Nama Akun</label>
            <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="Nama akun" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Normal Balance</label>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={form.normal_balance === 'D'} onChange={() => setForm(f => ({ ...f, normal_balance: 'D' }))} /> Debit
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={form.normal_balance === 'C'} onChange={() => setForm(f => ({ ...f, normal_balance: 'C' }))} /> Kredit
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Tipe Kas/Bank</label>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={form.is_cash} onChange={(e) => setForm(f => ({ ...f, is_cash: e.target.checked, is_bank_account: f.is_bank_account && !e.target.checked ? false : f.is_bank_account }))} /> Kas
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={form.is_bank_account} onChange={(e) => setForm(f => ({ ...f, is_bank_account: e.target.checked, is_cash: f.is_cash && !e.target.checked ? false : f.is_cash }))} /> Bank
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Golongan</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={form.golongan} onChange={(e) => setForm(f => ({ ...f, golongan: e.target.value }))}>
              <option value="">-- Pilih Golongan --</option>
              {GOLONGAN_LIST.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">Golongan membantu mengelompokkan akun saat dipilih di menu lain</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Parent</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={form.parentId ?? ''} onChange={(e) => setForm(f => ({ ...f, parentId: e.target.value || null }))}>
              <option value="">-- Root (level 1) --</option>
              {(() => {
                const all = flattenWithDepth(tree)
                const excludeIds = form.mode === 'edit' && form.id ? new Set([form.id, ...getDescendantIds(tree, form.id)]) : new Set<string>()
                const parents = all.filter(({ node, depth }) => !excludeIds.has(node.id) && depth < 3)
                return parents.map(({ node }) => (
                  <option key={node.id} value={node.id}>{node.code} - {node.name}</option>
                ))
              })()}
            </select>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <button className="h-9 px-3 rounded bg-[#3C3C3C] text-white text-sm" onClick={upsertNode}>Simpan</button>
            <button className="h-9 px-3 rounded bg-slate-100 text-slate-700 text-sm" onClick={() => setForm({ mode: 'create', parentId: null, id: null, code: '', name: '', normal_balance: 'D', is_header: false, golongan: '' })}>Reset</button>
          </div>
          {selected ? (
            <div className="mt-3 text-xs text-slate-600">
              Akun terpilih: <span className="font-semibold text-slate-800">{selected.code} - {selected.name}</span>
            </div>
          ) : null}
          {form.parentId ? (
            <div className="mt-2 text-xs text-slate-600">Parent: {findNodeById(tree, form.parentId)?.name}</div>
          ) : null}
        </div>
      </div>

      {showConfirmDeleteAll && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 mx-3">
            <div className="text-base font-semibold text-slate-800 mb-2">Hapus Semua Akun?</div>
            <p className="text-sm text-slate-600 mb-4">
              Semua akun (COA) akan dihapus permanen. Data akun yang sudah digunakan di transaksi
              atau master data tidak akan bisa dihapus.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                className="h-9 px-4 rounded border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                onClick={() => setShowConfirmDeleteAll(false)}>Batal</button>
              <button
                className="h-9 px-4 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                onClick={deleteAllAccounts}>Ya, Hapus Semua</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
