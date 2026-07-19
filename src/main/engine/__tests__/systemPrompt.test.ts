import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../systemPrompt'
import { VIRTUAL_WORKSPACE_PREAMBLE } from '@shared/constants'

describe('buildSystemPrompt', () => {
  it('places the preamble before the template content', () => {
    const prompt = buildSystemPrompt('# My Template\ninstructions')
    expect(prompt.startsWith(VIRTUAL_WORKSPACE_PREAMBLE)).toBe(true)
    expect(prompt).toContain('# My Template')
    expect(prompt.indexOf('write_file')).toBeLessThan(prompt.indexOf('# My Template'))
  })
})
