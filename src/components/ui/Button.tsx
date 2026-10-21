import clsx from 'clsx'
import { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'filled' | 'outline'
}

export default function Button({ variant = 'filled', className, ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'filled'
          ? 'bg-teal-primary hover:bg-teal-dark text-white shadow-[0_4px_20px_rgba(43,168,162,0.3)]'
          : 'border border-teal-primary text-teal-primary bg-transparent hover:bg-teal-bg',
        className
      )}
      {...props}
    />
  )
}
