import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label — icon-only buttons must have one. */
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-hatch-muted transition-colors hover:bg-hatch-surface-2 hover:text-hatch-text focus:outline-none focus-visible:ring-2 focus-visible:ring-hatch-accent/60 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
