import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  Copy,
  Download,
  Egg,
  Eye,
  FileText,
  FolderDown,
  MessageSquare,
  Package,
  Plus,
  Save
} from 'lucide-react'
import type { FileArtifact, MessageRole } from '@shared/types'
import { Badge, Button, Card, EmptyState, IconButton, Modal, Textarea, Toggle } from '@renderer/components/ui'
import { MOCK_FILES, MOCK_MESSAGES } from '@renderer/mock/fixtures'
import { cn, formatBytes, formatDateTime } from '@renderer/lib/format'
import { useUiStore } from '@renderer/store/useUiStore'

// Phase 2 has no export/persist pipeline yet — every action that would touch
// disk or the main process resolves to the same toast until that build lands.
const EXPORT_NOT_READY = 'Export arrives in a later build.'

function notReady(): void {
  toast(EXPORT_NOT_READY)
}

// Role -> display label + emphasis, shared by the on-screen transcript and
// the "Copy all" markdown export so the two never drift apart.
const ROLE_DISPLAY: Record<MessageRole, { prefix: string; className: string }> = {
  assistant: { prefix: 'Bot:', className: 'font-semibold text-hatch-text' },
  user: { prefix: 'You:', className: 'font-semibold text-hatch-text' },
  system: { prefix: 'System:', className: 'italic text-hatch-muted' },
  tool: { prefix: 'System:', className: 'italic text-hatch-muted' }
}
const ROLE_MARKDOWN_PREFIX: Record<MessageRole, string> = {
  assistant: '**Bot:**',
  user: '**You:**',
  system: '*System:*',
  tool: '*System:*'
}

// Tailwind has no typography plugin here, so every markdown tag gets an
// explicit style. Kept module-level (not recreated per render) since it has
// no closures over component state.
//
// react-markdown's default renderer always sets `passNode: true` internally
// (see node_modules/react-markdown/lib/index.js), so every custom component
// below receives a `node` prop whether or not it's requested. It must be
// destructured out — spreading it onto a native DOM element (e.g. `<code>`)
// produces a "React does not recognize the `node` prop" console warning.
const markdownComponents: Components = {
  h1: ({ node, className, ...props }) => {
    void node
    return <h1 className={cn('mb-2 mt-4 text-lg font-semibold text-hatch-text first:mt-0', className)} {...props} />
  },
  h2: ({ node, className, ...props }) => {
    void node
    return <h2 className={cn('mb-2 mt-4 text-base font-semibold text-hatch-text first:mt-0', className)} {...props} />
  },
  h3: ({ node, className, ...props }) => {
    void node
    return <h3 className={cn('mb-1.5 mt-3 text-sm font-semibold text-hatch-text first:mt-0', className)} {...props} />
  },
  p: ({ node, className, ...props }) => {
    void node
    return <p className={cn('mb-3 text-sm leading-relaxed text-hatch-text last:mb-0', className)} {...props} />
  },
  ul: ({ node, className, ...props }) => {
    void node
    return <ul className={cn('mb-3 list-disc space-y-1 pl-5 text-sm text-hatch-text', className)} {...props} />
  },
  ol: ({ node, className, ...props }) => {
    void node
    return <ol className={cn('mb-3 list-decimal space-y-1 pl-5 text-sm text-hatch-text', className)} {...props} />
  },
  li: ({ node, className, ...props }) => {
    void node
    return <li className={cn('leading-relaxed', className)} {...props} />
  },
  a: ({ node, className, ...props }) => {
    void node
    return (
      <a
        className={cn('text-hatch-accent underline underline-offset-2 hover:text-hatch-accent-hover', className)}
        target="_blank"
        rel="noreferrer"
        {...props}
      />
    )
  },
  strong: ({ node, className, ...props }) => {
    void node
    return <strong className={cn('font-semibold text-hatch-text', className)} {...props} />
  },
  em: ({ node, className, ...props }) => {
    void node
    return <em className={cn('italic', className)} {...props} />
  },
  blockquote: ({ node, className, ...props }) => {
    void node
    return (
      <blockquote
        className={cn('mb-3 border-l-2 border-hatch-border pl-3 italic text-hatch-muted', className)}
        {...props}
      />
    )
  },
  hr: ({ node, className, ...props }) => {
    void node
    return <hr className={cn('my-4 border-hatch-border', className)} {...props} />
  },
  code: ({ node, className, ...props }) => {
    void node
    // A fenced block with a language tag gets `language-xxx` on its `code`;
    // everything else (inline code, untagged fences) falls back to the same
    // pill look — the surrounding `pre` box already carries block styling.
    const isTaggedBlock = /language-/.test(className ?? '')
    return (
      <code
        className={cn(
          'font-mono text-xs',
          !isTaggedBlock && 'rounded bg-hatch-surface-2 px-1 py-0.5 text-hatch-text',
          className
        )}
        {...props}
      />
    )
  },
  pre: ({ node, className, ...props }) => {
    void node
    return (
      <pre
        className={cn('mb-3 overflow-x-auto rounded-md bg-hatch-surface-2 p-3 font-mono text-xs text-hatch-text', className)}
        {...props}
      />
    )
  },
  table: ({ node, className, children, ...props }) => {
    void node
    return (
      <div className="mb-3 overflow-x-auto">
        <table className={cn('w-full border-collapse text-sm', className)} {...props}>
          {children}
        </table>
      </div>
    )
  },
  th: ({ node, className, ...props }) => {
    void node
    return (
      <th
        className={cn('border-b border-hatch-border px-2 py-1 text-left font-semibold text-hatch-text', className)}
        {...props}
      />
    )
  },
  td: ({ node, className, ...props }) => {
    void node
    return <td className={cn('border-b border-hatch-border px-2 py-1 text-hatch-text', className)} {...props} />
  }
}

