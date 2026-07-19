import type {
  LlmMessage,
  LlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ModelInfo,
  ProviderShape,
  SendMessageParams,
  ToolCall,
  TokenUsage
} from '@shared/types'

// A deterministic, offline model. It runs a scripted hatch — greet, then write
// IDENTITY.md, USER.md, and SOUL.md, then delete BOOTSTRAP.md — so the whole
// conversation engine (streaming, tool execution, completion, resume) can be
// verified with no network and no API key. It is also selectable in the app for
// an offline demo.
//
// Two modes:
//  - 'tools'  (default): writes files via write_file / delete_file tool calls.
//  - 'inline': emits fenced code blocks instead, to exercise the file-detection
//    fallback parser.

export interface MockProviderOptions {
  mode?: 'tools' | 'inline'
}

const MOCK_MODELS: ModelInfo[] = [
  { id: 'mock-hatchling', provider: 'Mock', contextWindow: 200_000 },
  { id: 'mock-compact', provider: 'Mock', contextWindow: 32_000 }
]

function chunkString(text: string, size = 12): string[] {
  if (text === '') return []
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function lastUserText(messages: LlmMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content.trim()
  }
  return ''
}

function identityContent(hint: string): string {
  return `# IDENTITY.md\n\n- **Name:** Ember\n- **Creature:** a small hearth-spirit\n- **Vibe:** warm, curious, a little playful\n- **Emoji:** 🔥\n\n_Shaped from what you told me: "${hint}"_\n`
}

function userContent(hint: string): string {
  return `# USER.md\n\n- **Call them:** friend\n- **Notes:** "${hint}"\n`
}

function soulContent(hint: string): string {
  return `# SOUL.md\n\nWhat matters: being genuinely useful without losing warmth.\n\nHow to behave: direct, kind, curious. Ask before assuming.\n\nBoundaries: honesty over flattery.\n\n_Grounded in: "${hint}"_\n`
}

export class MockProvider implements LlmProvider {
  readonly shape: ProviderShape = 'mock'
  private readonly mode: 'tools' | 'inline'

  constructor(options: MockProviderOptions = {}) {
    this.mode = options.mode ?? 'tools'
  }

  async listModels(): Promise<ModelInfo[]> {
    return MOCK_MODELS
  }

  async validateConnection(): Promise<boolean> {
    return true
  }

  async sendMessage(params: SendMessageParams): Promise<LlmResponse> {
    if (params.signal?.aborted) {
      return { content: '', toolCalls: [], usage: { input: 0, output: 0, total: 0 }, finishReason: 'aborted' }
    }

    const { messages } = params
    const last = messages[messages.length - 1]

    // Continuation after a tool result (tools mode): acknowledge and end turn.
    if (last?.role === 'tool') {
      return this.respondText(this.ackAfterTool(last.content), params)
    }

    const userTurns = messages.filter((m) => m.role === 'user').length
    const hint = lastUserText(messages)

    switch (userTurns) {
      case 0:
      case 1:
        return this.respondText(
          "Hey — I just came online. I don't know who I am yet, and I barely know you. " +
            "Let's fix that. What should you call me, and what kind of vibe fits?",
          params
        )
      case 2:
        return this.writeFile('IDENTITY.md', identityContent(hint), params)
      case 3:
        return this.writeFile('USER.md', userContent(hint), params)
      case 4:
        return this.writeFile('SOUL.md', soulContent(hint), params)
      case 5:
        return this.finishHatch(params)
      default:
        return this.respondText(
          "I think we've got the shape of me now. Whenever you're ready, complete the hatch.",
          params
        )
    }
  }

  // --- response builders -----------------------------------------------------

  private ackAfterTool(toolResult: string): string {
    return `Done — ${toolResult}. Tell me more, or we can move on.`
  }

  private async respondText(text: string, params: SendMessageParams): Promise<LlmResponse> {
    this.stream(params, text)
    const usage = this.usage(params.messages, text)
    this.emit(params, { type: 'usage', usage })
    this.emit(params, { type: 'done', finishReason: 'stop' })
    return { content: text, toolCalls: [], usage, finishReason: 'stop' }
  }

  private async writeFile(
    filename: string,
    content: string,
    params: SendMessageParams
  ): Promise<LlmResponse> {
    if (this.mode === 'inline') {
      const text = `Here's your ${filename}:\n\n\`\`\`markdown title="${filename}"\n${content}\`\`\`\n`
      return this.respondText(text, params)
    }

    const intro = `Love it. Let me write that down to ${filename}.`
    this.stream(params, intro)
    const toolCall: ToolCall = {
      id: `mock-${filename}`,
      name: 'write_file',
      arguments: { filename, content }
    }
    this.emit(params, { type: 'tool_call', toolCall })
    const usage = this.usage(params.messages, intro + content)
    this.emit(params, { type: 'usage', usage })
    this.emit(params, { type: 'done', finishReason: 'tool_calls' })
    return { content: intro, toolCalls: [toolCall], usage, finishReason: 'tool_calls' }
  }

  private async finishHatch(params: SendMessageParams): Promise<LlmResponse> {
    if (this.mode === 'inline') {
      return this.respondText(
        "I think that's me. I don't need the bootstrap notes anymore — you can complete the hatch.",
        params
      )
    }

    const intro = "I think that's me. I don't need the bootstrap notes anymore."
    this.stream(params, intro)
    const toolCall: ToolCall = {
      id: 'mock-delete-bootstrap',
      name: 'delete_file',
      arguments: { filename: 'BOOTSTRAP.md' }
    }
    this.emit(params, { type: 'tool_call', toolCall })
    const usage = this.usage(params.messages, intro)
    this.emit(params, { type: 'usage', usage })
    this.emit(params, { type: 'done', finishReason: 'tool_calls' })
    return { content: intro, toolCalls: [toolCall], usage, finishReason: 'tool_calls' }
  }

  // --- helpers ---------------------------------------------------------------

  private stream(params: SendMessageParams, text: string): void {
    for (const chunk of chunkString(text)) {
      this.emit(params, { type: 'text', text: chunk })
    }
  }

  private emit(params: SendMessageParams, event: LlmStreamEvent): void {
    params.onEvent?.(event)
  }

  private usage(messages: LlmMessage[], output: string): TokenUsage {
    const input = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
    const out = estimateTokens(output)
    return { input, output: out, total: input + out }
  }
}
