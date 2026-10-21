import clsx from 'clsx'
import { SelectHTMLAttributes, forwardRef } from 'react'

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, style, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={clsx(
        'select-teal w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors',
        'border-slate-300 bg-white hover:border-slate-400',
        'focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100',
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </select>
  )
})

export default Select
