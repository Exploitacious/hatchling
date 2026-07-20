import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Send,
  Sparkles
} from 'lucide-react'
import type { FileArtifact, Message } from '@shared/types'
import { DEFAULT_CONTEXT_WINDOW, FORCE_GENERATE_MESSAGE } from '@shared/constants'
import { Badge, Button, IconButton, Spinner, Textarea } from '@renderer/components/ui'
import { Markdown } from '@renderer/components/Markdown'
import { CompleteHatchDialog } from '@renderer/components/CompleteHatchDialog'
import { cn, formatBytes } from '@renderer/lib/format'
import { isBusy, useHatchSession, type ActivityEntry } from '@renderer/store/useHatchSession'

/** Human phrasing for a tool-activity beat, e.g. "writing IDENTITY.md". */
function activityLabel(entry: ActivityEntry): string {
  switch (entry.tool) {
    case 'write_file':
      return `writing ${entry.filename}`
    case 'read_file':
      return `reading ${entry.filename}`
    case 'delete_file':
      return `removing ${entry.filename}`
    default:
      return entry.filename
  }
}

function compact(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-hatch-surface-2 px-4 py-2.5 text-sm text-hatch-text">
          {message.content}
        </div>
      </div>
    )
  }
  if (message.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-hatch-border bg-hatch-surface px-4 py-3 text-sm text-hatch-text">
          {message.content ? <Markdown content={message.content} /> : null}
          {message.toolCalls && message.toolCalls.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.toolCalls.map((call) => (
                <Badge key={call.id} tone="accent" className="font-mono">
                  {call.name}
                  {typeof call.arguments.filename === 'string' ? (
                    <span className="text-hatch-muted">{call.arguments.filename}</span>
                  ) : null}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }
  // tool / system: centered muted note
  return (
    <div className="flex justify-center">
      <span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full bg-hatch-surface-2/60 px-3 py-1 text-xs text-hatch-muted">
        <Check className="h-3 w-3 shrink-0 text-hatch-success" aria-hidden />
        <span className="break-words">{message.content}</span>
      </span>
    </div>
  )
}

function FileRow({
  file,
  expanded,
  onToggle
}: {
  file: FileArtifact
  expanded: boolean
  onToggle: () => void
}) {
  const deleted = file.deletedAt !== null
  return (
    <div className="rounded-md border border-hatch-border bg-hatch-surface">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-hatch-surface-2 focus:outline-none"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-hatch-muted" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-hatch-muted" aria-hidden />
          )}
          <FileText className="h-4 w-4 shrink-0 text-hatch-accent" aria-hidden />
          <span
            className={cn(
              'truncate font-mono text-sm font-medium text-hatch-text',
              deleted && 'text-hatch-muted line-through'
            )}
          >
            {file.filename}
          </span>
          {deleted && (
            <Badge tone="danger" className="shrink-0">
              deleted
            </Badge>
          )}
        </button>
        <span className="shrink-0 px-1 text-xs text-hatch-muted">{formatBytes(file.sizeBytes)}</span>
        <IconButton
          label={`Download ${file.filename}`}
          onClick={() => toast('Export arrives in a later build.')}
        >
          <Download className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      {expanded && (
        <div className="border-t border-hatch-border px-3 py-2 text-xs">
          <Markdown content={file.content} />
        </div>
      )}
    </div>
  )
}

