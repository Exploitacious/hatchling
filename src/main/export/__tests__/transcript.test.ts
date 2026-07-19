import { describe, it, expect } from 'vitest'
import type { Message } from '@shared/types'
import { buildTranscript } from '../transcript'
import { sanitizeName } from '../exporter'

function msg(partial: Partial<Message> & Pick<Message, 'role' | 'content'>): Message {
  return {
    id: 'm',
    sessionId: 's',
    toolCalls: null,
    toolCallId: null,
    tokens: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial
  }
}

describe('buildTranscript', () => {
  it('renders role labels and tool calls', () => {
    const text = buildTranscript([
      msg({ role: 'user', content: 'Wake up' }),
      msg({
        role: 'assistant',
        content: 'writing',
        toolCalls: [{ id: 't1', name: 'write_file', arguments: { filename: 'SOUL.md' } }]
      }),
      msg({ role: 'tool', content: 'File written: SOUL.md' })
    ])
    expect(text).toContain('# Hatch transcript')
    expect(text).toContain('**You:** Wake up')
    expect(text).toContain('**Bot:** writing')
    expect(text).toContain('`write_file(SOUL.md)`')
    expect(text).toContain('*System:* File written: SOUL.md')
  })

  it('skips empty content but keeps tool calls', () => {
    const text = buildTranscript([
      msg({
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 't1', name: 'delete_file', arguments: { filename: 'BOOTSTRAP.md' } }]
      })
    ])
    expect(text).toContain('`delete_file(BOOTSTRAP.md)`')
    expect(text).not.toMatch(/\*\*Bot:\*\*\s*\n/)
  })
})

describe('sanitizeName', () => {
  it('replaces unsafe characters and falls back', () => {
    expect(sanitizeName('My Hatch #3')).toBe('My-Hatch-3')
    expect(sanitizeName('   ')).toBe('hatch')
    expect(sanitizeName('a/b\\c')).toBe('a-b-c')
  })
})
