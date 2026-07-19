import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-hatch-border bg-hatch-bg px-3 py-2 text-sm text-hatch-text transition-colors focus:border-hatch-accent focus:outline-none focus:ring-1 focus:ring-hatch-accent/50 disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})
