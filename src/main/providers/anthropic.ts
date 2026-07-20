import Anthropic from '@anthropic-ai/sdk'
import type {
  LlmMessage,
  LlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ModelInfo,
  ProviderShape,
  SendMessageParams,
  TokenUsage,
  ToolCall
} from '@shared/types'
import { TOOL_DEFINITIONS } from '@shared/constants'
import type { AdapterConfig } from './factory'
import { LlmError, isAbortError, toLlmError } from './errors'
import { normalizeToolCall, toAnthropicTools } from './toolFormat'
import { probeAnthropicContextWindow } from './contextWindow'

const DEFAULT_MAX_TOKENS = 4096

// Adapter for the Anthropic Messages API. Anthropic separates the `system`
// prompt from the message list, represents tool calls as `tool_use` content
// blocks, and returns tool results as `tool_result` blocks inside user
// messages. The pure translation helpers below handle that shape and are
// unit-tested; the class is a thin streaming shell.

// --- wire types -------------------------------------------------------------

interface AnthropicTextBlock {
  type: 'text'
  text: string
}
interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock

export interface AnthropicMessageOut {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicStreamEvent {
  type: string
  delta?: { type?: string; text?: string }
}

interface AnthropicFinalMessage {
  content: AnthropicContentBlock[]
  usage?: { input_tokens?: number; output_tokens?: number }
  stop_reason?: string | null
}

type AnthropicStreamParams = Parameters<Anthropic['messages']['stream']>[0]

// --- pure translation helpers ----------------------------------------------

/** Concatenate all system messages into Anthropic's single `system` string. */
export function toAnthropicSystem(messages: LlmMessage[]): string {
  return messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
}

/**
 * Translate unified messages into Anthropic messages. System messages are
 * dropped (they go in `system`). Consecutive tool-result messages are coalesced
 * into a single user message with multiple `tool_result` blocks, as Anthropic
 * requires strict user/assistant alternation.
 */
export function toAnthropicMessages(messages: LlmMessage[]): AnthropicMessageOut[] {
  const out: AnthropicMessageOut[] = []
  let pendingToolResults: AnthropicToolResultBlock[] = []

  const flushToolResults = (): void => {
    if (pendingToolResults.length > 0) {
      out.push({ role: 'user', content: pendingToolResults })
      pendingToolResults = []
    }
  }

  for (const m of messages) {
    if (m.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: m.toolCallId ?? '',
        content: m.content
      })
      continue
    }
    flushToolResults()

    if (m.role === 'system') continue

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: AnthropicContentBlock[] = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      for (const tc of m.toolCalls) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments })
      }
      out.push({ role: 'assistant', content: blocks })
    } else {
      out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })
    }
  }
  flushToolResults()
  return out
}

/** Extract tool calls from an Anthropic final message's content blocks. */
export function extractAnthropicToolCalls(content: AnthropicContentBlock[]): ToolCall[] {
  const calls: ToolCall[] = []
  for (const block of content) {
    if (block.type === 'tool_use') {
      const call = normalizeToolCall(block.id, block.name, block.input)
      if (call) calls.push(call)
    }
  }
  return calls
}

export function mapAnthropicUsage(usage: AnthropicFinalMessage['usage']): TokenUsage {
  const input = usage?.input_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  return { input, output, total: input + output }
}

// --- adapter ----------------------------------------------------------------

export class AnthropicProvider implements LlmProvider {
  readonly shape: ProviderShape = 'anthropic'
  private readonly client: Anthropic

  constructor(config: AdapterConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? 'not-needed',
      baseURL: config.baseUrl
    })
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const page = await this.client.models.list()
      return page.data.map((m) => ({
        id: m.id,
        provider: 'Anthropic',
        // The models API reports max_input_tokens (the input context window);
        // probe the raw object since SDK types may lag the API.
        contextWindow: probeAnthropicContextWindow(m)
      }))
    } catch (err) {
      throw toLlmError(err)
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch (err) {
      throw toLlmError(err)
    }
  }

  async sendMessage(params: SendMessageParams): Promise<LlmResponse> {
    const emit = params.onEvent ?? (() => {})
    let text = ''

    try {
      const request = {
        model: params.model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: toAnthropicSystem(params.messages),
        messages: toAnthropicMessages(params.messages),
        tools: toAnthropicTools(params.tools ?? TOOL_DEFINITIONS),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {})
      }
      const stream = this.client.messages.stream(request as unknown as AnthropicStreamParams, {
        signal: params.signal
      })

      for await (const event of stream as unknown as AsyncIterable<AnthropicStreamEvent>) {
        if (params.signal?.aborted) break
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const chunk = event.delta.text ?? ''
          text += chunk
          emit({ type: 'text', text: chunk })
        }
      }

      // On abort, skip finalMessage() — it would reject with the abort and throw.
      if (params.signal?.aborted) return this.abortedResponse(text, emit)

      const final = (await stream.finalMessage()) as unknown as AnthropicFinalMessage
      const toolCalls = extractAnthropicToolCalls(final.content)
      const usage = mapAnthropicUsage(final.usage)
      const finishReason = final.stop_reason ?? 'stop'

      for (const toolCall of toolCalls) emit({ type: 'tool_call', toolCall })
      emit({ type: 'usage', usage })
      emit({ type: 'done', finishReason })
      return { content: text, toolCalls, usage, finishReason }
    } catch (err) {
      if (isAbortError(err) || params.signal?.aborted) return this.abortedResponse(text, emit)
      const error = err instanceof LlmError ? err : toLlmError(err)
      emit({ type: 'error', message: error.message, kind: error.kind })
      throw error
    }
  }

  private abortedResponse(text: string, emit: (event: LlmStreamEvent) => void): LlmResponse {
    const usage: TokenUsage = { input: 0, output: 0, total: 0 }
    emit({ type: 'usage', usage })
    emit({ type: 'done', finishReason: 'aborted' })
    return { content: text, toolCalls: [], usage, finishReason: 'aborted' }
  }
}
