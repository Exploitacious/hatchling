import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

interface SettingsState {
  theme: Theme
  /** The provider + model chosen as the default for new hatches. */
  defaultProviderId: string | null
  defaultModel: string | null
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setDefaultModel: (providerId: string, model: string) => void
  clearDefaultModel: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      defaultProviderId: null,
      defaultModel: null,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setDefaultModel: (defaultProviderId, defaultModel) =>
        set({ defaultProviderId, defaultModel }),
      clearDefaultModel: () => set({ defaultProviderId: null, defaultModel: null })
    }),
    { name: 'hatchling-settings' }
  )
)
