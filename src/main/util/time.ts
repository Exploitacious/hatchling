/** Current timestamp as an ISO-8601 string — the app's canonical time format. */
export function nowIso(): string {
  return new Date().toISOString()
}
