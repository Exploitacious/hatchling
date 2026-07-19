import { describe, it, expect } from 'vitest'
import { MockProvider } from '../mock'
import type { LlmMessage, LlmStreamEvent } from '@shared/types'

function streamedText(events: LlmStreamEvent[]): string {
  return events.map((e) => (e.type === 'text' ? e.text : '')).join('')
}

/** Drive the mock through the engine's turn loop and record file operations. */
async function runHatch(mock: MockProvider): Promise<{ writes: string[]; deletes: string[] }> {
  const messages: LlmMessage[] = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'Wake up, my friend!' }
  ]
  const writes: string[] = []
  const deletes: string[] = []

  async function runTurn(): Promise<void> {
    for (;;) {
      const res = await mock.sendMessage({ model: 'mock-hatchling', messages })
      messages.push({
        role: 'assistant',
        content: res.content,
        toolCalls: res.toolCalls.length > 0 ? res.toolCalls : undefined
      })
      if (res.toolCalls.length === 0) break
      for (const tc of res.toolCalls) {
        const filename = String(tc.arguments.filename)
        if (tc.name === 'write_file') writes.push(filename)
        if (tc.name === 'delete_file') deletes.push(filename)
        messages.push({ role: 'tool', content: `${tc.name} ${filename} ok`, toolCallId: tc.id })
      }
    }
  }

  await runTurn() // opening greeting
  for (const input of ['Call me River, warm vibe', 'UTC', 'be honest', 'looks good']) {
    messages.push({ role: 'user', content: input })
    await runTurn()
  }
  return { writes, deletes }
}

describe('MockProvider (tools mode)', () => {
  it('lists models and validates without a key', async () => {
    const mock = new MockProvider()
    expect(await mock.validateConnection()).toBe(true)
    const models = await mock.listModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models[0].contextWindow).toBeGreaterThan(0)
  })

  it('opening turn streams greeting text with no tool call', async () => {
    const mock = new MockProvider()
    const events: LlmStreamEvent[] = []
    const res = await mock.sendMessage({
      model: 'mock-hatchling',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'Wake up, my friend!' }
      ],
      onEvent: (e) => events.push(e)
    })
    expect(res.toolCalls).toHaveLength(0)
    expect(res.finishReason).toBe('stop')
    expect(streamedText(events)).toBe(res.content)
    expect(res.usage.total).toBeGreaterThan(0)
  })

  it('runs a full scripted hatch: writes 3 files then deletes BOOTSTRAP.md', async () => {
    const { writes, deletes } = await runHatch(new MockProvider())
    expect(writes).toEqual(['IDENTITY.md', 'USER.md', 'SOUL.md'])
    expect(deletes).toEqual(['BOOTSTRAP.md'])
  })

  it('emits a usage event and a done event every response', async () => {
    const mock = new MockProvider()
    const events: LlmStreamEvent[] = []
    await mock.sendMessage({
      model: 'mock-hatchling',
      messages: [{ role: 'user', content: 'Wake up, my friend!' }],
      onEvent: (e) => events.push(e)
    })
    expect(events.some((e) => e.type === 'usage')).toBe(true)
    expect(events.some((e) => e.type === 'done')).toBe(true)
  })
})

describe('MockProvider (inline mode)', () => {
  it('emits fenced code blocks instead of tool calls', async () => {
    const mock = new MockProvider({ mode: 'inline' })
    const messages: LlmMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'Wake up, my friend!' },
      { role: 'assistant', content: 'greeting' },
      { role: 'user', content: 'Call me River' }
    ]
    const res = await mock.sendMessage({ model: 'mock-hatchling', messages })
    expect(res.toolCalls).toHaveLength(0)
    expect(res.content).toContain('```markdown title="IDENTITY.md"')
  })
})
