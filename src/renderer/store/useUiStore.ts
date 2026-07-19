import { create } from 'zustand'

interface UiState {
  newHatchOpen: boolean
  openNewHatch: () => void
  closeNewHatch: () => void
}

/** Small UI-only store for global overlays (the New Hatch modal). */
export const useUiStore = create<UiState>((set) => ({
  newHatchOpen: false,
  openNewHatch: () => set({ newHatchOpen: true }),
  closeNewHatch: () => set({ newHatchOpen: false })
}))
