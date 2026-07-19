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

/** Map an HTTP status code from any provider to a normalized error kind. */
export function kindFromHttpStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 413 || status === 422) return 'context_length'
  if (status >= 500) return 'network'
  return 'unknown'
}

/**
 * Best-effort classification of an arbitrary thrown value. Adapters should
 * prefer throwing `LlmError` directly; this is the catch-all fallback.
 */
export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err

  const message = err instanceof Error ? err.message : String(err)

  // Provider SDKs commonly expose a numeric `status`.
  const status = (err as { status?: unknown })?.status
  if (typeof status === 'number') {
    return new LlmError(kindFromHttpStatus(status), message)
  }

  // Node network failures.
  const code = (err as { code?: unknown })?.code
  if (typeof code === 'string' && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(code)) {
    return new LlmError('network', message)
  }

  return new LlmError('unknown', message)
}
