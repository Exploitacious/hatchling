import type { HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-hatch-surface-2 text-hatch-muted border-hatch-border',
  accent: 'bg-hatch-accent/15 text-hatch-accent border-hatch-accent/30',
  success: 'bg-hatch-success/15 text-hatch-success border-hatch-success/30',
  warning: 'bg-hatch-warning/15 text-hatch-warning border-hatch-warning/30',
  danger: 'bg-hatch-danger/15 text-hatch-danger border-hatch-danger/30'
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className
      )}
      {...props}
    />
  )
}
