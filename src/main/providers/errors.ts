import type { LlmErrorKind } from '@shared/types'

/** A normalized provider error carrying a user-classifiable kind. */
export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    message: string
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

/** OS-level socket error codes that mean "couldn't reach the endpoint". */
const NETWORK_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'EAI_AGAIN']

/** Body-level error codes (OpenAI/Anthropic) that mean the context window overflowed. */
const CONTEXT_LENGTH_CODES = ['context_length_exceeded', 'string_above_max_length']

/** Map an HTTP status code from any provider to a normalized error kind. */
export function kindFromHttpStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 413 || status === 422) return 'context_length'
  if (status >= 500) return 'network'
  return 'unknown'
}

/** True when the error is a user-initiated cancellation (fetch or SDK abort). */
export function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown })?.name
  return name === 'AbortError' || name === 'APIUserAbortError'
}

/**
 * Best-effort classification of an arbitrary thrown value. Adapters should
 * prefer throwing `LlmError` directly; this is the catch-all fallback.
 *
 * Note on SDK error shapes: the OpenAI and Anthropic SDKs wrap transport
 * failures in an `APIConnectionError` whose `status` and top-level `code` are
 * both `undefined` — the real OS code lives on `err.cause.code`, and timeouts
 * carry no code at all (only a distinctive class name). Body-level error codes
 * (e.g. `context_length_exceeded`) live on `err.code`.
 */
export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err

  const message = err instanceof Error ? err.message : String(err)
  const e = err as {
    status?: unknown
    code?: unknown
    name?: unknown
    cause?: { code?: unknown }
  }

  // Body-level "context window exceeded" codes (checked before status, since
  // OpenAI reports this as a 400 that would otherwise classify as unknown).
  if (typeof e.code === 'string' && CONTEXT_LENGTH_CODES.includes(e.code)) {
    return new LlmError('context_length', message)
  }

  if (typeof e.status === 'number') {
    return new LlmError(kindFromHttpStatus(e.status), message)
  }

  // OS-level network code — on the raw error or wrapped in `cause`.
  const osCode =
    typeof e.code === 'string' ? e.code : typeof e.cause?.code === 'string' ? e.cause.code : undefined
  if (osCode && NETWORK_CODES.includes(osCode)) {
    return new LlmError('network', message)
  }

  // SDK connection/timeout wrappers carry no code — match by class name/message.
  if (typeof e.name === 'string' && /APIConnection/.test(e.name)) {
    return new LlmError('network', message)
  }
  if (/timed out|timeout|connection error|fetch failed|ECONN|ENOTFOUND/i.test(message)) {
    return new LlmError('network', message)
  }

  return new LlmError('unknown', message)
}
