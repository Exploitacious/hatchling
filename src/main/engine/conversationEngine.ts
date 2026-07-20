import type {
  ConversationState,
  LlmMessage,
  LlmProvider,
  LlmStreamEvent,
  Message,
  Session,
  TokenUsage,
  ToolCall
} from '@shared/types'
import type { IpcEventMap, IpcEventName } from '@shared/ipc'
import { DEFAULT_CONTEXT_WINDOW, TOOL_DEFINITIONS } from '@shared/constants'
import type { Store } from '../store'
import { createProvider } from '../providers/factory'
import { isAbortError, toLlmError } from '../providers/errors'
import { newId } from '../util/id'
import { buildSystemPrompt } from './systemPrompt'
import { detectInlineFiles } from './fileDetection'

/** Emits a typed push event to the renderer. */
export type EngineEmitter = <E extends IpcEventName>(event: E, payload: IpcEventMap[E]) => void

/** Just the slice of the key vault the engine needs (keeps it testable). */
export interface KeyLookup {
  get(providerId: string): string | null
}

// Bound on tool-call round-trips per user turn — a runaway model that keeps
// calling tools cannot loop forever.
const MAX_TOOL_ITERATIONS = 12

const BOOTSTRAP_FILENAME = 'BOOTSTRAP.md'

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function contextPercent(usage: TokenUsage, contextWindow: number): number {
  return Math.min(100, Math.round((usage.total / contextWindow) * 100))
}

/**
 * Drives one hatching session: builds the prompt, streams the model, executes
 * the write/read/delete tools against the file registry, applies the inline
 * fallback, tracks tokens, and pushes every change to the renderer. Persists as
 * it goes so a session survives an app restart.
 */
export class ConversationEngine {
  private readonly activeTurns = new Map<string, AbortController>()

  constructor(
    private readonly store: Store,
    private readonly keys: KeyLookup,
    private readonly emit: EngineEmitter
  ) {}

  /** Begin (or resume) a session: send the opening line, or restore state. */
  async start(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)
    if (session.status === 'completed') {
      this.setState(sessionId, 'completed')
      return
    }

    const history = this.store.messages.listBySession(sessionId)
    if (history.length === 0) {
      const opening = this.store.messages.create({
        sessionId,
        role: 'user',
        content: session.openingMessage
      })
      this.emit('chat:message', { sessionId, message: opening })
      await this.runTurn(session)
      return
    }

