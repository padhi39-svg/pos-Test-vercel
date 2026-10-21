import clsx from 'clsx'
import { InputHTMLAttributes, forwardRef } from 'react'

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, style, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors',
        'border-slate-300 bg-white hover:border-slate-400',
        'focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]',
        'placeholder:text-slate-400',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100',
        className
      )}
      style={style}
      {...props}
    />
  )
})

export default Input
