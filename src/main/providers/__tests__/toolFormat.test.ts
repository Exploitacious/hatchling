import { describe, it, expect } from 'vitest'
import {
  isKnownToolName,
  normalizeToolCall,
  toAnthropicTools,
  toOpenAiTools
} from '../toolFormat'
import { TOOL_DEFINITIONS } from '@shared/constants'

describe('tool format translation', () => {
  it('maps unified tools to OpenAI function format', () => {
    const tools = toOpenAiTools(TOOL_DEFINITIONS)
    expect(tools[0].type).toBe('function')
    expect(tools[0].function.name).toBe('write_file')
    expect(tools[0].function.parameters.type).toBe('object')
  })

  it('maps unified tools to Anthropic input_schema format', () => {
    const tools = toAnthropicTools(TOOL_DEFINITIONS)
    expect(tools[0].name).toBe('write_file')
    expect(tools[0].input_schema.required).toContain('filename')
  })

  it('normalizes a tool call from JSON-string arguments', () => {
    const tc = normalizeToolCall('id1', 'write_file', '{"filename":"A.md","content":"x"}')
    expect(tc?.name).toBe('write_file')
    expect(tc?.arguments.filename).toBe('A.md')
  })

  it('normalizes a tool call from object arguments', () => {
    const tc = normalizeToolCall('id2', 'delete_file', { filename: 'B.md' })
    expect(tc?.arguments.filename).toBe('B.md')
  })

  it('rejects unknown tool names', () => {
    expect(isKnownToolName('run_shell')).toBe(false)
    expect(normalizeToolCall('id', 'run_shell', '{}')).toBeNull()
  })

  it('rejects malformed JSON arguments', () => {
    expect(normalizeToolCall('id', 'write_file', '{not json')).toBeNull()
  })
})
