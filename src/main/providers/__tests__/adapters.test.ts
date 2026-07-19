import { describe, it, expect } from 'vitest'
import type { LlmMessage } from '@shared/types'
import {
  OpenAiToolCallBuffer,
  mapOpenAiUsage,
  toOpenAiMessages
} from '../openaiCompatible'
import {
  extractAnthropicToolCalls,
  mapAnthropicUsage,
  toAnthropicMessages,
  toAnthropicSystem,
  type AnthropicContentBlock
} from '../anthropic'
import { extractOllamaChunk, toOllamaMessages } from '../ollama'

const CONVERSATION: LlmMessage[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'hi' },
  {
    role: 'assistant',
    content: 'writing',
    toolCalls: [
      { id: 't1', name: 'write_file', arguments: { filename: 'A.md', content: 'x' } },
      { id: 't2', name: 'write_file', arguments: { filename: 'B.md', content: 'y' } }
    ]
  },
  { role: 'tool', content: 'wrote A.md', toolCallId: 't1' },
  { role: 'tool', content: 'wrote B.md', toolCallId: 't2' }
]

describe('OpenAI-compatible translation', () => {
  it('encodes assistant tool calls and tool results', () => {
    const msgs = toOpenAiMessages(CONVERSATION)
    expect(msgs[2].tool_calls?.[0].function.name).toBe('write_file')
    expect(msgs[2].tool_calls?.[0].function.arguments).toContain('A.md')
    expect(msgs[3].role).toBe('tool')
    expect(msgs[3].tool_call_id).toBe('t1')
  })

  it('reassembles a tool call from streamed argument fragments', () => {
    const buffer = new OpenAiToolCallBuffer()
    buffer.add([{ index: 0, id: 'call_1', function: { name: 'write_file', arguments: '{"file' } }])
    buffer.add([{ index: 0, function: { arguments: 'name":"SOUL.md","content":"hi"}' } }])
    const calls = buffer.finalize()
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('write_file')
    expect(calls[0].arguments.filename).toBe('SOUL.md')
  })

  it('maps usage', () => {
    expect(mapOpenAiUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })).toEqual({
      input: 10,
      output: 5,
      total: 15
    })
  })
})

describe('Anthropic translation', () => {
  it('extracts the system prompt', () => {
    expect(toAnthropicSystem(CONVERSATION)).toBe('sys')
  })

  it('drops system, emits tool_use blocks, and coalesces tool results', () => {
    const msgs = toAnthropicMessages(CONVERSATION)
    expect(msgs[0]).toEqual({ role: 'user', content: 'hi' })

    const assistant = msgs[1]
    expect(assistant.role).toBe('assistant')
    expect(Array.isArray(assistant.content)).toBe(true)

    const toolMsg = msgs[2]
    expect(toolMsg.role).toBe('user')
    // both tool results merged into one user message
    expect(Array.isArray(toolMsg.content) ? toolMsg.content.length : 0).toBe(2)
    expect(msgs).toHaveLength(3)
  })

  it('extracts tool calls from content blocks', () => {
    const content: AnthropicContentBlock[] = [
      { type: 'text', text: 'hi' },
      { type: 'tool_use', id: 't1', name: 'write_file', input: { filename: 'A.md', content: 'x' } }
    ]
    const calls = extractAnthropicToolCalls(content)
    expect(calls).toHaveLength(1)
    expect(calls[0].arguments.filename).toBe('A.md')
  })

  it('maps usage', () => {
    expect(mapAnthropicUsage({ input_tokens: 8, output_tokens: 4 })).toEqual({
      input: 8,
      output: 4,
      total: 12
    })
  })
})

describe('Ollama translation', () => {
  it('encodes assistant tool calls with object arguments', () => {
    const msgs = toOllamaMessages(CONVERSATION)
    expect(msgs[2].tool_calls?.[0].function.name).toBe('write_file')
    expect(msgs[2].tool_calls?.[0].function.arguments).toEqual({ filename: 'A.md', content: 'x' })
    expect(msgs[3].role).toBe('tool')
  })

  it('extracts text from a streaming chunk', () => {
    const out = extractOllamaChunk({ message: { content: 'hello' }, done: false }, 0)
    expect(out.text).toBe('hello')
    expect(out.done).toBe(false)
    expect(out.usage).toBeNull()
  })

  it('extracts a tool call and usage from the final chunk', () => {
    const out = extractOllamaChunk(
      {
        message: {
          tool_calls: [{ function: { name: 'delete_file', arguments: { filename: 'BOOTSTRAP.md' } } }]
        },
        done: true,
        prompt_eval_count: 20,
        eval_count: 6
      },
      3
    )
    expect(out.toolCalls[0].name).toBe('delete_file')
    expect(out.toolCalls[0].arguments.filename).toBe('BOOTSTRAP.md')
    expect(out.usage).toEqual({ input: 20, output: 6, total: 26 })
  })
})
