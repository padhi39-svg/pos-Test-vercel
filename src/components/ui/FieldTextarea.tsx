import clsx from 'clsx'
import { TextareaHTMLAttributes, forwardRef } from 'react'

const FieldTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function FieldTextarea(
  { className, style, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        'w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none transition-colors',
        'bg-white hover:border-slate-400',
        'focus:ring-2 focus:ring-[#E8F6F5] focus:border-[#2BA8A2]',
        'placeholder:text-slate-400',
        'min-h-[56px] resize-none',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100',
        className
      )}
      style={style}
      {...props}
    />
  )
})

export default FieldTextarea
