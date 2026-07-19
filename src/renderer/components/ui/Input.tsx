import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

const BASE =
  'w-full rounded-md border border-hatch-border bg-hatch-bg px-3 py-2 text-sm text-hatch-text placeholder:text-hatch-muted transition-colors focus:border-hatch-accent focus:outline-none focus:ring-1 focus:ring-hatch-accent/50 disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(BASE, className)} {...props} />
})

export interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

/** Labeled form field wrapper for consistent spacing and hint text. */
export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-hatch-text">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-hatch-muted">{hint}</p>}
    </div>
  )
}
