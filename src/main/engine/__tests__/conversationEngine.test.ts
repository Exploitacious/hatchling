import { describe, it, expect } from 'vitest'
import { createStore, type Store } from '../../store'
import { BUILTIN_TEMPLATE_ID } from '@shared/constants'
import type { IpcEventName } from '@shared/ipc'
import type { Session } from '@shared/types'
import { ConversationEngine } from '../conversationEngine'

interface CapturedEvent {
  event: IpcEventName
  payload: unknown
}

function setup(): {
  store: Store
  session: Session
  engine: ConversationEngine
  events: CapturedEvent[]
} {
  const store = createStore(':memory:')
  const builtin = store.templates.get(BUILTIN_TEMPLATE_ID)
  if (!builtin) throw new Error('missing builtin template')
  const provider = store.providers.create({ shape: 'mock', name: 'Mock' })
  const session = store.sessions.create({
    name: 'S',
    templateId: builtin.id,
    templateSnapshot: builtin.content,
    openingMessage: builtin.openingMessage,
    providerId: provider.id,
    model: 'mock-hatchling'
  })
  const events: CapturedEvent[] = []
  const engine = new ConversationEngine(store, { get: () => null }, (event, payload) => {
    events.push({ event, payload })
  })
  return { store, session, engine, events }
}

const USER_TURNS = ['Call me River', 'timezone UTC', 'be honest', 'looks good']

describe('ConversationEngine', () => {
  it('sends the opening message and gets a greeting on start', async () => {
    const { store, session, engine } = setup()
    await engine.start(session.id)
    const messages = store.messages.listBySession(session.id)
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Wake up, my friend!' })
    expect(messages[1].role).toBe('assistant')
    expect(store.sessions.get(session.id)?.tokenUsage.total).toBeGreaterThan(0)
  })

  it('runs a full hatch: writes IDENTITY/USER/SOUL and dismisses BOOTSTRAP', async () => {
    const { store, session, engine, events } = setup()
    await engine.start(session.id)
    for (const turn of USER_TURNS) {
      await engine.sendUserMessage(session.id, turn)
    }

    const files = store.files.listBySession(session.id, false).map((f) => f.filename)
    expect(files).toEqual(['IDENTITY.md', 'USER.md', 'SOUL.md'])

    // Files were pushed to the renderer as they were written.
    const changed = events.filter((e) => e.event === 'files:changed')
    expect(changed.length).toBeGreaterThanOrEqual(3)

    // Deleting BOOTSTRAP.md surfaces the completion notice.
    const notices = events.filter((e) => e.event === 'chat:notice')
    expect(notices.some((n) => JSON.stringify(n.payload).includes('hatching is complete'))).toBe(true)

    // Streaming tokens were relayed.
    expect(events.some((e) => e.event === 'chat:token')).toBe(true)
  })

  it('resumes without re-sending the opening message', async () => {
    const { store, session, engine } = setup()
    await engine.start(session.id)
    const countAfterStart = store.messages.listBySession(session.id).length

    // A fresh engine over the same store (as after an app restart).
    const events: CapturedEvent[] = []
    const resumed = new ConversationEngine(store, { get: () => null }, (event, payload) => {
      events.push({ event, payload })
    })
    await resumed.start(session.id)

    expect(store.messages.listBySession(session.id).length).toBe(countAfterStart)
    expect(
      events.some((e) => e.event === 'chat:state' && JSON.stringify(e.payload).includes('waiting_for_user'))
    ).toBe(true)
  })

  it('completes a session', async () => {
    const { store, session, engine, events } = setup()
    await engine.start(session.id)
    await engine.complete(session.id)
    expect(store.sessions.get(session.id)?.status).toBe('completed')
    expect(
      events.some((e) => e.event === 'chat:state' && JSON.stringify(e.payload).includes('completed'))
    ).toBe(true)
  })
})
