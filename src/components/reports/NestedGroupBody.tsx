"use client"
import type { GroupNode } from "./useGroupBy"

interface NestedGroupBodyProps {
  nodes: GroupNode[]
  visibleCols: string[]
  collapsedPaths: Set<string>
  toggleCollapse: (path: string) => void
  formatCell: (row: any, colKey: string) => string
  cellClass: (row: any, colKey: string) => string
}

export default function NestedGroupBody({
  nodes,
  visibleCols,
  collapsedPaths,
  toggleCollapse,
  formatCell,
  cellClass,
}: NestedGroupBodyProps) {
  return (
    <>
      {nodes.flatMap(node => {
        const isCollapsed = collapsedPaths.has(node.path)
        const indent = node.depth * 24

        const rows: React.ReactNode[] = [
          <tr
            key={`g-${node.path}`}
            className="bg-slate-50 border-t-2 border-slate-200 cursor-pointer hover:bg-slate-100/50"
            onClick={() => toggleCollapse(node.path)}
          >
            <td colSpan={visibleCols.length} className="px-2 py-1.5 text-xs font-semibold text-slate-700 select-none">
              <span className="inline-flex items-center gap-2" style={{ marginLeft: `${indent}px` }}>
                <span className="text-[10px] w-4 text-center">{isCollapsed ? "\u25B6" : "\u25BC"}</span>
                <span>{node.label}</span>
                <span className="text-slate-400 font-normal ml-1">({node.rows.length})</span>
              </span>
            </td>
          </tr>,
        ]

        if (!isCollapsed) {
          if (node.children.length > 0) {
            rows.push(
              <NestedGroupBody
                key={`c-${node.path}`}
                nodes={node.children}
                visibleCols={visibleCols}
                collapsedPaths={collapsedPaths}
                toggleCollapse={toggleCollapse}
                formatCell={formatCell}
                cellClass={cellClass}
              />
            )
          } else {
            node.rows.forEach((row, idx) => {
              rows.push(
                <tr
                  key={`r-${node.path}-${idx}`}
                  className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  {visibleCols.map(colKey => (
                    <td key={colKey} className={cellClass(row, colKey)}>
                      {formatCell(row, colKey)}
                    </td>
                  ))}
                </tr>
              )
            })
          }
        }

        return rows
      })}
    </>
  )
}
