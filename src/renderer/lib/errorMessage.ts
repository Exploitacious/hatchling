/** Extract a display string from any thrown value (IPC rejections included). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong.'
}
