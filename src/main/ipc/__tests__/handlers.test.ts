import { describe, it, expect, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { buildHandlers, type IpcContext } from '../handlers'
import { createStore } from '../../store'
import { KeyVault, type Encryptor } from '../../security/keyVault'
import { ConversationEngine } from '../../engine/conversationEngine'
import { BUILTIN_TEMPLATE_ID } from '@shared/constants'

const fakeEncryptor: Encryptor = {
  isAvailable: () => true,
  encrypt: (p) => Buffer.from(p, 'utf8'),
  decrypt: (b) => b.toString('utf8')
}

const tempFiles: string[] = []
afterAll(() => {
  for (const file of tempFiles) rmSync(file, { force: true })
})

function makeCtx(): IpcContext {
  const file = join(tmpdir(), `hatchling-h-${randomUUID()}.json`)
  tempFiles.push(file)
  const store = createStore(':memory:')
  const keyVault = new KeyVault(file, fakeEncryptor)
  return {
    store,
    keyVault,
    engine: new ConversationEngine(store, keyVault, () => {}),
    appVersion: '0.1.0',
    dataPath: '/data'
  }
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

  it('export channels report the phase they arrive in', () => {
    const h = buildHandlers(makeCtx())
    expect(() => h['files:export']({ id: 'x' })).toThrow(/Phase 4/)
  })

  it('templates:update rejects the built-in template', () => {
    const h = buildHandlers(makeCtx())
    expect(() => h['templates:update']({ id: BUILTIN_TEMPLATE_ID, name: 'x' })).toThrow()
  })
})
