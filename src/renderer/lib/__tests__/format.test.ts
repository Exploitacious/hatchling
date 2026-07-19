import { describe, it, expect } from 'vitest'
import { formatBytes, formatDuration } from '../format'

describe('formatBytes', () => {
  it('formats bytes, KB, and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2300)).toBe('2.2 KB')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
})

describe('formatDuration', () => {
  it('formats seconds and minutes', () => {
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:45Z')).toBe('45s')
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:03:12Z')).toBe('3m 12s')
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T01:30:00Z')).toBe('1h 30m')
  })

  it('returns empty for invalid ranges', () => {
    expect(formatDuration('bad', '2026-01-01T00:00:00Z')).toBe('')
    expect(formatDuration('2026-01-01T00:01:00Z', '2026-01-01T00:00:00Z')).toBe('')
  })
})
