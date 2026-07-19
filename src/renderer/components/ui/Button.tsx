import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-hatch-accent text-black font-medium hover:bg-hatch-accent-hover',
  secondary: 'border border-hatch-border bg-hatch-surface-2 text-hatch-text hover:border-hatch-muted',
  ghost: 'text-hatch-muted hover:bg-hatch-surface-2 hover:text-hatch-text',
  danger: 'bg-hatch-danger/90 text-white hover:bg-hatch-danger'
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base'
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hatch-accent/60 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
})
