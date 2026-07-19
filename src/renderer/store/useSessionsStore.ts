import { create } from 'zustand'
import type { CreateSessionInput, Session, UpdateSessionInput } from '@shared/types'
import { invoke } from '@renderer/lib/ipc'
import { errorMessage } from '@renderer/lib/errorMessage'

interface SessionsState {
  sessions: Session[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (input: CreateSessionInput) => Promise<Session>
  update: (input: UpdateSessionInput) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      set({ sessions: await invoke('sessions:list', undefined), loading: false })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },

  create: async (input) => {
    const session = await invoke('sessions:create', input)
    set((state) => ({ sessions: [session, ...state.sessions] }))
    return session
  },

  update: async (input) => {
    const session = await invoke('sessions:update', input)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s))
    }))
  },

  remove: async (id) => {
    await invoke('sessions:delete', { id })
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
  }
}))
