"use client"

import TableGrid, { TableItem, FloorItem } from './TableGrid'

interface Props {
  tables: TableItem[]; editing: boolean; onSave: (l: any[]) => void
  onTableClick: (t: TableItem | null) => void; onTableDoubleClick: (t: TableItem) => Promise<void>
  activeTableId: number | null; openTempsByTable: Record<number, any>
  selectedFloorId: number | null; floors: FloorItem[]; navigatingTableId: number | null
  saveTrigger?: number
  moveMode?: { fromTableId: number; tempId: number } | null
  mergeMode?: { fromTableId: number; tempId: number } | null
  floorBgMap?: Record<number, string>
  chairOpacity?: number
  showSourceBadge?: boolean
}

function getElapsedText(createdAt: string | undefined | null): string {
  if (!createdAt) return ''
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  if (diffMs < 0) return ''
  const totalSeconds = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function posTableStatus(t: TableItem, _idx: number, openTempsByTable: Record<number, any>) {
  const temp = openTempsByTable[t.id]
  const isBill = temp?.status === 'bill'
  const isOccupied = !!temp && !isBill
    if (isBill) return {
    bg: 'bg-white', border: 'border-[3px] border-blue-500', textColor: 'text-blue-600',
    badgeText: 'Bill', badgeClass: 'bg-blue-200 text-blue-800',
    indicatorColor: '#5DADE2',
    timerText: getElapsedText(temp?.created_at),
    guestCount: temp?.guest_count,
    qr: temp?.source === 'qr',
  }
  if (isOccupied) return {
    bg: 'bg-white', border: 'border-[3px] border-amber-500', textColor: 'text-amber-600',
    badgeText: 'In Use', badgeClass: 'bg-amber-200 text-amber-800',
    indicatorColor: '#F59E0B',
    timerText: getElapsedText(temp?.created_at),
    guestCount: temp?.guest_count,
    qr: temp?.source === 'qr',
  }
  return {
    bg: 'bg-white', border: 'border-[3px] border-green-500', textColor: 'text-emerald-600',
    badgeText: 'Avail', badgeClass: 'bg-green-200 text-green-800',
    indicatorColor: '#10B981',
    timerText: undefined,
    guestCount: undefined,
    qr: temp?.source === 'qr',
  }
}

export default function TableCanvas({
  tables, editing, onSave, onTableClick, onTableDoubleClick,
  activeTableId, openTempsByTable, selectedFloorId, floors, navigatingTableId, moveMode, mergeMode, saveTrigger, floorBgMap, chairOpacity, showSourceBadge,
}: Props) {
  return (
    <div className="space-y-3">
      <TableGrid
        tables={tables}
        floors={floors}
        selectedFloorId={selectedFloorId}
        activeTableId={activeTableId}
        loadingTableId={navigatingTableId}
        editing={editing}
        moveMode={moveMode}
        mergeMode={mergeMode}
        saveTrigger={saveTrigger}
        floorBgMap={floorBgMap}
        onSaveLayout={onSave}
        onTableClick={onTableClick}
        onTableDoubleClick={(t) => onTableDoubleClick(t)}
        getTableStatus={(t) => posTableStatus(t, 0, openTempsByTable)}
        chairOpacity={chairOpacity}
        showSourceBadge={showSourceBadge}
      />
    </div>
  )
}
