"use client"

import { ReactNode, useEffect, useRef, useState } from 'react'

export interface TableItem {
  id: number; code: string; name: string; floor_id?: number | null; floor_name?: string | null
  capacity?: number | null; zone?: string | null
  pos_x?: number; pos_y?: number; width?: number; height?: number; shape?: string
}
export interface FloorItem { id: number; name: string; levelNo?: number | null }

export interface TableStatus {
  bg: string
  border: string
  textColor: string
  badgeText: string
  badgeClass: string
  indicatorColor: string
  timerText?: string
  guestCount?: number
  qr?: boolean
}

interface Props {
  tables: TableItem[]
  floors: FloorItem[]
  selectedFloorId?: number | null
  activeTableId?: number | null
  loadingTableId?: number | null
  onTableClick?: (table: TableItem | null) => void
  onTableDoubleClick?: (table: TableItem) => void | Promise<void>
  getTableStatus: (table: TableItem, index: number) => TableStatus
  renderCardContent?: (table: TableItem) => ReactNode
  editing?: boolean
  onSaveLayout?: (items: any[]) => void
  saveTrigger?: number
  moveMode?: { fromTableId: number; tempId: number } | null
  mergeMode?: { fromTableId: number; tempId: number } | null
  floorBgMap?: Record<number, string>
  chairOpacity?: number
  showSourceBadge?: boolean
}

