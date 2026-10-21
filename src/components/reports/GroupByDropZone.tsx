"use client"

const MAX_LEVELS = 3

interface GroupByDropZoneProps {
  groupBy: string[]
  allColumns: readonly { key: string; label: string }[]
  onDropAt: (key: string, index: number) => void
  onRemove: (key: string) => void
  onCollapseAll?: () => void
  onExpandAll?: () => void
  hasGroups?: boolean
}

export default function GroupByDropZone({
  groupBy,
  allColumns,
  onDropAt,
  onRemove,
  onCollapseAll,
  onExpandAll,
  hasGroups,
}: GroupByDropZoneProps) {
  const levels = Math.max(1, Math.min(groupBy.length + 1, MAX_LEVELS))

  return (
    <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-slate-300 transition-colors">
      <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-dashed border-slate-200">
        <div className="flex items-center gap-2 flex-wrap text-xs min-h-[28px]">
          <span className="text-slate-500 font-medium">Group by:</span>
          {groupBy.length === 0 && (
            <span className="text-slate-400 italic">Tarik kolom ke sini</span>
          )}
          {groupBy.map((key, idx) => {
            const col = allColumns.find(c => c.key === key)
            return (
              <span key={key}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-teal-bg text-teal-primary font-medium shadow-sm"
              >
                <span className="text-[10px] text-teal-primary font-bold mr-0.5">{idx + 1}</span>
                {col?.label || key}
                <button
                  onClick={() => onRemove(key)}
                  className="ml-0.5 w-3.5 h-3.5 rounded-full hover:bg-teal-bg inline-flex items-center justify-center leading-none text-teal-primary hover:text-teal-dark"
                >×</button>
              </span>
            )
          })}
        </div>
        {hasGroups && groupBy.length > 0 && onCollapseAll && onExpandAll && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onCollapseAll}
              className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200"
              title="Collapse All"
            >⟱ All</button>
            <button
              onClick={onExpandAll}
              className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200"
              title="Expand All"
            >⟰ All</button>
          </div>
        )}
      </div>
      {Array.from({ length: levels }).map((_, levelIdx) => {
        const filled = levelIdx < groupBy.length
        const key = filled ? groupBy[levelIdx] : null
        const col = key ? allColumns.find(c => c.key === key) : null
        const isLastEmpty = levelIdx === levels - 1 && !filled

        return (
          <div
            key={levelIdx}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy" }}
            onDrop={e => {
              e.preventDefault()
              const k = e.dataTransfer.getData("text/plain")
              if (k) onDropAt(k, levelIdx)
            }}
            className={`flex items-center gap-2 px-3 py-1 text-xs transition-colors ${
              !filled ? "hover:bg-teal-bg/50 cursor-copy" : ""
            } ${levelIdx > 0 ? "border-t border-dashed border-slate-100" : ""}`}
          >
            <span className="text-[10px] text-slate-400 font-mono w-5 shrink-0 text-right">
              {levelIdx + 1}
            </span>
            {filled ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-slate-600">
                {col?.label || key}
              </span>
            ) : (
              <span className={`text-slate-300 italic ${isLastEmpty ? "" : ""}`}>
                {isLastEmpty && groupBy.length < MAX_LEVELS
                  ? "drop here"
                  : "drop here"}
              </span>
            )}
            <div className="flex-1 min-h-[24px]" />
          </div>
        )
      })}
    </div>
  )
}
