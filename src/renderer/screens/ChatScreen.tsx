import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FileText,
  FolderOpen,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Sparkles,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import type { FileArtifact, Message, ToolCall, ToolName } from '@shared/types'
import { Badge, Button, Card, EmptyState, IconButton, Textarea } from '@renderer/components/ui'
import { cn, formatBytes } from '@renderer/lib/format'
import {
  MOCK_CONTEXT_WINDOW,
  MOCK_FILES,
  MOCK_MESSAGES,
  MOCK_TOKEN_USAGE
} from '@renderer/mock/fixtures'

// Phase-2 chat interface: the hatching screen wired to MOCK fixtures only. The
// real conversation engine (Phase 3) replaces the local echo behaviour with
// streamed IPC — nothing here calls an LLM.

const MODEL_LABEL = 'mock-hatchling'
// Discrete meter cells read as a terminal-style gauge and avoid a dynamic
// inline width (repo rule: Tailwind classes only, no inline styles).
const METER_SEGMENTS = 16

const TOOL_ICONS: Record<ToolName, LucideIcon> = {
  write_file: Pencil,
  read_file: FileText,
  delete_file: Trash2
}

// Shared markdown styling for both assistant bubbles and file previews. There
// is no typography plugin, so every element is styled explicitly here.
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-1 text-base font-semibold text-hatch-text">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-sm font-semibold text-hatch-text">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-hatch-text">{children}</h3>,
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-hatch-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-hatch-accent underline underline-offset-2 hover:text-hatch-accent-hover"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-hatch-border pl-3 italic text-hatch-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-hatch-border" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md border border-hatch-border bg-hatch-bg p-3 text-xs">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    // react-markdown tags fenced (block) code with a `language-*` class; bare
    // inline code has none. Block code is wrapped by the styled `pre` above, so
    // only inline code gets the pill treatment.
    const isBlock = typeof className === 'string' && className.includes('language-')
    if (isBlock) {
      return <code className={cn('font-mono text-xs text-hatch-text', className)}>{children}</code>
    }
    return (
      <code className="rounded bg-hatch-surface-2 px-1 py-0.5 font-mono text-xs text-hatch-accent">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-hatch-border px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-hatch-border px-2 py-1">{children}</td>
}

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}

function ToolCallChip({ call }: { call: ToolCall }) {
  const Icon = TOOL_ICONS[call.name]
  const target = typeof call.arguments.filename === 'string' ? call.arguments.filename : ''
  return (
    <Badge tone="accent" className="font-mono">
      <Icon className="h-3 w-3" aria-hidden />
      {call.name}
      {target ? <span className="text-hatch-muted">{target}</span> : null}
    </Badge>
  )
}