    const last = history[history.length - 1]
    if (last.role === 'assistant' && (!last.toolCalls || last.toolCalls.length === 0)) {
      this.setState(sessionId, 'waiting_for_user')
    } else {
      // Interrupted mid-turn (last message is a user or tool message) — resume.
      await this.runTurn(session)
    }
  }

  /** Handle a user message and run the model's reply. */
  async sendUserMessage(sessionId: string, content: string): Promise<void> {
    const session = this.requireSession(sessionId)
    if (session.status === 'completed') return

    const message = this.store.messages.create({ sessionId, role: 'user', content })
    this.emit('chat:message', { sessionId, message })
    await this.runTurn(session)
  }

  /** Mark the session complete and move the UI to the results screen. */
  async complete(sessionId: string): Promise<void> {
    this.abort(sessionId)
    this.store.sessions.setStatus(sessionId, 'completed')
    this.setState(sessionId, 'completed')
  }

  /** Cancel an in-flight turn (user cancel). */
  abort(sessionId: string): void {
    this.activeTurns.get(sessionId)?.abort()
  }

  // --- internals -------------------------------------------------------------

  private async runTurn(session: Session): Promise<void> {
    const controller = new AbortController()
    this.activeTurns.set(session.id, controller)

    try {
      const provider = this.resolveProvider(session)
      const systemPrompt = buildSystemPrompt(session.templateSnapshot)

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        this.setState(session.id, 'waiting_for_bot')

        const messages = this.buildLlmMessages(session.id, systemPrompt)
        const messageId = newId()
        const response = await provider.sendMessage({
          model: session.model,
          messages,
          tools: [...TOOL_DEFINITIONS],
          temperature: session.temperature ?? undefined,
          signal: controller.signal,
          onEvent: (event) => this.relayStreamEvent(session.id, messageId, event)
        })

        const assistant = this.store.messages.create({
          id: messageId,
          sessionId: session.id,
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls.length > 0 ? response.toolCalls : null,
          tokens: response.usage.output
        })
        this.emit('chat:token', { sessionId: session.id, messageId, chunk: '', done: true })
        this.emit('chat:message', { sessionId: session.id, message: assistant })
        this.trackUsage(session.id, response.usage)

        if (controller.signal.aborted) {
          this.setState(session.id, 'paused')
          return
        }

        const explicit = response.toolCalls
        const detected = detectInlineFiles(response.content).filter(
          (file) =>
            !explicit.some(
              (call) => call.name === 'write_file' && asString(call.arguments.filename) === file.filename
            )
        )

        if (explicit.length === 0 && detected.length === 0) {
          this.setState(session.id, 'waiting_for_user')
          return
        }

        this.setState(session.id, 'processing_tool_call')

        for (const call of explicit) {
          const result = this.executeTool(session.id, call)
          this.store.messages.create({
            sessionId: session.id,
            role: 'tool',
            content: result,
            toolCallId: call.id
          })
        }

        for (const file of detected) {
          this.writeFile(session.id, file.filename, file.content)
          this.emit('chat:notice', {
            sessionId: session.id,
            message: `Detected ${file.filename} in the response`
          })
        }

        // If the model called tools, loop to feed the results back. If it only
        // produced inline files, the turn is complete.
        if (explicit.length === 0) {
          this.setState(session.id, 'waiting_for_user')
          return
        }
      }

      // Exhausted the tool-iteration budget — hand control back to the user.
      this.setState(session.id, 'waiting_for_user')
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) {
        this.setState(session.id, 'paused')
        return
      }
      const error = toLlmError(err)
      this.emit('chat:error', { sessionId: session.id, message: error.message, kind: error.kind })
      this.setState(session.id, 'error')
    } finally {
      this.activeTurns.delete(session.id)
    }
  }

  private relayStreamEvent(sessionId: string, messageId: string, event: LlmStreamEvent): void {
    // Only text is relayed live; tool calls, usage, and errors are handled from
    // the resolved response (and the catch block) to avoid double-emitting.
    if (event.type === 'text') {
      this.emit('chat:token', { sessionId, messageId, chunk: event.text, done: false })
    }
  }

  private executeTool(sessionId: string, call: ToolCall): string {
    const filename = asString(call.arguments.filename)
    if (!filename) return 'Error: missing filename argument'

    switch (call.name) {
      case 'write_file': {
        const file = this.writeFile(sessionId, filename, asString(call.arguments.content))
        return `File written: ${filename} (${formatSize(file.sizeBytes)})`
      }
      case 'read_file': {
        const file = this.store.files.getByFilename(sessionId, filename)
        return file ? file.content : `File not found: ${filename} (not yet created)`
      }
      case 'delete_file':
        return this.deleteFile(sessionId, filename)
      default:
        return `Error: unknown tool`
    }
  }

  private writeFile(sessionId: string, filename: string, content: string) {
    const file = this.store.files.write(sessionId, filename, content)
    this.emit('files:changed', { sessionId, file })
    this.emit('chat:toolActivity', {
      sessionId,
      tool: 'write_file',
      filename,
      result: formatSize(file.sizeBytes)
    })
    return file
  }

  private deleteFile(sessionId: string, filename: string): string {
    const deleted = this.store.files.softDelete(sessionId, filename)
    if (deleted) {
      this.emit('files:deleted', { sessionId, fileId: deleted.id, filename })
    }
    this.emit('chat:toolActivity', { sessionId, tool: 'delete_file', filename, result: 'deleted' })

    if (filename === BOOTSTRAP_FILENAME) {
      this.emit('chat:notice', {
        sessionId,
        message: 'The bot signaled hatching is complete. Click "Complete Hatch" when you are ready.'
      })
      return 'BOOTSTRAP.md dismissed — hatching is wrapping up.'
    }
    return deleted ? `File deleted: ${filename}` : `File not found: ${filename}`
  }

  private buildLlmMessages(sessionId: string, systemPrompt: string): LlmMessage[] {
    const history = this.store.messages.listBySession(sessionId)
    const mapped: LlmMessage[] = history.map((message: Message) => ({
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls ?? undefined,
      toolCallId: message.toolCallId ?? undefined
    }))
    return [{ role: 'system', content: systemPrompt }, ...mapped]
  }

  private trackUsage(sessionId: string, usage: TokenUsage): void {
    // Store the latest call's usage as the current context size (not cumulative).
    this.store.sessions.setTokenUsage(sessionId, usage)
    // Percent against the session's resolved window; fall back to the default
    // and mark it estimated when no window is known.
    const known = this.store.sessions.get(sessionId)?.contextWindow ?? null
    const effective = known ?? DEFAULT_CONTEXT_WINDOW
    this.emit('session:usage', {
      sessionId,
      usage,
      contextPercent: contextPercent(usage, effective),
      contextWindow: effective,
      estimated: known === null
    })
  }

  private resolveProvider(session: Session): LlmProvider {
    if (!session.providerId) throw new Error('This session has no provider configured.')
    const provider = this.store.providers.get(session.providerId)
    if (!provider) throw new Error('The provider for this session no longer exists.')
    const key = this.keys.get(session.providerId) ?? undefined
    return createProvider(provider, key)
  }

  private setState(sessionId: string, state: ConversationState): void {
    this.emit('chat:state', { sessionId, state })
  }

  private requireSession(sessionId: string): Session {
    const session = this.store.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    return session
  }
}
