import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/format'
import { IconButton } from './IconButton'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Centered modal dialog with overlay, Escape-to-close, and click-outside. */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg animate-fade-in rounded-lg border border-hatch-border bg-hatch-surface shadow-xl',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-hatch-border px-5 py-3">
            <h2 className="text-sm font-semibold text-hatch-text">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-hatch-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
