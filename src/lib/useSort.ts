import { useMemo, useState } from 'react'

export type SortOrder = 'asc' | 'desc'
export type SortKey<T> = keyof T | ((row: T) => any)

export function useSort<T>(rows: T[], defaultKey?: SortKey<T>, defaultOrder: SortOrder = 'asc') {
  const [sortKey, setSortKey] = useState<SortKey<T> | undefined>(defaultKey)
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultOrder)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const keyFn: (row: T) => any = typeof sortKey === 'function' ? sortKey : (row: any) => row[sortKey as keyof T]
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = keyFn(a)
      const vb = keyFn(b)
      if (va == null && vb == null) return 0
      if (va == null) return sortOrder === 'asc' ? -1 : 1
      if (vb == null) return sortOrder === 'asc' ? 1 : -1
      if (typeof va === 'number' && typeof vb === 'number') return sortOrder === 'asc' ? va - vb : vb - va
      const sa = String(va).toLowerCase()
      const sb = String(vb).toLowerCase()
      if (sa < sb) return sortOrder === 'asc' ? -1 : 1
      if (sa > sb) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortOrder])

  const toggleSort = (key: SortKey<T>) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  return { sorted, sortKey, sortOrder, toggleSort, setSortKey, setSortOrder }
}
