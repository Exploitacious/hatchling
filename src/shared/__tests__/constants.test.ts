import { describe, it, expect } from 'vitest'
import {
  BOOTSTRAP_TEMPLATE,
  DEFAULT_OPENING_MESSAGE,
  PROVIDER_SHAPES,
  TOOL_DEFINITIONS,
  VIRTUAL_WORKSPACE_PREAMBLE
} from '../constants'

describe('shared constants', () => {
  it('ships the OpenClaw bootstrap template verbatim', () => {
    expect(BOOTSTRAP_TEMPLATE).toContain('# BOOTSTRAP.md - Hello, World')
    expect(BOOTSTRAP_TEMPLATE).toContain('Delete this file')
    expect(BOOTSTRAP_TEMPLATE.trimEnd()).toMatch(/Make it count\.\s*_$/)
  })

  it('defaults the opening message to the wake-up line', () => {
    expect(DEFAULT_OPENING_MESSAGE).toBe('Wake up, my friend!')
  })

  it('defines exactly the three workspace tools', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name)).toEqual([
      'write_file',
      'read_file',
      'delete_file'
    ])
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.parameters.type).toBe('object')
      expect(Array.isArray(tool.parameters.required)).toBe(true)
    }
  })

  it('preamble names all three tools so the model knows its workspace is virtual', () => {
    for (const name of ['write_file', 'read_file', 'delete_file']) {
      expect(VIRTUAL_WORKSPACE_PREAMBLE).toContain(name)
    }
  })

  it('offers the mock shape plus the three real adapter shapes', () => {
    const shapes = PROVIDER_SHAPES.map((p) => p.shape)
    expect(shapes).toContain('mock')
    expect(shapes).toContain('anthropic')
    expect(shapes).toContain('openai-compatible')
    expect(shapes).toContain('ollama')
    // The mock shape must be usable with no key and no base URL (offline demo).
    const mock = PROVIDER_SHAPES.find((p) => p.shape === 'mock')
    expect(mock?.needsApiKey).toBe(false)
    expect(mock?.needsBaseUrl).toBe(false)
  })
})