function buildTranscriptText(): string {
  return MOCK_MESSAGES.map((m) => `${ROLE_MARKDOWN_PREFIX[m.role]} ${m.content}`).join('\n\n')
}

export function ResultsScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const openNewHatch = useUiStore((s) => s.openNewHatch)

  // Local component state stands in for persistence in Phase 2 — an edit
  // that's "saved" here only lives for the life of this screen.
  const [files, setFiles] = useState<FileArtifact[]>(MOCK_FILES)
  const [viewingFileId, setViewingFileId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'raw' | 'rendered'>('rendered')
  const [editDraft, setEditDraft] = useState<string | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => Number(Boolean(a.deletedAt)) - Number(Boolean(b.deletedAt))),
    [files]
  )
  const viewingFile = files.find((f) => f.id === viewingFileId) ?? null

  function openViewer(file: FileArtifact): void {
    setViewingFileId(file.id)
    setViewMode('rendered')
    setEditDraft(null)
  }

  function closeViewer(): void {
    setViewingFileId(null)
    setEditDraft(null)
  }

  function toggleEdit(next: boolean): void {
    setEditDraft(next ? (viewingFile?.content ?? '') : null)
  }

  function cancelEdit(): void {
    setEditDraft(null)
  }

  function saveEdit(): void {
    if (!viewingFile || editDraft === null) return
    const updated: FileArtifact = {
      ...viewingFile,
      content: editDraft,
      sizeBytes: new TextEncoder().encode(editDraft).length,
      updatedAt: new Date().toISOString()
    }
    setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    setEditDraft(null)
    toast.success('Saved')
  }

  async function copyTranscript(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildTranscriptText())
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-start gap-4">
            <IconButton label="Back to sessions" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </IconButton>
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                <Egg className="h-6 w-6 text-hatch-accent" aria-hidden />
                <h1 className="text-xl font-semibold text-hatch-text">Hatch complete!</h1>
              </div>
              <p className="mt-1 text-sm text-hatch-muted">Your bot's personality files</p>
              <p className="mt-1 font-mono text-xs text-hatch-muted">Session {id ?? '—'}</p>
            </div>
            <div className="h-8 w-8 shrink-0" aria-hidden />
          </div>

          {sortedFiles.length === 0 ? (
            <EmptyState icon={FileText} title="No files yet" description="This hatch didn't produce any files." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedFiles.map((file) => {
                const deleted = file.deletedAt !== null
                return (
                  <Card
                    key={file.id}
                    interactive
                    role="button"
                    tabIndex={0}
                    onClick={() => openViewer(file)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openViewer(file)
                      }
                    }}
                    className={cn('flex flex-col items-center gap-3 p-6 text-center', deleted && 'opacity-60')}
                  >
                    <FileText className="h-12 w-12 text-hatch-accent" aria-hidden />
                    <div className="w-full min-w-0">
                      <p
                        className={cn(
                          'truncate font-mono text-sm font-bold text-hatch-text',
                          deleted && 'line-through'
                        )}
                      >
                        {file.filename}
                      </p>
                      <p className="mt-1 text-xs text-hatch-muted">{formatBytes(file.sizeBytes)}</p>
                      {deleted && (
                        <Badge tone="danger" className="mt-2">
                          Deleted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton
                        label={`Download ${file.filename}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          notReady()
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label={`View ${file.filename}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openViewer(file)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hatch-border bg-hatch-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={notReady}>
            <Package className="h-4 w-4" /> Download All (.zip)
          </Button>
          <Button variant="secondary" onClick={notReady}>
            <FolderDown className="h-4 w-4" /> Save to folder
          </Button>
          <Button variant="ghost" onClick={() => setTranscriptOpen(true)}>
            <MessageSquare className="h-4 w-4" /> View chat transcript
          </Button>
        </div>
        <Button variant="primary" onClick={openNewHatch}>
          <Plus className="h-4 w-4" /> New Hatch
        </Button>
      </div>

      <Modal
        open={viewingFile !== null}
        onClose={closeViewer}
        title={viewingFile?.filename}
        className="max-w-2xl"
        footer={
          editDraft !== null ? (
            <>
              <Button variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEdit}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </>
          ) : undefined
        }
      >
        {viewingFile && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {viewingFile.deletedAt !== null && (
                <Badge tone="danger">Deleted {formatDateTime(viewingFile.deletedAt)}</Badge>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-hatch-muted">
                {editDraft === null && (
                  <div className="flex items-center gap-2">
                    <span>Raw</span>
                    <Toggle
                      checked={viewMode === 'rendered'}
                      onChange={(checked) => setViewMode(checked ? 'rendered' : 'raw')}
                      label="Toggle rendered markdown view"
                    />
                    <span>Rendered</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span>Edit</span>
                  <Toggle checked={editDraft !== null} onChange={toggleEdit} label="Toggle edit mode" />
                </div>
              </div>
            </div>

            {editDraft !== null ? (
              <Textarea
                rows={16}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="max-h-[60vh] min-h-[16rem] font-mono text-xs"
                autoFocus
              />
            ) : (
              <div className="max-h-[60vh] overflow-y-auto rounded-md border border-hatch-border bg-hatch-bg p-3">
                {viewMode === 'raw' ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs text-hatch-text">
                    {viewingFile.content}
                  </pre>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {viewingFile.content}
                  </ReactMarkdown>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        title="Chat transcript"
        className="max-w-xl"
        footer={
          <Button variant="secondary" onClick={() => void copyTranscript()}>
            <Copy className="h-4 w-4" /> Copy all
          </Button>
        }
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {MOCK_MESSAGES.map((message) => {
            const display = ROLE_DISPLAY[message.role]
            return (
              <p key={message.id} className="text-sm text-hatch-text">
                <span className={display.className}>{display.prefix}</span>{' '}
                <span className="whitespace-pre-wrap">{message.content}</span>
              </p>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
