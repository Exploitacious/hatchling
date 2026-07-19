import { describe, it, expect } from 'vitest'
import { LlmError, isAbortError, kindFromHttpStatus, toLlmError } from '../errors'

describe('kindFromHttpStatus', () => {
  it('maps HTTP status codes to error kinds', () => {
    expect(kindFromHttpStatus(401)).toBe('auth')
    expect(kindFromHttpStatus(403)).toBe('auth')
    expect(kindFromHttpStatus(429)).toBe('rate_limit')
    expect(kindFromHttpStatus(413)).toBe('context_length')
    expect(kindFromHttpStatus(422)).toBe('context_length')
    expect(kindFromHttpStatus(500)).toBe('network')
    expect(kindFromHttpStatus(400)).toBe('unknown')
  })
})

describe('toLlmError', () => {
  it('passes an existing LlmError through unchanged', () => {
    const e = new LlmError('auth', 'nope')
    expect(toLlmError(e)).toBe(e)
  })

  it('classifies OpenAI context overflow (HTTP 400 + body code) before status', () => {
    const e = Object.assign(new Error('too long'), {
      status: 400,
      code: 'context_length_exceeded'
    })
    expect(toLlmError(e).kind).toBe('context_length')
  })

  it('classifies auth and rate_limit by status', () => {
    expect(toLlmError(Object.assign(new Error('x'), { status: 401 })).kind).toBe('auth')
    expect(toLlmError(Object.assign(new Error('x'), { status: 429 })).kind).toBe('rate_limit')
  })

  it('classifies an SDK-wrapped connection error via cause.code', () => {
    const e = Object.assign(new Error('Connection error'), {
      name: 'APIConnectionError',
      cause: { code: 'ECONNREFUSED' }
    })
    expect(toLlmError(e).kind).toBe('network')
  })

  it('classifies a raw Node socket error via top-level code', () => {
    expect(toLlmError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })).kind).toBe('network')
  })

  it('classifies an SDK timeout wrapper (no code) by class name', () => {
    const e = Object.assign(new Error('Request timed out'), { name: 'APIConnectionTimeoutError' })
    expect(toLlmError(e).kind).toBe('network')
  })

  it('classifies a node fetch failure via cause.code', () => {
    const e = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    expect(toLlmError(e).kind).toBe('network')
  })

  it('falls back to unknown', () => {
    expect(toLlmError(new Error('something weird')).kind).toBe('unknown')
    expect(toLlmError('a string').kind).toBe('unknown')
  })
})

describe('isAbortError', () => {
  it('detects fetch and SDK aborts', () => {
    expect(isAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true)
    expect(isAbortError(Object.assign(new Error('aborted'), { name: 'APIUserAbortError' }))).toBe(true)
    expect(isAbortError(new Error('nope'))).toBe(false)
    expect(isAbortError(null)).toBe(false)
  })
})
