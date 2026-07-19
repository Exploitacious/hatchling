import { NavLink } from 'react-router-dom'
import { Egg, FolderOpen, LayoutTemplate, Plus, Settings } from 'lucide-react'
import { Button } from '@renderer/components/ui'
import { useUiStore } from '@renderer/store/useUiStore'
import { cn } from '@renderer/lib/format'

function linkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
    isActive ? 'bg-hatch-surface-2 text-hatch-text' : 'text-hatch-muted hover:text-hatch-text'
  )
}

export function NavBar() {
  const openNewHatch = useUiStore((state) => state.openNewHatch)

  return (
    <header className="flex items-center justify-between border-b border-hatch-border bg-hatch-surface px-4 py-2.5">
      <NavLink to="/" className="flex items-center gap-2" aria-label="Hatchling home">
        <Egg className="h-5 w-5 text-hatch-accent" />
        <span className="font-mono text-lg font-semibold text-hatch-text">Hatchling</span>
      </NavLink>

      <nav className="flex items-center gap-1">
        <NavLink to="/" end className={linkClass}>
          <FolderOpen className="h-4 w-4" /> Sessions
        </NavLink>
        <NavLink to="/templates" className={linkClass}>
          <LayoutTemplate className="h-4 w-4" /> Templates
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          <Settings className="h-4 w-4" /> Settings
        </NavLink>
        <Button variant="primary" size="sm" className="ml-2" onClick={openNewHatch}>
          <Plus className="h-4 w-4" /> New Hatch
        </Button>
      </nav>
    </header>
  )
}
