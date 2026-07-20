import { describe, it, expect } from 'vitest'
import {
  probeOpenAiCompatContextWindow,
  probeAnthropicContextWindow,
  probeOllamaContextWindow
} from '../contextWindow'

describe('probeOpenAiCompatContextWindow', () => {
  it('reads context_length (OpenRouter/Together style)', () => {
    expect(probeOpenAiCompatContextWindow({ id: 'm', context_length: 131072 })).toBe(131072)
  })

  it('reads context_window (Groq style)', () => {
    expect(probeOpenAiCompatContextWindow({ id: 'm', context_window: 32768 })).toBe(32768)
  })

  it('reads max_model_len (vLLM style)', () => {
    expect(probeOpenAiCompatContextWindow({ id: 'm', max_model_len: 65536 })).toBe(65536)
  })

  it('reads max_context_length (LM Studio native style)', () => {
    expect(probeOpenAiCompatContextWindow({ id: 'm', max_context_length: 8192 })).toBe(8192)
  })

  it('reads nested top_provider.context_length and meta.n_ctx_train', () => {
    expect(
      probeOpenAiCompatContextWindow({ id: 'm', top_provider: { context_length: 200000 } })
    ).toBe(200000)
    expect(probeOpenAiCompatContextWindow({ id: 'm', meta: { n_ctx_train: 131072 } })).toBe(131072)
  })

  it('returns undefined for the bare OpenAI shape (no context fields)', () => {
    expect(
      probeOpenAiCompatContextWindow({ id: 'm', object: 'model', created: 1, owned_by: 'x' })
    ).toBeUndefined()
  })

  it('rejects junk values (zero, negative, strings, non-objects)', () => {
    expect(probeOpenAiCompatContextWindow({ context_length: 0 })).toBeUndefined()
    expect(probeOpenAiCompatContextWindow({ context_length: -5 })).toBeUndefined()
    expect(probeOpenAiCompatContextWindow({ context_length: '128k' })).toBeUndefined()
    expect(probeOpenAiCompatContextWindow(null)).toBeUndefined()
    expect(probeOpenAiCompatContextWindow('model')).toBeUndefined()
  })
})

describe('probeAnthropicContextWindow', () => {
  it('reads max_input_tokens', () => {
    expect(probeAnthropicContextWindow({ id: 'm', max_input_tokens: 200000 })).toBe(200000)
  })

  it('returns undefined when absent', () => {
    expect(probeAnthropicContextWindow({ id: 'm', display_name: 'M' })).toBeUndefined()
  })
})

describe('probeOllamaContextWindow', () => {
  it('finds the arch-prefixed context_length key in model_info', () => {
    expect(
      probeOllamaContextWindow({
        model_info: { 'llama.context_length': 8192, 'llama.embedding_length': 4096 }
      })
    ).toBe(8192)
    expect(probeOllamaContextWindow({ model_info: { 'qwen2.context_length': 32768 } })).toBe(32768)
  })

  it('returns undefined without model_info or a context_length key', () => {
    expect(probeOllamaContextWindow({})).toBeUndefined()
    expect(probeOllamaContextWindow({ model_info: { 'llama.block_count': 32 } })).toBeUndefined()
    expect(probeOllamaContextWindow(null)).toBeUndefined()
  })
})
