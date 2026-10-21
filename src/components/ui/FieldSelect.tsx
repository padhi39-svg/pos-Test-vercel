import clsx from 'clsx'
import { SelectHTMLAttributes, forwardRef } from 'react'

const FieldSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function FieldSelect(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={clsx(
        'w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none transition-colors',
        'bg-white hover:border-slate-400',
        'focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})

export default FieldSelect