function MessageItem({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-hatch-surface-2 px-4 py-2.5 text-sm text-hatch-text">
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  if (message.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-hatch-border bg-hatch-surface px-4 py-3 text-sm text-hatch-text">
          <Markdown content={message.content} />
          {message.toolCalls && message.toolCalls.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.toolCalls.map((call) => (
                <ToolCallChip key={call.id} call={call} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  // tool + system: a small centered note. Tool results confirm an action; the
  // system note flags that this is a mock preview.
  return (
    <div className="flex justify-center">
      <span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full bg-hatch-surface-2/50 px-3 py-1 text-xs text-hatch-muted">
        {message.role === 'tool' ? (
          <Check className="h-3 w-3 shrink-0 text-hatch-success" aria-hidden />
        ) : (
          <Sparkles className="h-3 w-3 shrink-0 text-hatch-accent" aria-hidden />
        )}
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
    <Card className="overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-hatch-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-hatch-accent/60"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-hatch-muted" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-hatch-muted" aria-hidden />
          )}
          <FileText className="h-4 w-4 shrink-0 text-hatch-accent" aria-hidden />
          <span
            className={cn(
              'truncate font-mono text-sm font-semibold text-hatch-text',
              deleted && 'text-hatch-muted line-through'
            )}
          >
            {file.filename}
          </span>
          {deleted ? (
            <Badge tone="danger" className="shrink-0">
              deleted
            </Badge>
          ) : null}
        </button>
        <span className="shrink-0 px-1 font-mono text-xs text-hatch-muted">
          {formatBytes(file.sizeBytes)}
        </span>
        <IconButton
          label={`Download ${file.filename}`}
          disabled={deleted}
          onClick={() => toast('Export arrives in a later build.')}
        >
          <Download className="h-4 w-4" />
        </IconButton>
      </div>
      {expanded ? (
        <div className="border-t border-hatch-border bg-hatch-bg/40 px-3 py-2 text-sm text-hatch-text">
          <Markdown content={file.content} />
        </div>
      ) : null}
    </Card>
  )
}

export function ChatScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessionId = id ?? ''

  const [messages, setMessages] = useState<Message[]>(() => [...MOCK_MESSAGES])
  const [files] = useState<FileArtifact[]>(() => [...MOCK_FILES])
  const [input, setInput] = useState('')
  const [filesOpen, setFilesOpen] = useState(true)
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [engineNoticeShown, setEngineNoticeShown] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // Live session timer, ticking from mount.
  useEffect(() => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const totalTokens = MOCK_TOKEN_USAGE.total
  const contextWindow = MOCK_CONTEXT_WINDOW
  const usage = contextWindow > 0 ? totalTokens / contextWindow : 0
  const pct = Math.round(usage * 100)
  const filledSegments = Math.round(usage * METER_SEGMENTS)
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const seconds = String(elapsed % 60).padStart(2, '0')

  // Textarea grows with content up to ~4 lines, then scrolls internally.
  const inputRows = Math.min(4, Math.max(1, input.split('\n').length))

  function handleSend(): void {
    const trimmed = input.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    const userMessage: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: trimmed,
      toolCalls: null,
      toolCallId: null,
      tokens: null,
      createdAt: now
    }
    setMessages((prev) => {
      const next = [...prev, userMessage]
      // Explain the silence once: Phase 2 has no model to reply.
      if (!engineNoticeShown) {
        next.push({
          id: crypto.randomUUID(),
          sessionId,
          role: 'system',
          content:
            'The live hatching engine arrives in a later build — this preview records your message without a model reply.',
          toolCalls: null,
          toolCallId: null,
          tokens: null,
          createdAt: now
        })
      }
      return next
    })
    if (!engineNoticeShown) setEngineNoticeShown(true)
    setInput('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      handleSend()
    }
  }

  function toggleFile(fileId: string): void {
    setExpandedFileId((current) => (current === fileId ? null : fileId))
  }

  return (
    <div className="flex h-full flex-col bg-hatch-bg">
      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-hatch-border bg-hatch-surface px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={inputRows}
                aria-label="Message"
                placeholder="Talk to your hatchling…  (Ctrl/⌘+Enter to send)"
                className="flex-1"
              />
              <Button variant="primary" onClick={handleSend} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
            <p className="mx-auto mt-1.5 max-w-3xl text-center text-xs text-hatch-muted">
              Mock preview — no live model is connected yet.
            </p>
          </div>
        </section>

        {/* Files panel */}
        {filesOpen ? (
          <aside className="flex w-[30%] min-w-[15rem] max-w-sm flex-col border-l border-hatch-border bg-hatch-surface/40">
            <div className="flex items-center gap-2 border-b border-hatch-border px-3 py-2">
              <FileText className="h-4 w-4 text-hatch-accent" aria-hidden />
              <span className="text-sm font-medium text-hatch-text">Files</span>
              <Badge tone="neutral">{files.length}</Badge>
              <IconButton
                label="Collapse files panel"
                className="ml-auto"
                onClick={() => setFilesOpen(false)}
              >
                <PanelRightClose className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {files.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No files yet"
                  description="Files will appear here as the bot creates them during hatching."
                />
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      expanded={expandedFileId === file.id}
                      onToggle={() => toggleFile(file.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        ) : (
          <aside className="flex w-11 flex-col items-center gap-2 border-l border-hatch-border bg-hatch-surface/40 py-2">
            <IconButton label="Expand files panel" onClick={() => setFilesOpen(true)}>
              <PanelRightOpen className="h-4 w-4" />
            </IconButton>
            <FileText className="h-4 w-4 text-hatch-muted" aria-hidden />
          </aside>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between gap-4 border-t border-hatch-border bg-hatch-surface px-4 py-2">
        <div className="flex shrink-0 items-center gap-2 text-xs text-hatch-muted">
          <span className="font-mono">
            Tokens: <span className="text-hatch-text">{`${Math.round(totalTokens / 1000)}k`}</span>{' '}
            / {`${Math.round(contextWindow / 1000)}k`} ({pct}%)
          </span>
          <div
            className="flex w-28 gap-0.5"
            role="progressbar"
            aria-label="Context window usage"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {Array.from({ length: METER_SEGMENTS }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  index < filledSegments ? 'bg-hatch-accent' : 'bg-hatch-surface-2'
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 text-xs text-hatch-muted">
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" aria-hidden />
            <span className="font-mono text-hatch-text">{MODEL_LABEL}</span>
          </span>
          <span className="inline-flex items-center gap-1.5" aria-label="Session duration">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span className="font-mono tabular-nums">
              {minutes}:{seconds}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center">
          <Button variant="primary" onClick={() => navigate(`/sessions/${id}/results`)}>
            <CheckCircle2 className="h-4 w-4" />
            Complete Hatch
          </Button>
        </div>
      </footer>
    </div>
  )
}
