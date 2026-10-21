"use client"
import { useState, useMemo, useCallback, useEffect } from "react"

export interface GroupNode {
  depth: number
  path: string
  value: string
  key: string
  label: string
  children: GroupNode[]
  rows: any[]
}

export function useGroupBy(
  rows: any[],
  allColumns: readonly { key: string; label: string }[],
) {
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const columnLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    allColumns.forEach(c => { map[c.key] = c.label })
    return map
  }, [allColumns])

  const groupedTree = useMemo(() => {
    if (groupBy.length === 0) return []
    return buildTree(rows, groupBy, 0, "", columnLabelMap)
  }, [rows, groupBy, columnLabelMap])

  useEffect(() => {
    setCollapsedPaths(new Set())
  }, [groupBy])

  const addGroupBy = useCallback((key: string) => {
    setGroupBy(prev => prev.includes(key) ? prev : [...prev, key])
  }, [])

  const addGroupByAt = useCallback((key: string, index: number) => {
    setGroupBy(prev => {
      const next = prev.filter(k => k !== key)
      next.splice(index, 0, key)
      return next
    })
  }, [])

  const removeGroupBy = useCallback((key: string) => {
    setGroupBy(prev => prev.filter(k => k !== key))
  }, [])

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }, [])

  const allPaths = useMemo(() => {
    const paths: string[] = []
    function walk(nodes: GroupNode[]) {
      for (const n of nodes) {
        paths.push(n.path)
        walk(n.children)
      }
    }
    walk(groupedTree)
    return paths
  }, [groupedTree])

  const collapseAll = useCallback(() => {
    setCollapsedPaths(new Set(allPaths))
  }, [allPaths])

  const expandAll = useCallback(() => {
    setCollapsedPaths(new Set())
  }, [])

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortOrder(o => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortOrder("asc")
    }
  }, [sortKey])

  const sortFn = useCallback((a: any, b: any, key: string, dir: number) => {
    const av = a[key]
    const bv = b[key]
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
    const sa = String(av ?? "").toLowerCase()
    const sb = String(bv ?? "").toLowerCase()
    if (sa < sb) return -1 * dir
    if (sa > sb) return 1 * dir
    return 0
  }, [])

  const sortedTree = useMemo(() => {
    if (groupBy.length === 0 || groupedTree.length === 0) return []
    const dir = sortOrder === "asc" ? 1 : -1

    function sortNodes(nodes: GroupNode[]): GroupNode[] {
      const sorted = nodes.map(node => ({
        ...node,
        children: sortNodes(node.children),
        rows: groupBy.includes(sortKey)
          ? node.rows
          : [...node.rows].sort((a, b) => sortFn(a, b, sortKey, dir)),
      }))

      if (sorted.length > 0 && groupBy[sorted[0].depth] === sortKey) {
        sorted.sort((a, b) => sortFn(a.rows[0], b.rows[0], sortKey, dir))
      }

      return sorted
    }

    return sortNodes(groupedTree)
  }, [groupedTree, sortKey, sortOrder, groupBy, sortFn])

  const sortedRows = useMemo(() => {
    if (rows.length === 0) return []
    const dir = sortOrder === "asc" ? 1 : -1
    return [...rows].sort((a, b) => sortFn(a, b, sortKey, dir))
  }, [rows, sortKey, sortOrder, sortFn])

  const onHeaderDragStart = useCallback((e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("text/plain", key)
    e.dataTransfer.effectAllowed = "copy"
  }, [])

  const onDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const key = e.dataTransfer.getData("text/plain")
    if (key) addGroupBy(key)
  }, [addGroupBy])

  const onDropZoneDropAt = useCallback((key: string, index: number) => {
    if (key) addGroupByAt(key, index)
  }, [addGroupByAt])

  return {
    groupBy,
    collapsedPaths,
    groupedTree,
    sortedTree,
    sortKey,
    sortOrder,
    sortedRows,
    allPaths,
    addGroupBy,
    addGroupByAt,
    removeGroupBy,
    toggleCollapse,
    collapseAll,
    expandAll,
    toggleSort,
    onHeaderDragStart,
    onDropZoneDrop,
    onDropZoneDropAt,
  }
}

function buildTree(
  rows: any[],
  groupByKeys: string[],
  depth: number,
  parentPath: string,
  columnLabelMap: Record<string, string>,
): GroupNode[] {
  if (depth >= groupByKeys.length) return []
  const key = groupByKeys[depth]
  const label = columnLabelMap[key] || key

  const map = new Map<string, any[]>()
  rows.forEach(row => {
    const val = String(row[key] ?? "")
    if (!map.has(val)) map.set(val, [])
    map.get(val)!.push(row)
  })

  return Array.from(map.entries()).map(([val, groupRows]) => {
    const path = parentPath ? `${parentPath}|${val}` : val
    return {
      depth,
      path,
      value: val,
      key,
      label: `${label}: ${val}`,
      children: buildTree(groupRows, groupByKeys, depth + 1, path, columnLabelMap),
      rows: groupRows,
    }
  })
}
