import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  FolderDown,
  MessageSquare,
  MessageSquarePlus,
  Package,
  Plus,
  Sparkles
} from 'lucide-react'
import type { ExportResult } from '@shared/ipc'
import type { FileArtifact } from '@shared/types'
import {
  Badge,
  Button,
  Card,
  IconButton,
  Modal,
  Spinner,
  Textarea,
  Toggle
} from '@renderer/components/ui'
import { Markdown } from '@renderer/components/Markdown'
import { cn, formatBytes } from '@renderer/lib/format'
import { invoke } from '@renderer/lib/ipc'
import { errorMessage } from '@renderer/lib/errorMessage'
import { useUiStore } from '@renderer/store/useUiStore'
import { useSessionData } from '@renderer/store/useSessionData'

async function runExport(action: Promise<ExportResult>): Promise<void> {
  try {
    const result = await action
    if (!result.saved) return // user cancelled the native dialog
    const count = result.fileCount && result.fileCount > 1 ? ` ${result.fileCount} files` : ''
    toast.success(`Saved${count}${result.path ? ` to ${result.path}` : ''}`)
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

export function ResultsScreen() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const openNewHatch = useUiStore((s) => s.openNewHatch)
  const { session, files, messages, loading, error, updateFile } = useSessionData(id)

  const [viewingId, setViewingId] = useState<string | null>(null)
  const [rendered, setRendered] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => Number(Boolean(a.deletedAt)) - Number(Boolean(b.deletedAt))),
    [files]
  )
  const viewing = files.find((f) => f.id === viewingId) ?? null

  function openViewer(file: FileArtifact): void {
    setViewingId(file.id)
    setRendered(true)
    setEditing(false)
    setDraft(file.content)
  }

  async function saveEdit(): Promise<void> {
    if (!viewing) return
    setSaving(true)
    try {
      await updateFile(viewing.id, draft)
      setEditing(false)
      toast.success('Saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-start gap-4">
          <IconButton label="Back to sessions" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-hatch-text">
              <Sparkles className="h-5 w-5 text-hatch-accent" /> Hatch complete!
            </h1>
            <p className="text-sm text-hatch-muted">
              {session ? `${session.name} — ` : ''}your bot&apos;s personality files
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await invoke('sessions:update', { id, status: 'in_progress' })
                navigate(`/sessions/${id}/chat`)
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Reopen conversation
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-hatch-danger/40 bg-hatch-danger/10 px-3 py-2 text-sm text-hatch-danger">
            {error}
          </div>
        )}

        {sortedFiles.length === 0 ? (
          <p className="py-16 text-center text-sm text-hatch-muted">This hatch produced no files.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sortedFiles.map((file) => {
              const deleted = file.deletedAt !== null
              return (
                <Card
                  key={file.id}
                  className={cn('flex flex-col items-center gap-2 p-4', deleted && 'opacity-60')}
                >
                  <FileText className="h-12 w-12 text-hatch-accent" aria-hidden />
                  <span
                    className={cn(
                      'w-full truncate text-center font-mono text-sm font-medium text-hatch-text',
                      deleted && 'line-through'
                    )}
                    title={file.filename}
                  >
                    {file.filename}
                  </span>
                  <span className="text-xs text-hatch-muted">{formatBytes(file.sizeBytes)}</span>
                  {deleted && <Badge tone="danger">deleted</Badge>}
                  <div className="flex gap-1">
                    <IconButton label={`View ${file.filename}`} onClick={() => openViewer(file)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={`Download ${file.filename}`}
                      onClick={() => runExport(invoke('files:export', { id: file.id }))}
                    >
                      <Download className="h-4 w-4" />
                    </IconButton>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2 border-t border-hatch-border pt-6">
          <Button
            variant="primary"
            onClick={() => runExport(invoke('files:exportAll', { sessionId: id, mode: 'zip' }))}
          >
            <Package className="h-4 w-4" /> Download all (.zip)
          </Button>
          <Button
            variant="secondary"
            onClick={() => runExport(invoke('files:exportAll', { sessionId: id, mode: 'folder' }))}
          >
            <FolderDown className="h-4 w-4" /> Save to folder
          </Button>
          <Button variant="secondary" onClick={() => setTranscriptOpen(true)}>
            <MessageSquare className="h-4 w-4" /> View transcript
          </Button>
          <Button variant="ghost" onClick={openNewHatch}>
            <Plus className="h-4 w-4" /> New Hatch
          </Button>
        </div>
      </div>

      {/* File viewer */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewingId(null)}
        title={viewing?.filename}
        className="max-w-2xl"
        footer={
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEdit} disabled={saving}>
                {saving ? <Spinner className="text-black" /> : null} Save
              </Button>
            </>
          ) : (
            <div className="flex w-full items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-hatch-muted">
                Rendered
                <Toggle checked={rendered} onChange={setRendered} label="Toggle rendered view" />
              </label>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          )
        }
      >
        {viewing &&
          (editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-80 font-mono text-xs"
            />
          ) : rendered ? (
            <div className="max-h-80 overflow-y-auto text-sm">
              <Markdown content={viewing.content} />
            </div>
          ) : (
            <pre className="max-h-80 overflow-auto rounded-md bg-hatch-bg p-3 font-mono text-xs text-hatch-text">
              {viewing.content}
            </pre>
          ))}
      </Modal>

      {/* Transcript */}
      <Modal
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        title="Chat transcript"
        className="max-w-2xl"
        footer={
          <Button
            variant="secondary"
            onClick={() => runExport(invoke('files:exportTranscript', { sessionId: id }))}
          >
            <Download className="h-4 w-4" /> Download as .md
          </Button>
        }
      >
        <div className="max-h-96 space-y-3 overflow-y-auto text-sm">
          {messages
            .filter((m) => m.content.trim().length > 0)
            .map((m) => (
              <div key={m.id}>
                <span
                  className={cn(
                    'font-semibold',
                    m.role === 'assistant'
                      ? 'text-hatch-accent'
                      : m.role === 'user'
                        ? 'text-hatch-text'
                        : 'text-hatch-muted'
                  )}
                >
                  {m.role === 'assistant' ? 'Bot' : m.role === 'user' ? 'You' : 'System'}:
                </span>{' '}
                <span className="text-hatch-text">{m.content}</span>
              </div>
            ))}
        </div>
      </Modal>
    </div>
  )
}