export function ChatScreen() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const hatch = useHatchSession(id)

  const [input, setInput] = useState('')
  const [filesOpen, setFilesOpen] = useState(true)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [busySince, setBusySince] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((e) => e + 1)
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [hatch.messages, hatch.streaming])

  useEffect(() => {
    if (hatch.status === 'completed') navigate(`/sessions/${id}/results`)
  }, [hatch.status, id, navigate])

  useEffect(() => {
    if (hatch.notice) toast(hatch.notice)
  }, [hatch.notice])

  const busy = isBusy(hatch.status)
  const model = hatch.session?.model ?? '—'

  // Track when the current bot turn started, for the liveness stopwatch.
  useEffect(() => {
    setBusySince(busy ? Date.now() : null)
  }, [busy])

  const liveFileCount = hatch.files.filter((f) => !f.deletedAt).length
  const latestActivity = hatch.activity[hatch.activity.length - 1] ?? null
  const turnSeconds = busySince ? Math.max(0, Math.floor((now - busySince) / 1000)) : 0
  const silentSeconds = Math.max(0, Math.floor((now - hatch.lastEventAt) / 1000))
  // Effective window: latest engine report, else the session's resolved value,
  // else the default (labeled estimated).
  const windowTokens = hatch.contextWindow ?? hatch.session?.contextWindow ?? DEFAULT_CONTEXT_WINDOW
  const windowEstimated = hatch.contextWindow !== null ? hatch.estimated : hatch.session?.contextWindow == null
  const percent = hatch.contextPercent ?? Math.min(100, Math.round((hatch.usage.total / windowTokens) * 100))
  const sortedFiles = useMemo(
    () => [...hatch.files].sort((a, b) => Number(Boolean(a.deletedAt)) - Number(Boolean(b.deletedAt))),
    [hatch.files]
  )

  function send(): void {
    const text = input.trim()
    if (!text || busy) return
    hatch.sendMessage(text)
    setInput('')
  }

  function onInputKey(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      send()
    }
  }

  async function onComplete(): Promise<void> {
    setCompleteOpen(false)
    setCompleting(true)
    try {
      await hatch.complete()
    } catch {
      setCompleting(false)
    }
  }

  function onGenerateFiles(): void {
    setCompleteOpen(false)
    // If a turn is mid-flight, stop it cleanly first — the generate instruction
    // starts a fresh turn over the full history.
    if (busy) hatch.abort()
    hatch.sendMessage(FORCE_GENERATE_MESSAGE)
    toast('Asked the bot to write the files now.')
  }

  function onPause(): void {
    setCompleteOpen(false)
    hatch.abort()
    toast('Paused — pick this session up anytime from Sessions.')
    navigate('/')
  }

  if (!hatch.ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
            {hatch.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {hatch.streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-hatch-border bg-hatch-surface px-4 py-3 text-sm text-hatch-text">
                  <Markdown content={hatch.streaming.text} />
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-hatch-accent align-middle" />
                </div>
              </div>
            )}
            {busy && (
              <div className="space-y-1 text-xs text-hatch-muted">
                <div className="flex items-center gap-2">
                  <Spinner className="h-3 w-3" />
                  <span>
                    {hatch.status === 'processing_tool_call' && latestActivity
                      ? activityLabel(latestActivity)
                      : hatch.streaming
                        ? 'responding'
                        : hatch.status === 'sending_opening'
                          ? 'starting the conversation'
                          : 'thinking'}
                    … {clock(turnSeconds)}
                  </span>
                  {silentSeconds > 10 && (
                    <span className="text-hatch-warning">
                      no output for {silentSeconds}s
                    </span>
                  )}
                  <button
                    type="button"
                    className="ml-1 underline decoration-dotted underline-offset-2 hover:text-hatch-text"
                    onClick={() => setShowActivity((v) => !v)}
                  >
                    {showActivity ? 'hide details' : 'details'}
                  </button>
                </div>
                {showActivity && hatch.activity.length > 0 && (
                  <ul className="ml-5 space-y-0.5 font-mono text-[0.7rem]">
                    {hatch.activity.slice(-6).map((a) => (
                      <li key={a.at + a.filename}>
                        {activityLabel(a)} — {a.result}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {hatch.error && (
              <div className="rounded-md border border-hatch-danger/40 bg-hatch-danger/10 px-3 py-2 text-sm text-hatch-danger">
                {hatch.error}
              </div>
            )}
          </div>

          <div className="border-t border-hatch-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKey}
                rows={1}
                placeholder="Type a message…  (Ctrl/⌘+Enter to send)"
                // field-sizing makes the composer grow with its content (and
                // shrink back), capped at ~14 lines before it scrolls internally.
                className="min-h-[2.5rem] max-h-72 [field-sizing:content]"
                disabled={busy}
              />
              <Button variant="primary" onClick={send} disabled={busy || input.trim().length === 0}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Files panel */}
        {filesOpen ? (
          <aside className="flex w-[30%] min-w-[16rem] flex-col border-l border-hatch-border">
            <div className="flex items-center justify-between border-b border-hatch-border px-3 py-2">
              <span className="text-sm font-medium text-hatch-text">Files</span>
              <IconButton label="Hide files panel" onClick={() => setFilesOpen(false)}>
                <PanelRightClose className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {sortedFiles.length === 0 ? (
                <p className="px-1 py-8 text-center text-xs text-hatch-muted">
                  Files will appear here as the bot creates them during hatching.
                </p>
              ) : (
                sortedFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    expanded={expandedFile === file.id}
                    onToggle={() => setExpandedFile((cur) => (cur === file.id ? null : file.id))}
                  />
                ))
              )}
            </div>
          </aside>
        ) : (
          <div className="border-l border-hatch-border p-2">
            <IconButton label="Show files panel" onClick={() => setFilesOpen(true)}>
              <PanelRightOpen className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between gap-4 border-t border-hatch-border bg-hatch-surface px-4 py-2 text-xs text-hatch-muted">
        <div className="flex items-center gap-2">
          <span>
            Tokens: {compact(hatch.usage.total)} / {compact(windowTokens)}
            {windowEstimated ? ' est.' : ''} ({percent}%)
          </span>
          <span className="flex items-center gap-0.5" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2 w-1 rounded-sm',
                  i < Math.round((percent / 100) * 12) ? 'bg-hatch-accent' : 'bg-hatch-surface-2'
                )}
              />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 font-mono">
            <Cpu className="h-3.5 w-3.5" /> {model}
          </span>
          <span>{clock(elapsed)}</span>
          <Button variant="ghost" size="sm" onClick={onPause} disabled={completing}>
            <Pause className="h-4 w-4" />
            Pause
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCompleteOpen(true)}
            disabled={completing}
          >
            {completing ? <Spinner className="text-black" /> : <Sparkles className="h-4 w-4" />}
            Complete Hatch
          </Button>
        </div>
      </div>

      <CompleteHatchDialog
        open={completeOpen}
        fileCount={liveFileCount}
        onGenerate={onGenerateFiles}
        onComplete={() => void onComplete()}
        onPause={onPause}
        onCancel={() => setCompleteOpen(false)}
      />
    </div>
  )
}
