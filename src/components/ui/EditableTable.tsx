"use client"
import React from 'react'
import Input from '@/components/ui/Input'

export type EditableColumnDef = {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'number'
  className?: string
  render?: (value: any, row: Record<string, any>, index: number, onUpdate: (key: string, value: any) => void) => React.ReactNode
}

type Props = {
  title: string
  columns: EditableColumnDef[]
  items: Record<string, any>[]
  onUpdate: (index: number, key: string, value: any) => void
  onRemove: (index: number) => void
  onAdd: () => void
  addLabel?: string
  hint?: string
  readonly?: boolean
}

export default function EditableTable({
  title,
  columns,
  items,
  onUpdate,
  onRemove,
  onAdd,
  addLabel = '+ Tambah',
  hint,
  readonly = false,
}: Props) {
  return (
    <div className="border-t border-teal-bg pt-3">
      <div className="font-medium text-xs mb-2">{title}</div>
      <div className="border border-teal-bg rounded-card overflow-hidden">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white" style={{ height: 28, verticalAlign: 'middle' }}>
              {columns.map((col) => (
                <th key={col.key} className="text-left px-2 font-medium">{col.label}</th>
              ))}
              <th className="px-2 w-[1%] whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t border-teal-bg hover:bg-teal-bg/50" style={{ height: 38, verticalAlign: 'middle' }}>
                {columns.map((col) => (
                  <td key={col.key} className={`px-2 py-1 ${col.className || ''}`}>
                    {col.render
                      ? col.render(item[col.key], item, idx, (key, value) => onUpdate(idx, key, value))
                      : <Input
                          type={col.type || 'text'}
                          min={col.type === 'number' ? 1 : undefined}
                          value={String(item[col.key] ?? '')}
                          onChange={(e) => onUpdate(idx, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                          placeholder={col.placeholder || col.label}
                          disabled={readonly}
                        />
                    }
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-2 rounded text-red-600 bg-red-50 hover:text-red-800 hover:bg-red-100 flex items-center"
                    onClick={() => onRemove(idx)}
                    disabled={readonly}
                    title="Hapus"
                  >
                    <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        {hint && <p className="text-[10px] text-slate-500 mb-1">{hint}</p>}
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-pill border border-teal-primary text-teal-primary hover:bg-teal-bg text-sm"
          disabled={readonly}
        >
          {addLabel}
        </button>
      </div>
    </div>
  )
}
