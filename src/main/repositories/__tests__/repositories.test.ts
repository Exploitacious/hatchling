import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, type Store } from '../../store'
import { BUILTIN_TEMPLATE_ID } from '@shared/constants'

let store: Store

beforeEach(() => {
  store = createStore(':memory:')
})

describe('templates repository', () => {
  it('seeds the built-in template on open', () => {
    const t = store.templates.get(BUILTIN_TEMPLATE_ID)
    expect(t).not.toBeNull()
    expect(t?.isBuiltin).toBe(true)
    expect(t?.content).toContain('# BOOTSTRAP.md')
  })

  it('lists the built-in template first', () => {
    store.templates.create({ name: 'Custom', content: 'hi' })
    expect(store.templates.list()[0].isBuiltin).toBe(true)
  })

  it('creates, updates, and deletes a custom template', () => {
    const created = store.templates.create({ name: 'C', content: 'x', description: 'd' })
    expect(created.openingMessage).toBe('Wake up, my friend!')

    const updated = store.templates.update({ id: created.id, name: 'C2', content: 'y' })
    expect(updated.name).toBe('C2')
    expect(updated.content).toBe('y')

    store.templates.delete(created.id)
    expect(store.templates.get(created.id)).toBeNull()
  })

  it('refuses to edit or delete the built-in template', () => {
    expect(() => store.templates.update({ id: BUILTIN_TEMPLATE_ID, name: 'x' })).toThrow()
    expect(() => store.templates.delete(BUILTIN_TEMPLATE_ID)).toThrow()
  })
})

describe('providers repository', () => {
  it('creates, reads, updates, and deletes providers', () => {
    const p = store.providers.create({
      shape: 'openai-compatible',
      name: 'OR',
      baseUrl: 'https://example.test/v1'
    })
    expect(p.isOauth).toBe(false)
    expect(store.providers.get(p.id)?.name).toBe('OR')

    const u = store.providers.update({ id: p.id, name: 'OR2' })
    expect(u.name).toBe('OR2')
    expect(u.baseUrl).toBe('https://example.test/v1')

    store.providers.delete(p.id)
    expect(store.providers.get(p.id)).toBeNull()
  })

  it('rejects an unknown provider shape', () => {
    expect(() => store.providers.create({ shape: 'bogus' as never, name: 'x' })).toThrow()
  })
})

describe('sessions, messages, and files', () => {
  function makeSession(): string {
    const t = store.templates.get(BUILTIN_TEMPLATE_ID)
    const s = store.sessions.create({
      name: 'S',
      templateId: t?.id ?? null,
      templateSnapshot: t?.content ?? '',
      openingMessage: t?.openingMessage ?? 'hi',
      providerId: null,
      model: 'mock-hatchling'
    })
    return s.id
  }

  it('creates a session with a frozen snapshot and zeroed usage', () => {
    const s = store.sessions.get(makeSession())
    expect(s?.status).toBe('in_progress')
    expect(s?.templateSnapshot).toContain('BOOTSTRAP.md')
    expect(s?.tokenUsage).toEqual({ input: 0, output: 0, total: 0 })
  })

  it('completing a session stamps completed_at', () => {
    const s = store.sessions.setStatus(makeSession(), 'completed')
    expect(s.status).toBe('completed')
    expect(s.completedAt).not.toBeNull()
  })

  it('round-trips token usage', () => {
    const s = store.sessions.setTokenUsage(makeSession(), { input: 10, output: 5, total: 15 })
    expect(s.tokenUsage).toEqual({ input: 10, output: 5, total: 15 })
  })

  it('stores and lists messages in order with tool calls', () => {
    const id = makeSession()
    store.messages.create({ sessionId: id, role: 'user', content: 'hi' })
    store.messages.create({
      sessionId: id,
      role: 'assistant',
      content: 'writing',
      toolCalls: [{ id: 't1', name: 'write_file', arguments: { filename: 'A.md', content: 'x' } }]
    })
    const msgs = store.messages.listBySession(id)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].toolCalls?.[0].name).toBe('write_file')
  })

  it('upserts, soft-deletes, and resurrects files by name', () => {
    const id = makeSession()
    const f1 = store.files.write(id, 'SOUL.md', 'hello')
    expect(f1.sizeBytes).toBe(5)

    const f2 = store.files.write(id, 'SOUL.md', 'hello world')
    expect(f2.id).toBe(f1.id) // same row — no duplicate
    expect(f2.sizeBytes).toBe(11)

    const deleted = store.files.softDelete(id, 'SOUL.md')
    expect(deleted?.deletedAt).not.toBeNull()
    expect(store.files.getByFilename(id, 'SOUL.md')).toBeNull()

    const f3 = store.files.write(id, 'SOUL.md', 'again') // resurrect
    expect(f3.id).toBe(f1.id)
    expect(f3.deletedAt).toBeNull()
    expect(store.files.listBySession(id)).toHaveLength(1)
  })

  it('cascade-deletes messages and files when a session is deleted', () => {
    const id = makeSession()
    store.messages.create({ sessionId: id, role: 'user', content: 'hi' })
    store.files.write(id, 'A.md', 'x')
    store.sessions.delete(id)
    expect(store.messages.listBySession(id)).toHaveLength(0)
    expect(store.files.listBySession(id)).toHaveLength(0)
  })
})