export default function TableGrid({
  tables, floors, selectedFloorId, activeTableId, loadingTableId,
  onTableClick, onTableDoubleClick, getTableStatus, renderCardContent,
  editing, onSaveLayout, saveTrigger, moveMode, mergeMode, floorBgMap, chairOpacity = 40,
  showSourceBadge,
}: Props) {
  const [items, setItems] = useState<any[]>([])
  const [dirty, setDirty] = useState(false)
  const [tick, setTick] = useState(0)
  const [hoveredTargetId, setHoveredTargetId] = useState<number | null>(null)
  const [zoomMap, setZoomMap] = useState<Record<number, number>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('ui_table_zoom_map') || '{}') } catch { return {} }
  })
  const getZoom = (floorId: number) => zoomMap[floorId] ?? 1
  const setZoom = (floorId: number, val: number) => {
    const v = Math.max(0.5, Math.min(2, +val.toFixed(1)))
    setZoomMap(p => { const n = { ...p, [floorId]: v }; return n })
  }
  useEffect(() => {
    try { localStorage.setItem('ui_table_zoom_map', JSON.stringify(zoomMap)) } catch {}
  }, [zoomMap])

  const [resizeHeightMap, setResizeHeightMap] = useState<Record<number, number>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('ui_table_resize_map') || '{}') } catch { return {} }
  })
  const resizeHeightMapRef = useRef(resizeHeightMap)
  resizeHeightMapRef.current = resizeHeightMap
  const getResizeH = (floorId: number) => resizeHeightMap[floorId] ?? 0
  const setResizeH = (floorId: number, val: number) => {
    setResizeHeightMap(p => {
      const n = { ...p, [floorId]: val }
      localStorage.setItem('ui_table_resize_map', JSON.stringify(n))
      return n
    })
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef(items)
  const dirtyRef = useRef(dirty)
  const editingRef = useRef(editing)
  editingRef.current = editing
  const snapGuidesRef = useRef<{ axis: 'h' | 'v'; pos: number; label?: string }[]>([])
  const SNAP_THRESHOLD = 8
  const snapshotRef = useRef<Record<number, { x: number; y: number; w: number; h: number }>>({})
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const resize = useRef<{ id: number; dir: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null)
  const resizeCanvasDrag = useRef<{ startY: number; startH: number; floorId: number } | null>(null)
  itemsRef.current = items
  dirtyRef.current = dirty

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  function renderTableCard(t: TableItem, isActive: boolean, st: TableStatus, cap: number, showChairs = true, extraClasses = '', extraStyle: React.CSSProperties = {}) {
    const tblW = cap <= 2 ? 100 : cap <= 4 ? 120 : cap <= 6 ? 160 : cap <= 8 ? 180 : 220
    const tblH = 90
    const chairW = cap >= 10 ? 32 : cap >= 6 ? 28 : 24
    const chairH = cap >= 10 ? 14 : cap >= 6 ? 12 : 10
    const chairGap = 10
    const hasSide = cap === 6 || cap === 8 || cap >= 10
    const chairsPerRow = hasSide ? Math.floor((cap - 2) / 2) : Math.ceil(cap / 2)
    const offsetX = hasSide ? chairGap + chairH : 0
    const offsetY = chairGap + chairH
    const chairPositions = (() => {
      const w = tblW, h = tblH
      const p: { x: number; y: number }[] = []
      const topY = -chairGap - chairH
      const bottomY = h + chairGap
      const spacing = w / (chairsPerRow + 1)
      for (let i = 1; i <= chairsPerRow; i++) {
        p.push({ x: spacing * i, y: topY })
        p.push({ x: spacing * i, y: bottomY })
      }
      if (hasSide) {
        const sideY = (h - chairH) / 2
        p.push({ x: -chairGap - chairH / 2, y: sideY })
        p.push({ x: w + chairGap + chairH / 2, y: sideY })
      }
      return p
    })()
    return (
      <div className="relative flex flex-col items-center justify-center w-full h-full">
        {showSourceBadge && st.qr && (
          <span className="absolute top-1 right-1 bg-teal-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">QR</span>
        )}
        {showChairs && chairPositions.map((pos, i) => {
          const isSide = pos.x < 0 || pos.x > tblW
          return (
            <div key={i} className="absolute rounded-full border border-slate-400/50"
              style={{ left: pos.x - chairW / 2, top: pos.y, width: chairW, height: chairH, transform: isSide ? 'rotate(90deg)' : 'none', backgroundColor: `rgba(255,255,255,${chairOpacity / 100})` }} />
          )
        })}
        <span className="font-bold text-base text-slate-800 leading-tight">{t.code}</span>
        <span className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: st.indicatorColor }} />
        {st.badgeText === 'Avail' && (
          <span className="text-[10px] text-slate-500 mt-1">{cap} Seat</span>
        )}
        {st.guestCount && st.badgeText !== 'Avail' && (
          <div className="flex flex-col items-center mt-1">
            <span className="text-[10px] text-black font-medium"><strong className="text-black">{st.guestCount}</strong> Orang</span>
            {st.timerText && <span className="text-[9px] text-black font-medium mt-0.5">{st.timerText}</span>}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    if (tables.length) {
      if (editing && items.length > 0) {
        const existingIds = new Set(items.map(it => it.id))
        const newItems = tables.filter(t => !existingIds.has(t.id)).map((t, i) => ({
          id: t.id, code: t.code,
          x: t.pos_x ?? (20 + (i % 4) * 160),
          y: t.pos_y ?? (20 + Math.floor(i / 4) * 140),
          w: t.width ?? 130, h: t.height ?? 100,
          shape: t.shape || 'rectangle',
          floor_id: t.floor_id, floor_name: t.floor_name,
        }))
        if (newItems.length) {
          setItems(prev => [...prev, ...newItems])
        }
        return
      }
      if (dirtyRef.current) return
      const initial = tables.map((t, i) => ({
        id: t.id, code: t.code,
        x: t.pos_x ?? (20 + (i % 4) * 160),
        y: t.pos_y ?? (20 + Math.floor(i / 4) * 140),
        w: t.width ?? 130, h: t.height ?? 100,
        shape: t.shape || 'rectangle',
        floor_id: t.floor_id, floor_name: t.floor_name,
      }))
      if (editing) {
        snapshotRef.current = Object.fromEntries(initial.map(it => [it.id, { x: it.x, y: it.y, w: it.w, h: it.h }]))
      }
      setItems(initial)
    }
  }, [tables, editing])

  const saveRef = useRef(onSaveLayout)
  saveRef.current = onSaveLayout
  useEffect(() => {
    if (!saveTrigger) return
    const current = itemsRef.current
    if (current.length === 0) return
    saveRef.current?.(current.map((it: any) => ({
      id: it.id, code: it.code, pos_x: it.x, pos_y: it.y, width: it.w, height: it.h, shape: it.shape,
    })))
    dirtyRef.current = false
  }, [saveTrigger])

  const onMove = (clientX: number, clientY: number) => {
    const rd = resizeCanvasDrag.current
    if (rd) {
      const newH = Math.max(200, rd.startH + (clientY - rd.startY))
      setResizeH(rd.floorId, Math.round(newH))
      return
    }
    const d = drag.current
    if (d) {
      let nx = Math.max(0, d.ox + clientX - d.sx)
      let ny = Math.max(0, d.oy + clientY - d.sy)
      if (editingRef.current) {
        const draggedItem = itemsRef.current.find((it: any) => it.id === d.id)
        if (draggedItem) {
          const sr = applySnap(draggedItem, nx, ny, itemsRef.current)
          nx = sr.x; ny = sr.y
          snapGuidesRef.current = sr.guides
        }
      } else {
        snapGuidesRef.current = []
      }
      setItems(prev => prev.map(it => it.id === d.id ? { ...it, x: nx, y: ny } : it))
      setDirty(true)
      return
    }
    const r = resize.current
    if (r) {
      const dx = clientX - r.sx, dy = clientY - r.sy, ow = r.ow, oh = r.oh
      let nx = r.ox, ny = r.oy, nw = ow, nh = oh
      if (r.dir.includes('e')) nw = Math.max(50, ow + dx)
      if (r.dir.includes('w')) { const w = Math.max(50, ow - dx); nx = r.ox + (ow - w); nw = w }
      if (r.dir.includes('s')) nh = Math.max(50, oh + dy)
      if (r.dir.includes('n')) { const h = Math.max(50, oh - dy); ny = r.oy + (oh - h); nh = h }
      setItems(prev => prev.map(it => it.id === r.id ? { ...it, x: nx, y: ny, w: nw, h: nh } : it))
      setDirty(true)
    }
  }

  const onUp = () => {
    if (drag.current || resize.current || resizeCanvasDrag.current) {
      localStorage.setItem('ui_table_resize_map', JSON.stringify(resizeHeightMapRef.current))
    }
    snapGuidesRef.current = []
    setTick(t => t + 1)
    drag.current = null; resize.current = null; resizeCanvasDrag.current = null
  }

  function applySnap(
    item: any, proposedX: number, proposedY: number, allItems: any[]
  ): { x: number; y: number; guides: { axis: 'h' | 'v'; pos: number; label?: string }[] } {
    const w = item.w, h = item.h, floorId = item.floor_id
    const others = allItems.filter(it => it.id !== item.id && it.floor_id === floorId)
    let snapX = proposedX, snapY = proposedY
    const guides: { axis: 'h' | 'v'; pos: number; label?: string }[] = []

    let minVDiff = SNAP_THRESHOLD, bestVPos = 0, bestVFrom = 0
    let minHDiff = SNAP_THRESHOLD, bestHPos = 0, bestHFrom = 0

    for (const o of others) {
      const vPairs = [
        [proposedX, o.x], [proposedX, o.x + o.w],
        [proposedX + w, o.x], [proposedX + w, o.x + o.w],
        [proposedX + w / 2, o.x + o.w / 2],
      ]
      for (const [from, to] of vPairs) {
        const d = Math.abs(from - to)
        if (d < minVDiff) { minVDiff = d; bestVPos = to; bestVFrom = from }
      }
      const hPairs = [
        [proposedY, o.y], [proposedY, o.y + o.h],
        [proposedY + h, o.y], [proposedY + h, o.y + o.h],
        [proposedY + h / 2, o.y + o.h / 2],
      ]
      for (const [from, to] of hPairs) {
        const d = Math.abs(from - to)
        if (d < minHDiff) { minHDiff = d; bestHPos = to; bestHFrom = from }
      }
    }

    if (minVDiff < SNAP_THRESHOLD) {
      snapX = proposedX - (bestVFrom - bestVPos)
      guides.push({ axis: 'v', pos: bestVPos, label: minVDiff >= 1 ? `${Math.round(minVDiff)}px` : undefined })
    }
    if (minHDiff < SNAP_THRESHOLD) {
      snapY = proposedY - (bestHFrom - bestHPos)
      guides.push({ axis: 'h', pos: bestHPos, label: minHDiff >= 1 ? `${Math.round(minHDiff)}px` : undefined })
    }
    return { x: Math.max(0, snapX), y: Math.max(0, snapY), guides }
  }

  // Global window listeners untuk canvas resize dan table drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const handleMouseUp = () => onUp()
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      if (!drag.current && !resize.current && !resizeCanvasDrag.current) return
      e.preventDefault()
      onMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const handleTouchEnd = () => onUp()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  // Container listeners untuk table drag/resize (hanya di edit mode)
  useEffect(() => {
    if (!editing || !containerRef.current) return
    const c = containerRef.current

    const onDown = (clientX: number, clientY: number, target: EventTarget | null) => {
      const el = (target as HTMLElement).closest('[data-id]') as HTMLElement | null
      if (!el) return
      const id = Number(el.dataset.id)
      const item = itemsRef.current.find((it: any) => it.id === id)
      if (!item) return

      const shapeBtn = (target as HTMLElement).closest('[data-shape]')
      if (shapeBtn) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, shape: it.shape === 'circle' ? 'rectangle' : 'circle' } : it))
        setDirty(true)
        return
      }

      const rHandle = (target as HTMLElement).closest('[data-r]') as HTMLElement | null
      if (rHandle) {
        resize.current = { id, dir: rHandle.dataset.r!, sx: clientX, sy: clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h }
        return
      }

      drag.current = { id, sx: clientX, sy: clientY, ox: item.x, oy: item.y }
    }

    const handleMouseDown = (e: MouseEvent) => { e.preventDefault(); onDown(e.clientX, e.clientY, e.target) }
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const el = (e.target as HTMLElement).closest('[data-id]')
      if (!el) return
      e.preventDefault()
      onDown(e.touches[0].clientX, e.touches[0].clientY, e.target)
    }

    c.addEventListener('mousedown', handleMouseDown)
    c.addEventListener('touchstart', handleTouchStart, { passive: false })

    return () => {
      c.removeEventListener('mousedown', handleMouseDown)
      c.removeEventListener('touchstart', handleTouchStart)
    }
  }, [editing])

  if (!editing) {
    // Group tables by floor for per-floor auto-positioning
    const tablesByFloor = new Map<number | null, TableItem[]>()
    for (const t of tables) {
      const fid = t.floor_id ?? null
      if (!tablesByFloor.has(fid)) tablesByFloor.set(fid, [])
      tablesByFloor.get(fid)!.push(t)
    }
    
    // Auto-position tables with default (0,0) positions per floor
    const positionedTables: TableItem[] = []
    for (const [, floorTables] of tablesByFloor) {
      for (let idx = 0; idx < floorTables.length; idx++) {
        const t = floorTables[idx]
        const hasCustomPos = (t.pos_x ?? 0) !== 0 || (t.pos_y ?? 0) !== 0
        if (hasCustomPos) {
          positionedTables.push(t)
        } else {
          // Grid layout: 4 columns, 160px spacing
          const col = idx % 4
          const row = Math.floor(idx / 4)
          positionedTables.push({
            ...t,
            pos_x: 20 + col * 160,
            pos_y: 20 + row * 140,
          })
        }
      }
    }
    const viewTables = positionedTables

    function getTableCenter(t: TableItem, zoom: number = 1) {
      const cap = Math.max(1, t.capacity ?? 4)
      const tblW = cap <= 2 ? 100 : cap <= 4 ? 120 : cap <= 6 ? 160 : cap <= 8 ? 180 : 220
      const tblH = 90
      const chairH = cap >= 10 ? 14 : cap >= 6 ? 12 : 10
      const chairGap = 10
      const hasSide = cap === 6 || cap === 8 || cap >= 10
      const offsetX = hasSide ? chairGap + chairH : 0
      const offsetY = chairGap + chairH
      return {
        x: ((t.pos_x ?? 0) + offsetX + tblW / 2) * zoom,
        y: ((t.pos_y ?? 0) + offsetY + tblH / 2) * zoom,
      }
    }

    const groups: { id: number; name: string; tables: TableItem[]; width: number; height: number }[] = []
    if (selectedFloorId) {
      const floor = floors.find(f => f.id === selectedFloorId)
      const ft = viewTables.filter(t => t.floor_id === selectedFloorId)
      const maxX = Math.max(...ft.map(t => (t.pos_x ?? 0) + (t.width ?? 100)), 0)
      const maxY = Math.max(...ft.map(t => (t.pos_y ?? 0) + (t.height ?? 100)), 0)
      groups.push({ id: selectedFloorId, name: floor?.name || '', tables: ft, width: Math.max(maxX + 80, 300), height: Math.max(maxY + 50, 200) })
    } else {
      const fIds = [...new Set(viewTables.map(t => t.floor_id ?? 0))]
      for (const fid of fIds) {
        const ft = viewTables.filter(t => (t.floor_id ?? 0) === fid)
        const floor = floors.find(f => f.id === fid)
        const maxX = Math.max(...ft.map(t => (t.pos_x ?? 0) + (t.width ?? 100)), 0)
        const maxY = Math.max(...ft.map(t => (t.pos_y ?? 0) + (t.height ?? 100)), 0)
        groups.push({ id: fid, name: floor?.name || 'Tanpa lantai', tables: ft, width: Math.max(maxX + 80, 300), height: Math.max(maxY + 50, 200) })
      }
      groups.sort((a, b) => (floors.find(f => f.id === a.id)?.levelNo ?? 999) - (floors.find(f => f.id === b.id)?.levelNo ?? 999))
    }

    return (
      <div className="space-y-3">
        {groups.map(g => {
          const z = getZoom(g.id)
          return (
          <div key={g.id} className="relative">
            <div className="lg:hidden grid grid-cols-1 min-[640px]:grid-cols-2 min-[900px]:grid-cols-3 gap-2">
              {g.tables.map((t, idx) => {
                const st = getTableStatus(t, idx)
                const cap = Math.max(1, t.capacity ?? 4)
                const activeMode = moveMode || mergeMode
                const isSourceTable = !!activeMode && t.id === activeMode.fromTableId
                const sourceTable = activeMode ? viewTables.find(s => s.id === activeMode.fromTableId) : null
                const isValidTarget = !!activeMode && !isSourceTable && sourceTable && sourceTable.floor_id === t.floor_id && (!moveMode || st.badgeText === 'Avail')
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`relative min-h-[108px] bg-white rounded-xl border flex items-center justify-center ${st.border} ${activeTableId === t.id ? 'ring-2 ring-violet-500 ring-offset-1' : ''} ${isSourceTable ? 'ring-2 ring-amber-400 ring-offset-1' : ''} ${isValidTarget ? 'ring-2 ring-teal-300 hover:ring-4' : ''} ${loadingTableId === t.id ? 'opacity-60 pointer-events-none' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onTableClick?.(t) }}
                    disabled={loadingTableId === t.id}
                  >
                    {renderTableCard(t, activeTableId === t.id, st, cap, false)}
                  </button>
                )
              })}
              {g.tables.length === 0 && <div className="col-span-full py-8 text-center text-xs text-slate-400">Belum ada meja di lantai ini</div>}
            </div>
            <div className="relative hidden lg:block rounded-lg border border-[#E8F6F5]" style={{ background: floorBgMap?.[g.id] || '#EFF8F7', minWidth: '100%' }} onClick={() => onTableClick?.(null)}
              onMouseLeave={() => setHoveredTargetId(null)}>
              <div style={{ width: g.width * z, minHeight: Math.max(g.height * z, getResizeH(g.id)) }} />
              <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                <button onClick={() => setZoom(g.id, getZoom(g.id) - 0.1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg text-sm font-bold leading-none shadow-sm">−</button>
                <span className="text-xs font-semibold text-slate-600 w-10 text-center bg-white/80 rounded px-1">{Math.round(getZoom(g.id) * 100)}%</span>
                <button onClick={() => setZoom(g.id, getZoom(g.id) + 0.1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg text-sm font-bold leading-none shadow-sm">+</button>
                <button onClick={() => setZoom(g.id, 1)} className="px-2 py-0.5 text-[10px] rounded-pill border border-slate-300 text-slate-500 hover:bg-slate-100 ml-1 bg-white/80 shadow-sm">Reset</button>
              </div>
              {(() => {
                const activeMode = moveMode || mergeMode
                const isMoveMode = !!moveMode
                return (<>
              {activeMode && hoveredTargetId && (() => {
                if (hoveredTargetId === activeMode.fromTableId) return null
                const src = viewTables.find(t => t.id === activeMode.fromTableId)
                const tgt = g.tables.find(t => t.id === hoveredTargetId)
                if (!src || !tgt) return null
                const srcCenter = getTableCenter(src, z)
                const tgtCenter = getTableCenter(tgt, z)
                const dx = tgtCenter.x - srcCenter.x
                const dy = tgtCenter.y - srcCenter.y
                const length = Math.sqrt(dx * dx + dy * dy)
                const angle = Math.atan2(dy, dx) * 180 / Math.PI
                const lineColor = isMoveMode ? '#14B8A6' : '#6366F1'
                return (
                  <div className="absolute pointer-events-none z-0"
                    style={{
                      left: srcCenter.x, top: srcCenter.y,
                      width: length, height: 2,
                      background: `repeating-linear-gradient(90deg, ${lineColor} 0px, ${lineColor} 6px, transparent 6px, transparent 10px)`,
                      opacity: 0.7,
                      transformOrigin: '0 0',
                      transform: `rotate(${angle}deg)`,
                    }}
                  />
                )
              })()}
              {g.tables.map((t, idx) => {
                const st = getTableStatus(t, idx)
                const isActive = activeTableId === t.id
                const isCircle = false
                const cap = Math.max(1, t.capacity ?? 4)
                const tblW = cap <= 2 ? 100 : cap <= 4 ? 120 : cap <= 6 ? 160 : cap <= 8 ? 180 : 220
                const tblH = 90
                const chairW = cap >= 10 ? 32 : cap >= 6 ? 28 : 24
                const chairH = cap >= 10 ? 14 : cap >= 6 ? 12 : 10
                const chairGap = 10
                const hasSide = cap === 6 || cap === 8 || cap >= 10
                const chairsPerRow = hasSide ? Math.floor((cap - 2) / 2) : Math.ceil(cap / 2)
                const rowSpacing = chairH + 4
                const offsetX = hasSide ? chairGap + chairH : 0
                const offsetY = chairGap + chairH
                const isSourceTable = activeMode && t.id === activeMode.fromTableId
                const srcTable = activeMode ? viewTables.find(s => s.id === activeMode.fromTableId) : null
                const isValidTarget = activeMode && !isSourceTable && srcTable && srcTable.floor_id === t.floor_id && (!isMoveMode || st.badgeText === 'Avail')
                const chairPositions = (() => {
                  const w = tblW * z, h = tblH * z
                  const cW = chairW * z, cH = chairH * z
                  const cGap = chairGap * z
                  const p: { x: number; y: number }[] = []
                  const topY = -cGap - cH
                  const bottomY = h + cGap
                  const spacing = w / (chairsPerRow + 1)
                  for (let i = 1; i <= chairsPerRow; i++) {
                    p.push({ x: spacing * i, y: topY })
                    p.push({ x: spacing * i, y: bottomY })
                  }
                  if (hasSide) {
                    const sideY = (h - cH) / 2
                    p.push({ x: -cGap - cH / 2, y: sideY })
                    p.push({ x: w + cGap + cH / 2, y: sideY })
                  }
                  return p
                })()
                return (
                  <button key={t.id} type="button"
                    className={`bg-white flex flex-col items-center justify-center transition-all z-10 ${st.border} ${isCircle ? 'rounded-full' : 'rounded-xl'} ${loadingTableId === t.id ? 'opacity-60 pointer-events-none' : ''} ${isActive ? 'ring-[3px] ring-[#8B5CF6] ring-offset-2 ring-offset-slate-100 scale-[1.04] shadow-lg' : ''} ${isSourceTable ? (isMoveMode ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-100' : 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-100') : ''} ${isValidTarget ? (isMoveMode ? 'ring-2 ring-teal-300 ring-offset-1 ring-offset-slate-100 hover:ring-4 hover:ring-teal-400 hover:bg-teal-50 cursor-pointer group' : 'ring-2 ring-indigo-300 ring-offset-1 ring-offset-slate-100 hover:ring-4 hover:ring-indigo-400 hover:bg-indigo-50 cursor-pointer group') : ''}`}
                    style={{
                      position: 'absolute', left: ((t.pos_x ?? 0) + offsetX) * z, top: ((t.pos_y ?? 0) + offsetY) * z, width: tblW * z, height: tblH * z,
                      boxShadow: isActive ? undefined : st.badgeText === 'In Use' ? '0 4px 20px rgba(255,210,63,0.3)' : st.badgeText === 'Bill' ? '0 4px 16px rgba(93,173,226,0.3)' : '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    onClick={(e) => { e.stopPropagation(); onTableClick?.(t) }}
                    onMouseEnter={() => { if (isValidTarget) setHoveredTargetId(t.id) }}
                    onMouseLeave={() => { if (isValidTarget) setHoveredTargetId(null) }}
                    disabled={loadingTableId === t.id}
                  >
                    <div className="relative flex flex-col items-center justify-center w-full h-full">
        {chairPositions.map((pos, i) => {
                        const isSide = pos.x < 0 || pos.x > tblW * z
                        const cW = chairW * z, cH = chairH * z
                        return (
                          <div key={i} className="absolute rounded-full border border-slate-400/50"
                            style={{ left: pos.x - cW / 2, top: pos.y, width: cW, height: cH, transform: isSide ? 'rotate(90deg)' : 'none', backgroundColor: `rgba(255,255,255,${chairOpacity / 100})` }} />
                        )
                      })}
                      <span className="font-bold text-base text-slate-800 leading-tight">{t.code}</span>
                      <span className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: st.indicatorColor }} />
                      {st.badgeText === 'Avail' && (
                        <span className="text-[10px] text-slate-500 mt-1">{cap} Seat</span>
                      )}
                      {st.guestCount && st.badgeText !== 'Avail' && (
                        <div className="flex flex-col items-center mt-1">
                          <span className="text-[10px] text-black font-medium"><strong className="text-black">{st.guestCount}</strong> Orang</span>
                          {st.timerText && <span className="text-[9px] text-black font-medium mt-0.5">{st.timerText}</span>}
                        </div>
                      )}
                      {isSourceTable && (
                        <span className={`absolute -bottom-5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold whitespace-nowrap ${isMoveMode ? 'bg-amber-100 border border-amber-300 text-amber-700' : 'bg-indigo-100 border border-indigo-300 text-indigo-700'}`}>Sumber</span>
                      )}
                      {isValidTarget && (
                        <span className={`absolute -bottom-5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${isMoveMode ? 'bg-teal-100 border border-teal-300 text-teal-700' : 'bg-indigo-100 border border-indigo-300 text-indigo-700'}`}>{isMoveMode ? 'Klik untuk pindah' : 'Klik untuk gabung'}</span>
                      )}
                    </div>
                    {loadingTableId === t.id && (
                      <div className={`absolute inset-0 ${isCircle ? 'rounded-full' : 'rounded-xl'} bg-white/60 flex items-center justify-center`}>
                        <div className="h-5 w-5 border-2 border-slate-300 border-t-[#8B5CF6] rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                )
              })}
              </>)})()}
            </div>
            <div
              className="hidden lg:flex h-5 items-center justify-center cursor-s-resize group select-none"
              onMouseDown={(e) => {
                e.preventDefault()
                resizeCanvasDrag.current = { startY: e.clientY, startH: Math.max(g.height, getResizeH(g.id)), floorId: g.id }
              }}
              onTouchStart={(e) => {
                if (e.touches.length !== 1) return
                resizeCanvasDrag.current = { startY: e.touches[0].clientY, startH: Math.max(g.height, getResizeH(g.id)), floorId: g.id }
              }}
            >
              <div className="w-16 h-1 rounded-full bg-slate-300 group-hover:bg-teal-primary group-active:bg-teal-dark transition-colors" />
            </div>
          </div>
        )})}
      </div>
    )
  }

  const floorSections: { id: number; name: string; items: typeof items; height: number }[] = []
  const floorIds = selectedFloorId ? [selectedFloorId] : [...new Set(items.map(it => it.floor_id ?? 0))]
  for (const fid of floorIds) {
    const floor = floors.find(f => f.id === fid)
    const ft = items.filter(it => (it.floor_id ?? 0) === fid)
    const maxExtent = Math.max(...ft.map(it => {
      const t = tables.find(tbl => tbl.id === it.id)
      const cap = Math.max(1, t?.capacity ?? 4)
      const tblH = 90
      const chairH = cap >= 10 ? 14 : cap >= 6 ? 12 : 10
      const chairGap = 10
      const offsetY = chairGap + chairH
      return it.y + tblH + offsetY + 10
    }), 0)
    floorSections.push({
      id: fid, name: floor?.name || 'Tanpa lantai', items: ft, height: Math.max(maxExtent, 200),
    })
  }
  floorSections.sort((a, b) => (floors.find(f => f.id === a.id)?.levelNo ?? 999) - (floors.find(f => f.id === b.id)?.levelNo ?? 999))

  return (
    <div ref={containerRef}>
      {floorSections.map(s => (
        <div key={s.id} className="mb-4">
          {!selectedFloorId && (
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1 pb-2 mb-3 border-b-2 border-dashed" style={{ borderColor: '#2BA8A260' }}>{s.name}</div>
          )}
          <div className="flex items-center justify-end gap-1 mb-1">
            <button onClick={() => setZoom(s.id, getZoom(s.id) - 0.1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg text-sm font-bold leading-none">−</button>
            <span className="text-xs font-semibold text-slate-600 w-10 text-center">{Math.round(getZoom(s.id) * 100)}%</span>
            <button onClick={() => setZoom(s.id, getZoom(s.id) + 0.1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-teal-primary text-teal-primary bg-white hover:bg-teal-bg text-sm font-bold leading-none">+</button>
            <button onClick={() => setZoom(s.id, 1)} className="px-2 py-0.5 text-[10px] rounded-pill border border-slate-300 text-slate-500 hover:bg-slate-100 ml-1">Reset</button>
          </div>
          <div className="relative select-none rounded-lg border border-[#E8F6F5]" style={{ background: floorBgMap?.[s.id] || '#EFF8F7', height: Math.max(s.height, getResizeH(s.id)), userSelect: 'none' }}>
            {snapGuidesRef.current.map((g, i) => (
              g.axis === 'v' ? (
                <div key={i} className="absolute inset-y-0 pointer-events-none" style={{ left: g.pos, zIndex: 30 }}>
                  <div className="h-full border-l border-dashed border-teal-primary" />
                  {g.label && <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-teal-primary text-white text-[9px] px-1 py-0.5 rounded whitespace-nowrap">{g.label}</div>}
                </div>
              ) : (
                <div key={i} className="absolute inset-x-0 pointer-events-none" style={{ top: g.pos, zIndex: 30 }}>
                  <div className="w-full border-t border-dashed border-teal-primary" />
                  {g.label && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-primary text-white text-[9px] px-1 py-0.5 rounded whitespace-nowrap">{g.label}</div>}
                </div>
              )
            ))}
            {s.items.map((it: any) => {
              const t = tables.find(tbl => tbl.id === it.id) || it
              const cap = Math.max(1, t.capacity ?? 4)
              const tblW = cap <= 2 ? 100 : cap <= 4 ? 120 : cap <= 6 ? 160 : cap <= 8 ? 180 : 220
              const tblH = 90
              const chairH = cap >= 10 ? 14 : cap >= 6 ? 12 : 10
              const chairGap = 10
              const hasSide = cap === 6 || cap === 8 || cap >= 10
              const offsetY = chairGap + chairH
              const offsetX = hasSide ? chairGap + chairH : 0
              const graySt: TableStatus = { bg: 'bg-white', border: 'border-slate-300', textColor: 'text-slate-400', badgeText: '', badgeClass: '', indicatorColor: '#D1D5DB', timerText: undefined }
              return (
                <div key={it.id} data-id={it.id}
                  style={{ position: 'absolute', left: it.x + offsetX, top: it.y + offsetY, width: tblW, height: tblH, transform: `scale(${getZoom(s.id)})`, transformOrigin: 'top left' }}
                  className={`bg-white flex flex-col items-center justify-center rounded-xl z-20 cursor-grab shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-slate-300 ${loadingTableId === t.id ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {renderTableCard(t, false, graySt, cap)}
                </div>
              )
            })}
          </div>
          <div
            className="h-5 flex items-center justify-center cursor-s-resize group select-none"
            onMouseDown={(e) => {
              e.preventDefault()
              resizeCanvasDrag.current = { startY: e.clientY, startH: Math.max(s.height, getResizeH(s.id)), floorId: s.id }
            }}
            onTouchStart={(e) => {
              if (e.touches.length !== 1) return
              resizeCanvasDrag.current = { startY: e.touches[0].clientY, startH: Math.max(s.height, getResizeH(s.id)), floorId: s.id }
            }}
          >
            <div className="w-16 h-1 rounded-full bg-slate-300 group-hover:bg-teal-primary group-active:bg-teal-dark transition-colors" />
          </div>
        </div>
      ))}
    </div>
  )
}
