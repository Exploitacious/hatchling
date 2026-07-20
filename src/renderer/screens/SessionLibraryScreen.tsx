import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Egg, Pencil, Copy, Trash2 } from 'lucide-react'
import type { Session, SessionStatus } from '@shared/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Spinner
} from '@renderer/components/ui'
import { useSessionsStore } from '@renderer/store/useSessionsStore'
import { useTemplatesStore } from '@renderer/store/useTemplatesStore'
import { useUiStore } from '@renderer/store/useUiStore'
import { formatDateTime } from '@renderer/lib/format'
import { errorMessage } from '@renderer/lib/errorMessage'

type StatusFilter = 'all' | SessionStatus

const STATUS_LABEL: Record<SessionStatus, string> = {
  in_progress: 'In Progress',
  completed: 'Completed'
}

export function SessionLibraryScreen() {
  const navigate = useNavigate()
  const sessions = useSessionsStore((s) => s.sessions)
  const sessionsLoading = useSessionsStore((s) => s.loading)
  const loadSessions = useSessionsStore((s) => s.load)
  const updateSession = useSessionsStore((s) => s.update)
  const createSession = useSessionsStore((s) => s.create)
  const removeSession = useSessionsStore((s) => s.remove)
  const templates = useTemplatesStore((s) => s.templates)
  const loadTemplates = useTemplatesStore((s) => s.load)
  const openNewHatch = useUiStore((s) => s.openNewHatch)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const [confirmTarget, setConfirmTarget] = useState<Session | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    void loadSessions()
    void loadTemplates()
  }, [loadSessions, loadTemplates])

  function templateName(templateId: string | null): string {
    if (!templateId) return '—'
    return templates.find((t) => t.id === templateId)?.name ?? '—'
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sessions.filter((session) => {
      const matchesQuery = !query || session.name.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [sessions, search, statusFilter])

  function openSession(session: Session): void {
    navigate(
      session.status === 'in_progress' ? `/sessions/${session.id}/chat` : `/sessions/${session.id}/results`
    )
  }

  function openRename(session: Session): void {
    setRenameTarget(session)
    setRenameValue(session.name)
  }

  async function onConfirmRename(): Promise<void> {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) {
      toast.error('Session name cannot be empty.')
      return
    }
    setRenaming(true)
    try {
      await updateSession({ id: renameTarget.id, name })
      toast.success('Session renamed.')
      setRenameTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setRenaming(false)
    }
  }

  async function onDuplicate(session: Session): Promise<void> {
    // A session created before a template/provider existed (or whose source
    // was since deleted) has nothing valid to seed a copy with — guard rather
    // than send a request the backend will reject. Destructured into locals
    // so the narrowed `string` (not `string | null`) survives the async call.
    const { templateId, providerId } = session
    if (!templateId || !providerId) {
      toast.error('This session has no template or provider to duplicate from.')
      return
    }
    setDuplicatingId(session.id)
    try {
      await createSession({
        name: `${session.name} (copy)`,
        templateId,
        providerId,
        model: session.model,
        openingMessage: session.openingMessage
      })
      toast.success(`Duplicated "${session.name}"`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDuplicatingId(null)
    }
  }

  async function onConfirmDelete(): Promise<void> {
    if (!confirmTarget) return
    const session = confirmTarget
    setDeletingId(session.id)
    try {
      await removeSession(session.id)
      toast.success(`Deleted "${session.name}"`)
      setConfirmTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-hatch-text">Sessions</h1>
          <p className="text-sm text-hatch-muted">Hatches in progress and completed personality files.</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions…"
            aria-label="Search sessions"
            className="sm:w-56"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="sm:w-40"
          >
            <option value="all">All</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
      </div>

      {!sessionsLoading && sessions.length === 0 ? (
        <EmptyState
          icon={Egg}
          title="No hatching sessions yet."
          description="Start a New Hatch to begin forging a personality file."
          action={
            <Button variant="primary" onClick={openNewHatch}>
              New Hatch
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-hatch-muted">No sessions match your search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((session) => (
            <Card
              key={session.id}
              interactive
              role="button"
              tabIndex={0}
              onClick={() => openSession(session)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openSession(session)
                }
              }}
              className="group relative flex flex-col gap-3 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium text-hatch-text">{session.name}</h2>
                  <p className="truncate text-xs text-hatch-muted">
                    {templateName(session.templateId)} · {session.model}
                  </p>
                </div>
                <Badge tone={session.status === 'completed' ? 'success' : 'warning'} className="shrink-0">
                  {STATUS_LABEL[session.status]}
                </Badge>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2">
                <p className="text-xs text-hatch-muted">{formatDateTime(session.createdAt)}</p>
                {/* stopPropagation keeps action clicks from also firing the card's navigate */}
                <div
                  className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton label="Rename session" onClick={() => openRename(session)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Duplicate session"
                    disabled={duplicatingId === session.id || !session.templateId || !session.providerId}
                    onClick={() => void onDuplicate(session)}
                  >
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Delete session"
                    disabled={deletingId === session.id}
                    onClick={() => setConfirmTarget(session)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename session"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void onConfirmRename()} disabled={renaming}>
              {renaming ? <Spinner className="text-black" /> : null}
              Save
            </Button>
          </>
        }
      >
        <Field label="Session name" htmlFor="rename-session">
          <Input
            id="rename-session"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !renaming) void onConfirmRename()
            }}
          />
        </Field>
      </Modal>

      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Delete session"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void onConfirmDelete()}
              disabled={deletingId === confirmTarget?.id}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-hatch-muted">Delete "{confirmTarget?.name}"? This cannot be undone.</p>
      </Modal>
    </div>
  )
}
