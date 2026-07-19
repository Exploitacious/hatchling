import { useCallback, useEffect, useState } from 'react'
import type { FileArtifact, Message, Session } from '@shared/types'
import { invoke } from '@renderer/lib/ipc'
import { errorMessage } from '@renderer/lib/errorMessage'

export interface SessionData {
  session: Session | null
  files: FileArtifact[]
  messages: Message[]
  loading: boolean
  error: string | null
  updateFile: (id: string, content: string) => Promise<void>
}

/** Loads a completed session's persisted state (for the results screen). */
export function useSessionData(sessionId: string): SessionData {
  const [session, setSession] = useState<Session | null>(null)
  const [files, setFiles] = useState<FileArtifact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      invoke('sessions:get', { id: sessionId }),
      invoke('files:listBySession', { sessionId }),
      invoke('messages:listBySession', { sessionId })
    ])
      .then(([loadedSession, loadedFiles, loadedMessages]) => {
        if (cancelled) return
        setSession(loadedSession)
        setFiles(loadedFiles)
        setMessages(loadedMessages)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorMessage(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const updateFile = useCallback(async (id: string, content: string) => {
    const updated = await invoke('files:update', { id, content })
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)))
  }, [])

  return { session, files, messages, loading, error, updateFile }
}
