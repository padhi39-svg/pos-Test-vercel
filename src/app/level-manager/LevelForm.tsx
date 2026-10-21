"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { showError, showSuccess, CrudMessages } from '@/lib/notification'

type PermissionDef = { code: string; name: string; description?: string; sort_order: number }
type MenuDef = { code: string; name: string; path: string; group?: string; permissions?: string[] }
type GroupDef = { code: string; name: string; order: number }

// Permission state: menu_code -> permission_code -> allowed
type PermState = Record<string, Record<string, boolean>>

type Props = {
  title: string
  basePath: string
  initial?: { id?: number; code?: string; name?: string; permissions?: { menu_code: string; permission_code: string; allowed: boolean }[] }
  onSubmit?: (payload: any) => Promise<Response>
  currentId?: number
  readonly?: boolean
}

export default function LevelForm({ title, basePath, initial, onSubmit, currentId, readonly }: Props) {
  const router = useRouter()
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [menus, setMenus] = useState<MenuDef[]>([])
  const [permissions, setPermissions] = useState<PermissionDef[]>([])
  const [groups, setGroups] = useState<GroupDef[]>([])
  const [perms, setPerms] = useState<PermState>({})
  const [backdateEnabled, setBackdateEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState({ group: '', search: '' })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/level-manager/menus')
        const data = await res.json()
        const menuList: MenuDef[] = data.menus || []
        const permList: PermissionDef[] = data.permissions || []
        const groupList: GroupDef[] = data.groups || []
        
        setMenus(menuList)
        setPermissions(permList.sort((a, b) => a.sort_order - b.sort_order))
        setGroups(groupList.sort((a, b) => a.order - b.order))
        
        // Initialize permission state - default all to false
        const map: PermState = {}
        menuList.forEach((m) => {
          map[m.code] = {}
          ;(m.permissions || []).forEach((p) => {
            map[m.code][p] = false
          })
        })
        
        // Apply initial permissions if provided (from database)
        // Only set to true if explicitly allowed in the data
        ;(initial?.permissions || []).forEach((p) => {
          if (map[p.menu_code] !== undefined) {
            map[p.menu_code][p.permission_code] = !!p.allowed
          }
        })
        
        setPerms(map)
        
        // Check if any menu has backdate permission enabled (global toggle)
        const hasBackdate = (initial?.permissions || []).some(
          p => String(p.permission_code || '').toUpperCase() === 'BACKDATE' && !!p.allowed
        )
        console.log('[LevelForm] backdate check:', { hasBackdate, totalPerms: initial?.permissions?.length, backdateEntries: (initial?.permissions || []).filter(p => String(p.permission_code||'').toUpperCase()==='BACKDATE').map(p => ({ menu: p.menu_code, allowed: p.allowed })) })
        setBackdateEnabled(hasBackdate)
        
        // Expand all groups by default
        const expanded: Record<string, boolean> = {}
        groupList.forEach((g) => { expanded[g.code] = true })
        setExpandedGroups(expanded)
      } catch (e: any) {
        console.error(e)
        showError('Gagal memuat daftar menu')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kategorisasi menu: 0=master, 1=transaksi, 2=laporan (sama seperti HeaderMenu)
  const getMenuCategory = (m: MenuDef): number => {
    const p = m.path
    const nm = m.name.toLowerCase()
    // Penjualan
    if (m.group === 'Penjualan') {
      if (['/customer','/jenis-customer','/season-discount','/sales-master','/penjualan/setting-nota'].includes(p)) return 0
      if (['/sales','/reports/sales-recap','/reports/sales-rekap-pertanggal','/reports/sales-detail','/reports/sales-by-category','/reports/sales-by-specification','/reports/sales-gross-profit','/reports/usage','/reports/sales-vs-usage','/reports/pos-sales','/reports/sales-jatuh-tempo'].includes(p)) return 2
      return 1
    }
    // Keuangan
    if (m.group === 'Keuangan') {
      if (['/keuangan/perkiraan','/bank','/keuangan/saldo-awal-hutang','/keuangan/saldo-awal-piutang','/keuangan/setting-perkiraan'].includes(p)) return 0
      if (['/reports/jurnal-harian','/reports/buku-besar','/reports/trial-balance','/reports/neraca','/reports/laba-rugi','/reports/neraca-labarugi','/reports/kartu-kas-bank','/reports/kartu-piutang','/reports/kartu-hutang','/reports/piutang-jatuh-tempo','/reports/hutang-jatuh-tempo','/reports/kartu-uang-muka-customer','/reports/kartu-uang-muka-supplier','/reports/payment-recap-ar','/reports/payment-detail-ar','/reports/payment-recap-ap','/reports/payment-detail-ap','/keuangan/rekonsiliasi-fiskal','/reports/coretax'].includes(p)) return 2
      return 1
    }
    // Barang
    if (m.group === 'Barang') {
      if (['/barang/menu','/barang/kategori','/barang/spesifikasi','/barang/merk','/harga','/master/barang-pembantu','/master-paket'].includes(p)) return 0
      return 1
    }
    // Stok
    if (m.group === 'Stok') {
      if (['/gudang','/ingredient'].includes(p)) return 0
      if (['/stock','/stock-hpp','/reports/stock-recap-period','/reports/konversi-stok'].includes(p)) return 2
      return 1
    }
    // Default heuristic
    if (nm.startsWith('master') || p.includes('/master') || p.endsWith('/gudang') || p.endsWith('/ingredient')) return 0
    if (p.includes('/reports') || nm.includes('laporan') || nm.includes('list')) return 2
    return 1
  }

  // Group menus by their group, sorted by kategori (master→transaksi→laporan)
  const grouped = useMemo(() => {
    const groupMap: Record<string, { group: GroupDef; items: MenuDef[] }> = {}
    const idxMap = new Map(menus.map((m, i) => [m.code, i]))
    
    groups.forEach((g) => {
      groupMap[g.code] = { group: g, items: [] }
    })
    
    menus.forEach((m) => {
      const gCode = m.group || 'Lainnya'
      if (!groupMap[gCode]) {
        groupMap[gCode] = { group: { code: gCode, name: gCode, order: 99 }, items: [] }
      }
      if (filter.group && gCode !== filter.group) return
      if (filter.search && !m.name.toLowerCase().includes(filter.search.toLowerCase())) return
      groupMap[gCode].items.push(m)
    })
    
    // Sort items within each group: kategori dulu, lalu urutan asli
    for (const g of Object.values(groupMap)) {
      g.items.sort((a, b) => {
        const ca = getMenuCategory(a)
        const cb = getMenuCategory(b)
        if (ca !== cb) return ca - cb
        return (idxMap.get(a.code) ?? 0) - (idxMap.get(b.code) ?? 0)
      })
    }
    
    return Object.values(groupMap)
      .filter((g) => g.items.length > 0)
      .sort((a, b) => a.group.order - b.group.order)
  }, [menus, groups, filter])

  const toggleGroup = (groupCode: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupCode]: !prev[groupCode] }))
  }

  const expandAll = () => {
    const expanded: Record<string, boolean> = {}
    groups.forEach((g) => { expanded[g.code] = true })
    setExpandedGroups(expanded)
  }

  const collapseAll = () => {
    setExpandedGroups({})
  }

  const selectAll = () => {
    const next: PermState = { ...perms }
    menus.forEach((m) => {
      if (!next[m.code]) next[m.code] = {}
      ;(m.permissions || []).forEach((p) => {
        next[m.code][p] = true
      })
    })
    setPerms(next)
  }

  const clearAll = () => {
    const next: PermState = { ...perms }
    menus.forEach((m) => {
      if (!next[m.code]) next[m.code] = {}
      ;(m.permissions || []).forEach((p) => {
        next[m.code][p] = false
      })
    })
    setPerms(next)
  }

  const toggleMenuPerm = (menuCode: string, permCode: string, checked: boolean) => {
    setPerms((prev) => ({
      ...prev,
      [menuCode]: { ...prev[menuCode], [permCode]: checked }
    }))
  }

  const toggleGroupPerm = (groupCode: string, permCode: string, checked: boolean) => {
    const next: PermState = { ...perms }
    const group = grouped.find((g) => g.group.code === groupCode)
    if (!group) return
    group.items.forEach((m) => {
      if ((m.permissions || []).includes(permCode)) {
        if (!next[m.code]) next[m.code] = {}
        next[m.code][permCode] = checked
      }
    })
    setPerms(next)
  }

  const handleSubmit = async () => {
    if (readonly) return
    try {
      setSaving(true)
      // Convert perms to array format
      const permArray: { menu_code: string; permission_code: string; allowed: boolean }[] = []
      Object.entries(perms).forEach(([menuCode, permMap]) => {
        Object.entries(permMap).forEach(([permCode, allowed]) => {
          // Skip BACKDATE — handled globally by toggle below
          if (String(permCode).toUpperCase() === 'BACKDATE') return
          permArray.push({ menu_code: menuCode, permission_code: permCode, allowed })
        })
      })
      // Apply global backdate permission to all menus (always save, true or false)
      const seen = new Set<string>()
      menus.forEach((m) => {
        if (!seen.has(m.code)) {
          seen.add(m.code)
          permArray.push({ menu_code: m.code, permission_code: 'BACKDATE', allowed: backdateEnabled })
        }
      })
      
      const payload = {
        code: (code || '').trim().toUpperCase(),
        name: (name || '').trim().replace(/\s+/g, ' ').replace(/(^|\s)\S/g, (t) => t.toUpperCase()),
        permissions: permArray
      }
      console.log('[LevelForm] saving:', { backdateEnabled, backdateEntries: permArray.filter(p => p.permission_code === 'BACKDATE').slice(0, 3), totalPerms: permArray.length })
      const res = await (onSubmit ? onSubmit(payload) : fetch('/api/level-manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(data?.error || 'Gagal menyimpan level')
        return
      }
      showSuccess(CrudMessages.created('level manager'))
      router.push(basePath)
    } catch (e: any) {
      showError(e.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  // Check if group has all permissions checked for a specific permission code
  const isGroupPermChecked = (groupCode: string, permCode: string): boolean => {
    const group = grouped.find((g) => g.group.code === groupCode)
    if (!group) return false
    const applicable = group.items.filter((m) => (m.permissions || []).includes(permCode))
    if (applicable.length === 0) return false
    return applicable.every((m) => perms[m.code]?.[permCode])
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-500">Pengaturan hak akses menu untuk level manager</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(basePath)} className="px-3 py-1.5 text-xs rounded bg-slate-500 text-white hover:bg-slate-600">
              Kembali
            </button>
            {!readonly && (
              <button onClick={handleSubmit} disabled={saving} className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            )}
          </div>
        </div>
        
        {/* Form fields */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Kode Level</label>
            <input
              value={code}
              disabled={!!currentId || readonly}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-2 py-1.5 border rounded text-xs"
              placeholder="LVL-ADMIN"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nama Level</label>
            <input
              value={name}
              disabled={readonly}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-xs"
              placeholder="Administrator"
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="font-semibold text-sm text-slate-700">Hak Akses</div>
        {!readonly && (
          <div className="flex items-center gap-1">
            <button onClick={selectAll} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
              Select All
            </button>
            <button onClick={clearAll} className="px-2 py-1 text-xs bg-slate-400 text-white rounded hover:bg-slate-500">
              Clear All
            </button>
            <button onClick={expandAll} className="px-2 py-1 text-xs bg-slate-300 text-slate-700 rounded hover:bg-slate-400">
              Expand All
            </button>
            <button onClick={collapseAll} className="px-2 py-1 text-xs bg-slate-300 text-slate-700 rounded hover:bg-slate-400">
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Main content - two columns: tree + info panel */}
      <div className="flex-1 flex overflow-hidden bg-white">
        {/* Left: Tree with vertical permissions */}
        <div className="flex-1 overflow-auto p-4">
          {/* Global Security Section */}
          <div className="mb-4 border rounded-md px-3 py-2 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🔒</span>
              <h3 className="font-semibold text-sm text-slate-800">Security</h3>
            </div>
            {!readonly && (
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600"
                  checked={backdateEnabled}
                  onChange={(e) => setBackdateEnabled(e.target.checked)}
                />
                <span className="text-sm text-slate-700">Izinkan Tanggal Mundur (Backdate) untuk Semua Menu</span>
              </label>
            )}
            {readonly && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-block w-3 h-3 rounded-full ${backdateEnabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                <span className="text-sm text-slate-700">
                  Backdate: {backdateEnabled ? 'Diizinkan' : 'Tidak Diizinkan'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-1 ml-6">
              Jika diaktifkan, user level ini bisa input/approve transaksi dengan tanggal mundur untuk semua menu.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              Memuat menu...
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              Tidak ada menu
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ group, items }) => (
                <div key={group.code} className="space-y-2 border rounded-md px-3 py-2 bg-slate-50">
                {/* Group header with checkbox */}
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => toggleGroup(group.code)}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600"
                    checked={items.every(m => (m.permissions || []).every(p => perms[m.code]?.[p]))}
                    onChange={(e) => {
                      e.stopPropagation()
                      items.forEach(m => {
                        (m.permissions || []).forEach(p => {
                          toggleMenuPerm(m.code, p, e.target.checked)
                        })
                      })
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={readonly}
                  />
                  <span className="font-semibold text-base text-slate-800">{group.name}</span>
                  <span className="text-xs text-slate-400">
                    {expandedGroups[group.code] ? '▼' : '▶'}
                  </span>
                </div>
                
                {/* Menu items with vertical permissions */}
                {expandedGroups[group.code] && (
                  <div className="ml-5 mt-1 space-y-3">
                    {items.map((menu) => (
                      <div key={menu.code} className="space-y-1">
                        {/* Menu name with checkbox */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 text-blue-600"
                            checked={(menu.permissions || []).every(p => perms[menu.code]?.[p])}
                            onChange={(e) => {
                              (menu.permissions || []).forEach(p => {
                                toggleMenuPerm(menu.code, p, e.target.checked)
                              })
                            }}
                            disabled={readonly}
                          />
                          <span className="text-sm font-medium text-slate-700">{menu.name}</span>
                        </div>
                        
                        {/* Permission checkboxes - VERTICAL */}
                        <div className="ml-5 space-y-0.5">
                          {(menu.permissions || []).map((permCode) => {
                            const permDef = permissions.find(p => p.code === permCode)
                            const isDelete = permCode === 'DELETE'
                            // Khusus menu Reservasi Booking, permission DELETE dipakai untuk Confirm/Cancel
                            const isReservasiBooking = menu.code === 'reservasi_booking'
                            // Khusus List Penjualan, permission DELETE = Void transaksi (tidak menghapus data)
                            const isSalesList = menu.code === 'sales_list'
                            const label = isReservasiBooking && isDelete
                              ? 'Confirm / Cancel'
                              : isSalesList && isDelete
                                ? 'Void Transaksi'
                                : (permDef?.name || permCode)
                            return (
                              <label key={permCode} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="w-3.5 h-3.5 text-blue-600"
                                  disabled={readonly}
                                  checked={!!perms[menu.code]?.[permCode]}
                                  onChange={(e) => toggleMenuPerm(menu.code, permCode, e.target.checked)}
                                />
                                <span className="text-sm text-slate-700">{label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Right: Info / legend panel */}
        <div className="w-72 border-l bg-slate-50 px-4 py-4 hidden lg:block overflow-auto">
          <div className="font-semibold text-sm text-slate-800 mb-2">Petunjuk Hak Akses</div>
          <p className="text-xs text-slate-600 mb-3">
            Gunakan hak akses di kiri untuk mengatur apa saja yang bisa dilakukan user pada setiap menu.
          </p>
          <div className="space-y-2 text-xs text-slate-700">
            {permissions.map((p) => (
              <div key={p.code} className="border rounded bg-white px-2 py-1.5">
                <div className="font-semibold text-sm text-slate-800">{p.name}</div>
                {p.description && (
                  <div className="text-[11px] text-slate-600 mt-0.5">{p.description}</div>
                )}
                {!p.description && (
                  <div className="text-[11px] text-slate-500 mt-0.5">Tidak ada deskripsi.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
