import { describe, it, expect, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { buildHandlers, type IpcContext } from '../handlers'
import { createStore } from '../../store'
import { KeyVault, type Encryptor } from '../../security/keyVault'
import { ConversationEngine } from '../../engine/conversationEngine'
import type { Exporter, ExportFile } from '../../export/exporter'
import { BUILTIN_TEMPLATE_ID } from '@shared/constants'

const OK = { saved: true as const, path: '/tmp/out', fileCount: 1 }
const defaultExporter: Exporter = {
  saveFile: async () => OK,
  saveZip: async () => OK,
  saveToFolder: async () => OK,
  saveText: async () => OK
}

const fakeEncryptor: Encryptor = {
  isAvailable: () => true,
  encrypt: (p) => Buffer.from(p, 'utf8'),
  decrypt: (b) => b.toString('utf8')
}

const tempFiles: string[] = []
afterAll(() => {
  for (const file of tempFiles) rmSync(file, { force: true })
})

function makeCtx(exporter: Exporter = defaultExporter): IpcContext {
  const file = join(tmpdir(), `hatchling-h-${randomUUID()}.json`)
  tempFiles.push(file)
  const store = createStore(':memory:')
  const keyVault = new KeyVault(file, fakeEncryptor)
  return {
    store,
    keyVault,
    engine: new ConversationEngine(store, keyVault, () => {}),
    exporter,
    appVersion: '0.1.0',
    dataPath: '/data'
  }
}

async function seedSessionWithFiles(ctx: IpcContext): Promise<string> {
  const h = buildHandlers(ctx)
  const provider = await h['providers:create']({ shape: 'mock', name: 'M' })
  const session = await h['sessions:create']({
    name: 'My Hatch',
    templateId: BUILTIN_TEMPLATE_ID,
    providerId: provider.id,
    model: 'mock-hatchling'
  })
  ctx.store.files.write(session.id, 'SOUL.md', 'soul')
  const doomed = ctx.store.files.write(session.id, 'GONE.md', 'x')
  ctx.store.files.softDelete(session.id, doomed.filename)
  return session.id
}

describe('IPC handlers', () => {
  it('app:getVersion returns the app version', async () => {
    const h = buildHandlers(makeCtx())
    expect(await h['app:getVersion']()).toBe('0.1.0')
  })

  it('deleting a provider also removes its stored key', async () => {
    const h = buildHandlers(makeCtx())
    const p = await h['providers:create']({
      shape: 'openai-compatible',
      name: 'X',
      baseUrl: 'https://x.test/v1'
    })
    await h['apiKeys:save']({ providerId: p.id, key: 'sekret' })
    expect(await h['apiKeys:has']({ providerId: p.id })).toBe(true)

    await h['providers:delete']({ id: p.id })
    expect(await h['apiKeys:has']({ providerId: p.id })).toBe(false)
  })

  it('sessions:create freezes the template snapshot', async () => {
    const h = buildHandlers(makeCtx())
    const provider = await h['providers:create']({ shape: 'mock', name: 'Mock' })
    const session = await h['sessions:create']({
      name: 'S',
      templateId: BUILTIN_TEMPLATE_ID,
      providerId: provider.id,
      model: 'mock-hatchling'
    })
    expect(session.templateSnapshot).toContain('BOOTSTRAP.md')
    expect(session.openingMessage).toBe('Wake up, my friend!')
  })

  it('sessions:create rejects an unknown template', () => {
    const h = buildHandlers(makeCtx())
    expect(() =>
      h['sessions:create']({ name: 'S', templateId: 'nope', providerId: '', model: 'm' })
    ).toThrow()
  })

  it('llm:listModels works for a mock provider without a key', async () => {
    const h = buildHandlers(makeCtx())
    const p = await h['providers:create']({ shape: 'mock', name: 'Mock' })
    const models = await h['llm:listModels']({ providerId: p.id })
    expect(models.length).toBeGreaterThan(0)
  })

  it('files:export saves the selected file content', async () => {
    const calls: ExportFile[] = []
    const ctx = makeCtx({ ...defaultExporter, saveFile: async (f) => { calls.push(f); return OK } })
    const sessionId = await seedSessionWithFiles(ctx)
    const soul = ctx.store.files.getByFilename(sessionId, 'SOUL.md')
    await buildHandlers(ctx)['files:export']({ id: soul?.id ?? '' })
    expect(calls[0]).toEqual({ filename: 'SOUL.md', content: 'soul' })
  })

  it('files:exportAll (zip) includes only non-deleted files, auto-named', async () => {
    let zipped: ExportFile[] = []
    let zipName = ''
    const ctx = makeCtx({
      ...defaultExporter,
      saveZip: async (name, files) => {
        zipName = name
        zipped = files
        return OK
      }
    })
    const sessionId = await seedSessionWithFiles(ctx)
    await buildHandlers(ctx)['files:exportAll']({ sessionId, mode: 'zip' })
    expect(zipped.map((f) => f.filename)).toEqual(['SOUL.md'])
    expect(zipName).toMatch(/hatchling-My-Hatch.*\.zip/)
  })

  it('files:exportTranscript renders the conversation', async () => {
    let savedText = ''
    const ctx = makeCtx({
      ...defaultExporter,
      saveText: async (_name, content) => {
        savedText = content
        return OK
      }
    })
    const sessionId = await seedSessionWithFiles(ctx)
    ctx.store.messages.create({ sessionId, role: 'user', content: 'hello there' })
    await buildHandlers(ctx)['files:exportTranscript']({ sessionId })
    expect(savedText).toContain('# Hatch transcript')
    expect(savedText).toContain('**You:** hello there')
  })

  it('templates:update rejects the built-in template', () => {
    const h = buildHandlers(makeCtx())
    expect(() => h['templates:update']({ id: BUILTIN_TEMPLATE_ID, name: 'x' })).toThrow()
  })
})
