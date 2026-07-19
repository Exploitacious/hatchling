import { describe, it, expect, afterEach, vi } from 'vitest'
import { OllamaProvider } from '../ollama'
import type { LlmMessage, LlmStreamEvent } from '@shared/types'

const MESSAGES: LlmMessage[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'hi' }
]

function streamFrom(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part))
      controller.close()
    }
  })
}

function stubFetch(impl: () => Promise<unknown>): void {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function streamedText(events: LlmStreamEvent[]): string {
  return events.map((e) => (e.type === 'text' ? e.text : '')).join('')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OllamaProvider.sendMessage streaming', () => {
  it('reassembles a JSON object split across read() boundaries', async () => {
    // The first NDJSON line is split mid-object between two stream chunks.
    stubFetch(async () => ({
      ok: true,
      status: 200,
      body: streamFrom([
        '{"message":{"content":"Hel',
        'lo"},"done":false}\n{"message":{"content":" world"},"done":false}\n',
        '{"message":{},"done":true,"done_reason":"stop","prompt_eval_count":10,"eval_count":3}\n'
      ])
    }))

    const events: LlmStreamEvent[] = []
    const res = await new OllamaProvider({ baseUrl: 'http://localhost:11434' }).sendMessage({
      model: 'llama',
      messages: MESSAGES,
      onEvent: (e) => events.push(e)
    })

    expect(res.content).toBe('Hello world')
    expect(streamedText(events)).toBe('Hello world')
    expect(res.usage).toEqual({ input: 10, output: 3, total: 13 })
    expect(res.finishReason).toBe('stop')
  })

  it('surfaces done_reason:length as the finish reason', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      body: streamFrom(['{"message":{"content":"partial"},"done":true,"done_reason":"length"}\n'])
    }))
    const res = await new OllamaProvider({}).sendMessage({ model: 'llama', messages: MESSAGES })
    expect(res.finishReason).toBe('length')
  })

  it('throws when the stream emits a mid-stream error object', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      body: streamFrom(['{"message":{"content":"warming up"},"done":false}\n{"error":"runner crashed"}\n'])
    }))
    await expect(
      new OllamaProvider({}).sendMessage({ model: 'llama', messages: MESSAGES })
    ).rejects.toThrow('runner crashed')
  })

  it('includes the server error body on a non-2xx response', async () => {
    stubFetch(async () => ({
      ok: false,
      status: 404,
      text: async () => '{"error":"model \'llama\' not found"}'
    }))
    await expect(
      new OllamaProvider({}).sendMessage({ model: 'llama', messages: MESSAGES })
    ).rejects.toThrow(/not found/)
  })

  it('returns a clean aborted response instead of throwing on cancel', async () => {
    stubFetch(async () => {
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    })
    const controller = new AbortController()
    controller.abort()
    const res = await new OllamaProvider({}).sendMessage({
      model: 'llama',
      messages: MESSAGES,
      signal: controller.signal
    })
    expect(res.finishReason).toBe('aborted')
  })
})
