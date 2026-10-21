"use client"

import { InputHTMLAttributes, useState } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export default function Checkbox({ className, checked: controlledChecked, onChange, label, ...props }: Props) {
  const [internalChecked, setInternalChecked] = useState(false)
  const isChecked = controlledChecked ?? internalChecked

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (controlledChecked === undefined) setInternalChecked(e.target.checked)
    onChange?.(e)
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className || ''}`}>
      <input type="checkbox" className="sr-only" checked={isChecked} onChange={handleChange} {...props} />
      <span
        role="checkbox"
        aria-checked={isChecked}
        tabIndex={0}
        onClick={() => {
          const newChecked = !isChecked
          if (controlledChecked === undefined) setInternalChecked(newChecked)
          onChange?.({ target: { checked: newChecked } } as React.ChangeEvent<HTMLInputElement>)
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            const newChecked = !isChecked
            if (controlledChecked === undefined) setInternalChecked(newChecked)
            onChange?.({ target: { checked: newChecked } } as React.ChangeEvent<HTMLInputElement>)
          }
        }}
        className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
          isChecked
            ? 'bg-teal-primary border-teal-primary'
            : 'bg-white border-slate-300'
        }`}
      >
        {isChecked && (
          <svg className="w-3 h-3 text-white pointer-events-none" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && <span className="text-slate-700 text-sm select-none">{label}</span>}
    </span>
  )
}
