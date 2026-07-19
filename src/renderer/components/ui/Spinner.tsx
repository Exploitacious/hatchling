import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/format'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-hatch-muted', className)} aria-hidden />
}
