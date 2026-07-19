import { cn } from '@renderer/lib/format'

export interface TabItem {
  id: string
  label: string
}

export interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-hatch-border', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
            active === tab.id
              ? 'border-hatch-accent text-hatch-text'
              : 'border-transparent text-hatch-muted hover:text-hatch-text'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
