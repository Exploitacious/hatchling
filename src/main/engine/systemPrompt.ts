import { VIRTUAL_WORKSPACE_PREAMBLE } from '@shared/constants'

/**
 * Build the system prompt for a hatch: the fixed virtual-workspace preamble
 * followed by the (frozen) template content, unchanged. The preamble tells the
 * model its filesystem is virtual and driven by the write/read/delete tools.
 */
export function buildSystemPrompt(templateSnapshot: string): string {
  return `${VIRTUAL_WORKSPACE_PREAMBLE}\n\n${templateSnapshot}`
}
