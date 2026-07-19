import { create } from 'zustand'
import type { CreateProviderInput, ModelInfo, Provider, UpdateProviderInput } from '@shared/types'
import { invoke } from '@renderer/lib/ipc'
import { errorMessage } from '@renderer/lib/errorMessage'

interface ProvidersState {
  providers: Provider[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (input: CreateProviderInput) => Promise<Provider>
  update: (input: UpdateProviderInput) => Promise<void>
  remove: (id: string) => Promise<void>
  saveKey: (providerId: string, key: string) => Promise<void>
  hasKey: (providerId: string) => Promise<boolean>
  deleteKey: (providerId: string) => Promise<void>
  testConnection: (id: string) => Promise<{ ok: boolean; error?: string }>
  listModels: (providerId: string) => Promise<ModelInfo[]>
}

export const useProvidersStore = create<ProvidersState>((set) => ({
  providers: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      set({ providers: await invoke('providers:list', undefined), loading: false })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },

  create: async (input) => {
    const provider = await invoke('providers:create', input)
    set((state) => ({ providers: [...state.providers, provider] }))
    return provider
  },

  update: async (input) => {
    const provider = await invoke('providers:update', input)
    set((state) => ({
      providers: state.providers.map((p) => (p.id === provider.id ? provider : p))
    }))
  },

  remove: async (id) => {
    await invoke('providers:delete', { id })
    set((state) => ({ providers: state.providers.filter((p) => p.id !== id) }))
  },

  saveKey: (providerId, key) => invoke('apiKeys:save', { providerId, key }),
  hasKey: (providerId) => invoke('apiKeys:has', { providerId }),
  deleteKey: (providerId) => invoke('apiKeys:delete', { providerId }),
  testConnection: (id) => invoke('providers:testConnection', { id }),
  listModels: (providerId) => invoke('llm:listModels', { providerId })
}))
