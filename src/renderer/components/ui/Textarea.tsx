import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/format'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-md border border-hatch-border bg-hatch-bg px-3 py-2 text-sm text-hatch-text placeholder:text-hatch-muted transition-colors focus:border-hatch-accent focus:outline-none focus:ring-1 focus:ring-hatch-accent/50 disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
