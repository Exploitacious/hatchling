import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

/** Consistent empty-state placeholder used across list screens. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-hatch-border px-6 py-16 text-center">
      {Icon && <Icon className="h-10 w-10 text-hatch-muted" aria-hidden />}
      <div className="space-y-1">
        <h3 className="text-base font-medium text-hatch-text">{title}</h3>
        {description && <p className="mx-auto max-w-sm text-sm text-hatch-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
