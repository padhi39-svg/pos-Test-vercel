import clsx from 'clsx'
import { InputHTMLAttributes, forwardRef } from 'react'

const FieldInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function FieldInput(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={clsx(
        'w-full px-2 py-1.5 border rounded-lg text-xs outline-none transition-colors',
        props.disabled
          ? 'bg-slate-100 border-slate-300 text-slate-500 placeholder-slate-400 cursor-not-allowed'
          : 'bg-white border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2] placeholder:text-slate-400',
        props.readOnly && !props.disabled && 'cursor-pointer',
        className
      )}
      {...props}
    />
  )
})

export default FieldInput
