import { create } from 'zustand'
import type { CreateTemplateInput, Template, UpdateTemplateInput } from '@shared/types'
import { invoke } from '@renderer/lib/ipc'
import { errorMessage } from '@renderer/lib/errorMessage'

interface TemplatesState {
  templates: Template[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  get: (id: string) => Template | undefined
  create: (input: CreateTemplateInput) => Promise<Template>
  update: (input: UpdateTemplateInput) => Promise<Template>
  remove: (id: string) => Promise<void>
  duplicate: (id: string) => Promise<Template>
}

export const useTemplatesStore = create<TemplatesState>((set, getState) => ({
  templates: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      set({ templates: await invoke('templates:list', undefined), loading: false })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },

  get: (id) => getState().templates.find((t) => t.id === id),

  create: async (input) => {
    const template = await invoke('templates:create', input)
    set((state) => ({ templates: [template, ...state.templates] }))
    return template
  },

  update: async (input) => {
    const template = await invoke('templates:update', input)
    set((state) => ({
      templates: state.templates.map((t) => (t.id === template.id ? template : t))
    }))
    return template
  },

  remove: async (id) => {
    await invoke('templates:delete', { id })
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }))
  },

  duplicate: async (id) => {
    const original = getState().templates.find((t) => t.id === id)
    if (!original) throw new Error('Template not found')
    const copy = await invoke('templates:create', {
      name: `${original.name} (copy)`,
      description: original.description,
      content: original.content,
      openingMessage: original.openingMessage
    })
    set((state) => ({ templates: [copy, ...state.templates] }))
    return copy
  }
}))
