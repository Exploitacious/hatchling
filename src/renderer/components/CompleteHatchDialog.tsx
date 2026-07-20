import { FileText, PauseCircle, Sparkles, Wand2 } from 'lucide-react'
import { Button, Modal } from '@renderer/components/ui'

export interface CompleteHatchDialogProps {
  open: boolean
  /** Count of live (non-deleted) files the bot has written so far. */
  fileCount: number
  /** Ask the bot to write the files now, based on the conversation so far. */
  onGenerate: () => void
  /** Complete the hatch as-is (with or without files). */
  onComplete: () => void
  /** Pause instead — leave and pick the session up later. */
  onPause: () => void
  onCancel: () => void
}

/**
 * Shown when the user clicks Complete Hatch. Branches on whether the bot has
 * actually written files yet: with files it's a simple confirm; with none it
 * offers to have the bot generate them first, complete empty, or pause.
 */
export function CompleteHatchDialog({
  open,
  fileCount,
  onGenerate,
  onComplete,
  onPause,
  onCancel
}: CompleteHatchDialogProps) {
  const hasFiles = fileCount > 0

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Complete this hatch?"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {hasFiles && (
            <Button variant="primary" onClick={onComplete}>
              <Sparkles className="h-4 w-4" />
              Complete Hatch
            </Button>
          )}
        </>
      }
    >
      {hasFiles ? (
        <p className="text-sm text-hatch-text">
          The bot has written{' '}
          <span className="font-medium">
            {fileCount} file{fileCount === 1 ? '' : 's'}
          </span>
          . Completing ends the conversation and takes you to the results — you can
          review, edit, and export everything there.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-hatch-text">
            The bot hasn&apos;t written any files yet — completing now would end the
            session empty. What would you like to do?
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onGenerate}
              className="flex w-full items-start gap-3 rounded-md border border-hatch-accent/40 bg-hatch-accent/10 px-4 py-3 text-left transition-colors hover:bg-hatch-accent/20"
            >
              <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-hatch-accent" />
              <span className="text-sm text-hatch-text">
                <span className="font-medium">Write the files now</span>
                <span className="block text-hatch-muted">
                  Ask the bot to generate every file from the conversation so far, then
                  review and complete.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={onPause}
              className="flex w-full items-start gap-3 rounded-md border border-hatch-border bg-hatch-surface-2 px-4 py-3 text-left transition-colors hover:bg-hatch-border/40"
            >
              <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-hatch-muted" />
              <span className="text-sm text-hatch-text">
                <span className="font-medium">Pause instead</span>
                <span className="block text-hatch-muted">
                  Keep everything as-is and pick the conversation up later from Sessions.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="flex w-full items-start gap-3 rounded-md border border-hatch-border bg-hatch-surface-2 px-4 py-3 text-left transition-colors hover:bg-hatch-border/40"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-hatch-muted" />
              <span className="text-sm text-hatch-text">
                <span className="font-medium">Complete without files</span>
                <span className="block text-hatch-muted">
                  End the session as-is. You can reopen it later from the results screen.
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
