import type { HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

/** A surface panel — the tangible "artifact" look used for cards across the app. */
export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-hatch-border bg-hatch-surface shadow-sm',
        interactive &&
          'cursor-pointer transition-colors hover:border-hatch-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-hatch-accent/60',
        className
      )}
      {...props}
    />
  )
}
