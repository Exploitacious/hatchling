import type { IpcHandlers } from '@shared/ipc'
import type { Store } from '../store'
import type { KeyVault } from '../security/keyVault'
import type { ConversationEngine } from '../engine/conversationEngine'
import type { Exporter } from '../export/exporter'
import { sanitizeName } from '../export/exporter'
import { buildTranscript } from '../export/transcript'
import { createProvider } from '../providers/factory'

export interface IpcContext {
  store: Store
  keyVault: KeyVault
  engine: ConversationEngine
  exporter: Exporter
  appVersion: string
  dataPath: string
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Build the full IPC handler map. Pure and free of any Electron import so it can
 * be unit-tested directly against an in-memory store. Channels that belong to
 * later phases are present (the contract is complete) but throw a clear error.
 */
export function buildHandlers(ctx: IpcContext): IpcHandlers {
  const { store, keyVault } = ctx

  return {
    'app:getVersion': () => ctx.appVersion,
    'app:getDataPath': () => ctx.dataPath,

    'providers:list': () => store.providers.list(),
    'providers:get': ({ id }) => store.providers.get(id),
    'providers:create': (input) => store.providers.create(input),
    'providers:update': (input) => store.providers.update(input),
    'providers:delete': ({ id }) => {
      keyVault.delete(id)
      store.providers.delete(id)
    },
    'providers:testConnection': async ({ id }) => {
      const provider = store.providers.get(id)
      if (!provider) return { ok: false, error: 'Provider not found' }
      try {
        const key = keyVault.get(id) ?? undefined
        const ok = await createProvider(provider, key).validateConnection()
        return { ok }
      } catch (err) {
        return { ok: false, error: messageOf(err) }
      }
    },

    'apiKeys:save': ({ providerId, key }) => {
      keyVault.save(providerId, key)
    },
    'apiKeys:has': ({ providerId }) => keyVault.has(providerId),
    'apiKeys:delete': ({ providerId }) => {
      keyVault.delete(providerId)
    },

    'templates:list': () => store.templates.list(),
    'templates:get': ({ id }) => store.templates.get(id),
    'templates:create': (input) => store.templates.create(input),
    'templates:update': (input) => store.templates.update(input),
    'templates:delete': ({ id }) => {
      store.templates.delete(id)
    },

    'sessions:list': () => store.sessions.list(),
    'sessions:get': ({ id }) => store.sessions.get(id),
    'sessions:create': (input) => {
      const template = store.templates.get(input.templateId)
      if (!template) throw new Error(`Template not found: ${input.templateId}`)
      return store.sessions.create({
        name: input.name,
        templateId: input.templateId,
        templateSnapshot: template.content,
        openingMessage: input.openingMessage ?? template.openingMessage,
        providerId: input.providerId,
        model: input.model
      })
    },
    'sessions:update': (input) => store.sessions.update(input),
    'sessions:delete': ({ id }) => {
      store.sessions.delete(id)
    },

    'messages:listBySession': ({ sessionId }) => store.messages.listBySession(sessionId),

    'files:listBySession': ({ sessionId }) => store.files.listBySession(sessionId),
    'files:get': ({ id }) => store.files.get(id),
    'files:update': ({ id, content }) => store.files.updateContent(id, content),
    'files:export': ({ id }) => {
      const file = store.files.get(id)
      if (!file) throw new Error('File not found')
      return ctx.exporter.saveFile({ filename: file.filename, content: file.content })
    },
    'files:exportAll': ({ sessionId, mode }) => {
      const session = store.sessions.get(sessionId)
      const files = store.files
        .listBySession(sessionId, false)
        .map((f) => ({ filename: f.filename, content: f.content }))
      if (files.length === 0) throw new Error('There are no files to export.')
      if (mode === 'zip') {
        return ctx.exporter.saveZip(`hatchling-${sanitizeName(session?.name ?? 'hatch')}.zip`, files)
      }
      return ctx.exporter.saveToFolder(files)
    },
    'files:exportTranscript': ({ sessionId }) => {
      const session = store.sessions.get(sessionId)
      const transcript = buildTranscript(store.messages.listBySession(sessionId))
      return ctx.exporter.saveText(
        `hatchling-transcript-${sanitizeName(session?.name ?? 'hatch')}.md`,
        transcript
      )
    },

    'llm:listModels': async ({ providerId }) => {
      const provider = store.providers.get(providerId)
      if (!provider) throw new Error(`Provider not found: ${providerId}`)
      const key = keyVault.get(providerId) ?? undefined
      return createProvider(provider, key).listModels()
    },

    'chat:start': ({ sessionId }) => ctx.engine.start(sessionId),
    'chat:sendUserMessage': ({ sessionId, content }) =>
      ctx.engine.sendUserMessage(sessionId, content),
    'chat:complete': ({ sessionId }) => ctx.engine.complete(sessionId),
    'chat:abort': ({ sessionId }) => {
      ctx.engine.abort(sessionId)
    }
  }
}
