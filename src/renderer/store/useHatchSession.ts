import { useCallback, useEffect, useState } from 'react'
import type {
  ConversationState,
  FileArtifact,
  Message,
  Session,
  TokenUsage
} from '@shared/types'
import { invoke, subscribe } from '@renderer/lib/ipc'
import { errorMessage } from '@renderer/lib/errorMessage'

export type HatchStatus = ConversationState | 'idle'

export interface StreamingMessage {
  messageId: string
  text: string
}

export interface HatchSession {
  session: Session | null
  messages: Message[]
  files: FileArtifact[]
  status: HatchStatus
  usage: TokenUsage
  contextPercent: number | null
  /** Effective window from the engine (override/reported/default); null before the first usage event. */
  contextWindow: number | null
  /** True when the engine fell back to the default window (no real one known). */
  estimated: boolean
  streaming: StreamingMessage | null
  notice: string | null
  error: string | null
  ready: boolean
  sendMessage: (content: string) => void
  complete: () => Promise<void>
  abort: () => void
}

/** Whether the model is currently working (input should be disabled). */
export function isBusy(status: HatchStatus): boolean {
  return status === 'waiting_for_bot' || status === 'processing_tool_call' || status === 'sending_opening'
}

/**
 * Owns a live hatching session: loads persisted state, subscribes to the
 * engine's push events, and starts (or resumes) the conversation. All chat
 * traffic flows through the main-process engine — this hook never calls an LLM.
 */
export function useHatchSession(sessionId: string): HatchSession {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [files, setFiles] = useState<FileArtifact[]>([])
  const [status, setStatus] = useState<HatchStatus>('idle')
  const [usage, setUsage] = useState<TokenUsage>({ input: 0, output: 0, total: 0 })
  const [contextPercent, setContextPercent] = useState<number | null>(null)
  const [contextWindow, setContextWindow] = useState<number | null>(null)
  const [estimated, setEstimated] = useState(true)
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const unsubscribers = [
      subscribe('chat:message', (p) => {
        if (p.sessionId !== sessionId) return
        setMessages((prev) =>
          prev.some((m) => m.id === p.message.id)
            ? prev.map((m) => (m.id === p.message.id ? p.message : m))
            : [...prev, p.message]
        )
        setStreaming((s) => (s && s.messageId === p.message.id ? null : s))
      }),
      subscribe('chat:token', (p) => {
        if (p.sessionId !== sessionId) return
        if (p.done) {
          setStreaming((s) => (s && s.messageId === p.messageId ? null : s))
          return
        }
        setStreaming((s) => ({
          messageId: p.messageId,
          text: (s && s.messageId === p.messageId ? s.text : '') + p.chunk
        }))
      }),
      subscribe('chat:state', (p) => {
        if (p.sessionId === sessionId) setStatus(p.state)
      }),
      subscribe('chat:notice', (p) => {
        if (p.sessionId === sessionId) setNotice(p.message)
      }),
      subscribe('chat:error', (p) => {
        if (p.sessionId === sessionId) setError(p.message)
      }),
      subscribe('files:changed', (p) => {
        if (p.sessionId !== sessionId) return
        setFiles((prev) =>
          prev.some((f) => f.id === p.file.id)
            ? prev.map((f) => (f.id === p.file.id ? p.file : f))
            : [...prev, p.file]
        )
      }),
      subscribe('files:deleted', (p) => {
        if (p.sessionId !== sessionId) return
        setFiles((prev) =>
          prev.map((f) =>
            f.id === p.fileId || f.filename === p.filename
              ? { ...f, deletedAt: f.deletedAt ?? new Date().toISOString() }
              : f
          )
        )
      }),
      subscribe('session:usage', (p) => {
        if (p.sessionId !== sessionId) return
        setUsage(p.usage)
        setContextPercent(p.contextPercent)
        setContextWindow(p.contextWindow)
        setEstimated(p.estimated)
      })
    ]

    void (async () => {
      try {
        const [loadedSession, loadedMessages, loadedFiles] = await Promise.all([
          invoke('sessions:get', { id: sessionId }),
          invoke('messages:listBySession', { sessionId }),
          invoke('files:listBySession', { sessionId })
        ])
        if (cancelled) return
        setSession(loadedSession)
        setMessages(loadedMessages)
        setFiles(loadedFiles)
        if (loadedSession) setUsage(loadedSession.tokenUsage)
        setReady(true)
        await invoke('chat:start', { sessionId })
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      }
    })()

    return () => {
      cancelled = true
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [sessionId])

  const sendMessage = useCallback(
    (content: string) => {
      setError(null)
      void invoke('chat:sendUserMessage', { sessionId, content }).catch((err) =>
        setError(errorMessage(err))
      )
    },
    [sessionId]
  )

  const complete = useCallback(() => invoke('chat:complete', { sessionId }), [sessionId])
  const abort = useCallback(() => {
    void invoke('chat:abort', { sessionId })
  }, [sessionId])

  return {
    session,
    messages,
    files,
    status,
    usage,
    contextPercent,
    contextWindow,
    estimated,
    streaming,
    notice,
    error,
    ready,
    sendMessage,
    complete,
    abort
  }
}
