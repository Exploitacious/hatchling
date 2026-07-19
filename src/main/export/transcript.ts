import type { Message } from '@shared/types'

function label(role: Message['role']): string {
  switch (role) {
    case 'assistant':
      return '**Bot:**'
    case 'user':
      return '**You:**'
    default:
      return '*System:*'
  }
}

/** Render a session's messages as a readable Markdown transcript. */
export function buildTranscript(messages: Message[]): string {
  const lines: string[] = ['# Hatch transcript', '']

  for (const message of messages) {
    if (message.content.trim().length > 0) {
      lines.push(`${label(message.role)} ${message.content}`)
    }
    if (message.toolCalls) {
      for (const call of message.toolCalls) {
        const filename =
          typeof call.arguments.filename === 'string' ? call.arguments.filename : ''
        lines.push(`  - \`${call.name}(${filename})\``)
      }
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}
