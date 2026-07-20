import OpenAI from 'openai'
import type {
  LlmMessage,
  LlmProvider,
  LlmResponse,
  ModelInfo,
  ProviderShape,
  SendMessageParams,
  TokenUsage,
  ToolCall
} from '@shared/types'
import { TOOL_DEFINITIONS } from '@shared/constants'
import type { AdapterConfig } from './factory'
import { LlmError, isAbortError, toLlmError } from './errors'
import { normalizeToolCall, toOpenAiTools } from './toolFormat'
import { probeOpenAiCompatContextWindow } from './contextWindow'

// Adapter for any OpenAI-compatible endpoint (OpenAI, OpenRouter, self-hosted
// gateways, Gemini's OpenAI-compatible endpoint, …) via the `openai` SDK with a
// configurable base URL. The translation helpers below are pure and unit-tested;
// the class is a thin streaming shell around the SDK.

// --- wire types (minimal; decoupled from SDK version churn) ----------------

export interface OpenAiMessageOut {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

interface OpenAiDeltaToolCall {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

interface OpenAiStreamChunk {
  choices?: {
    delta?: { content?: string | null; tool_calls?: OpenAiDeltaToolCall[] }
    finish_reason?: string | null
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
}

// --- pure translation helpers ----------------------------------------------

/** Translate unified messages into OpenAI chat-completion message params. */
export function toOpenAiMessages(messages: LlmMessage[]): OpenAiMessageOut[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
        }))
      }
    }
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' }
    }
    return { role: m.role === 'system' ? 'system' : m.role, content: m.content }
  })
}

/** Map OpenAI usage numbers to unified token usage. */
export function mapOpenAiUsage(usage: OpenAiStreamChunk['usage']): TokenUsage {
  const input = usage?.prompt_tokens ?? 0
  const output = usage?.completion_tokens ?? 0
  return { input, output, total: usage?.total_tokens ?? input + output }
}

/**
 * Reassembles tool calls from streamed deltas. OpenAI streams a tool call's
 * arguments across many chunks keyed by `index`; this buffers them and produces
 * finished, validated ToolCalls.
 */
export class OpenAiToolCallBuffer {
  private readonly byIndex = new Map<number, { id: string; name: string; args: string }>()

  add(deltas: OpenAiDeltaToolCall[] | undefined): void {
    if (!deltas) return
    for (const delta of deltas) {
      const entry = this.byIndex.get(delta.index) ?? { id: '', name: '', args: '' }
      if (delta.id) entry.id = delta.id
      if (delta.function?.name) entry.name = delta.function.name
      if (delta.function?.arguments) entry.args += delta.function.arguments
      this.byIndex.set(delta.index, entry)
    }
  }

  finalize(): ToolCall[] {
    const calls: ToolCall[] = []
    for (const entry of this.byIndex.values()) {
      const call = normalizeToolCall(entry.id || `call_${calls.length}`, entry.name, entry.args)
      if (call) calls.push(call)
    }
    return calls
  }
}

// --- adapter ----------------------------------------------------------------

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly shape: ProviderShape = 'openai-compatible'
  private readonly client: OpenAI

  constructor(config: AdapterConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? 'not-needed',
      baseURL: config.baseUrl
    })
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const page = await this.client.models.list()
      return page.data.map((m) => ({
        id: m.id,
        provider: 'OpenAI-compatible',
        // Endpoints disagree on the field name (or omit it entirely, like base
        // OpenAI); probe the variants seen in the wild.
        contextWindow: probeOpenAiCompatContextWindow(m)
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
    const buffer = new OpenAiToolCallBuffer()
    let text = ''
    let usage: TokenUsage = { input: 0, output: 0, total: 0 }
    let finishReason = 'stop'

    try {
      const request = {
        model: params.model,
        messages: toOpenAiMessages(params.messages),
        tools: toOpenAiTools(params.tools ?? TOOL_DEFINITIONS),
        stream: true,
        stream_options: { include_usage: true },
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {})
      }
      // Single controlled cast at the SDK boundary; our wire types drive the rest.
      const stream = (await this.client.chat.completions.create(
        request as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        { signal: params.signal }
      )) as unknown as AsyncIterable<OpenAiStreamChunk>

      for await (const chunk of stream) {
        if (params.signal?.aborted) break
        const choice = chunk.choices?.[0]
        const delta = choice?.delta
        if (delta?.content) {
          text += delta.content
          emit({ type: 'text', text: delta.content })
        }
        buffer.add(delta?.tool_calls)
        if (choice?.finish_reason) finishReason = choice.finish_reason
        if (chunk.usage) usage = mapOpenAiUsage(chunk.usage)
      }

      if (params.signal?.aborted) finishReason = 'aborted'
      const toolCalls = buffer.finalize()
      for (const toolCall of toolCalls) emit({ type: 'tool_call', toolCall })
      emit({ type: 'usage', usage })
      emit({ type: 'done', finishReason })
      return { content: text, toolCalls, usage, finishReason }
    } catch (err) {
      // A user-initiated cancel is a clean stop, not an error to surface.
      if (isAbortError(err) || params.signal?.aborted) {
        emit({ type: 'usage', usage })
        emit({ type: 'done', finishReason: 'aborted' })
        return { content: text, toolCalls: buffer.finalize(), usage, finishReason: 'aborted' }
      }
      const error = err instanceof LlmError ? err : toLlmError(err)
      emit({ type: 'error', message: error.message, kind: error.kind })
      throw error
    }
  }
}
