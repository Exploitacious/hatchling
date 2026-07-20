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
import { LlmError, isAbortError, kindFromHttpStatus, toLlmError } from './errors'
import { normalizeToolCall, toOpenAiTools } from './toolFormat'
import { probeOllamaContextWindow } from './contextWindow'

const DEFAULT_BASE_URL = 'http://localhost:11434'

// Adapter for a local Ollama server. Raw HTTP (no SDK): POST /api/chat with
// NDJSON streaming, GET /api/tags for the installed models. No API key. The
// translation/parse helpers are pure and unit-tested.

// --- wire types -------------------------------------------------------------

export interface OllamaMessageOut {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}

interface OllamaChatChunk {
  message?: {
    content?: string
    tool_calls?: { function?: { name?: string; arguments?: Record<string, unknown> } }[]
  }
  done?: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
  /** Ollama can commit a 200 and then emit an error object mid-stream. */
  error?: string
}

interface OllamaTagsResponse {
  models?: { name?: string; model?: string }[]
}

export interface ExtractedOllamaChunk {
  text: string
  toolCalls: ToolCall[]
  done: boolean
  doneReason?: string
  error?: string
  usage: TokenUsage | null
}

// --- pure helpers -----------------------------------------------------------

/** Translate unified messages into Ollama chat messages. */
export function toOllamaMessages(messages: LlmMessage[]): OllamaMessageOut[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          function: { name: tc.name, arguments: tc.arguments }
        }))
      }
    }
    return { role: m.role, content: m.content }
  })
}

/** Extract text, tool calls, done flag, and usage from one parsed NDJSON chunk. */
export function extractOllamaChunk(chunk: OllamaChatChunk, idSeed: number): ExtractedOllamaChunk {
  const text = chunk.message?.content ?? ''
  const toolCalls: ToolCall[] = []
  const rawCalls = chunk.message?.tool_calls ?? []
  rawCalls.forEach((raw, i) => {
    const call = normalizeToolCall(
      `ollama_${idSeed}_${i}`,
      raw.function?.name ?? '',
      raw.function?.arguments ?? {}
    )
    if (call) toolCalls.push(call)
  })

  const done = chunk.done === true
  const usage: TokenUsage | null = done
    ? {
        input: chunk.prompt_eval_count ?? 0,
        output: chunk.eval_count ?? 0,
        total: (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0)
      }
    : null

  return { text, toolCalls, done, doneReason: chunk.done_reason, error: chunk.error, usage }
}

// --- adapter ----------------------------------------------------------------

export class OllamaProvider implements LlmProvider {
  readonly shape: ProviderShape = 'ollama'
  private readonly baseUrl: string

  constructor(config: AdapterConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      if (!res.ok) throw new LlmError(kindFromHttpStatus(res.status), `Ollama returned ${res.status}`)
      const body = (await res.json()) as OllamaTagsResponse
      const models = (body.models ?? []).map((m) => ({
        id: m.name ?? m.model ?? '',
        provider: 'Ollama'
      }))
      // /api/tags carries no context info — /api/show does, one call per model
      // (local server, small lists). A failed probe just leaves the window
      // unknown; it never fails the listing.
      return Promise.all(
        models.map(async (m): Promise<ModelInfo> => {
          try {
            const show = await fetch(`${this.baseUrl}/api/show`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: m.id })
            })
            if (!show.ok) return m
            return { ...m, contextWindow: probeOllamaContextWindow(await show.json()) }
          } catch {
            return m
          }
        })
      )
    } catch (err) {
      throw toLlmError(err)
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      return res.ok
    } catch (err) {
      throw toLlmError(err)
    }
  }

  async sendMessage(params: SendMessageParams): Promise<LlmResponse> {
    const emit = params.onEvent ?? (() => {})
    const toolCalls: ToolCall[] = []
    let text = ''
    let usage: TokenUsage = { input: 0, output: 0, total: 0 }
    let doneReason: string | undefined
    let chunkSeed = 0

    const handleChunk = (chunk: OllamaChatChunk): void => {
      const extracted = extractOllamaChunk(chunk, chunkSeed++)
      // Ollama can stream an error object after a 200 — surface it, don't swallow.
      if (extracted.error) throw new LlmError('bad_response', extracted.error)
      if (extracted.text) {
        text += extracted.text
        emit({ type: 'text', text: extracted.text })
      }
      for (const call of extracted.toolCalls) {
        toolCalls.push(call)
        emit({ type: 'tool_call', toolCall: call })
      }
      if (extracted.doneReason) doneReason = extracted.doneReason
      if (extracted.usage) usage = extracted.usage
    }

    const finishReason = (): string =>
      doneReason && doneReason !== 'stop'
        ? doneReason
        : toolCalls.length > 0
          ? 'tool_calls'
          : 'stop'

    try {
      const request = {
        model: params.model,
        messages: toOllamaMessages(params.messages),
        tools: toOpenAiTools(params.tools ?? TOOL_DEFINITIONS),
        stream: true,
        ...(params.temperature !== undefined
          ? { options: { temperature: params.temperature } }
          : {})
      }
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: params.signal
      })
      if (!res.ok) {
        throw new LlmError(kindFromHttpStatus(res.status), await readOllamaError(res))
      }
      if (!res.body) {
        throw new LlmError('bad_response', 'Ollama returned no response body')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newline: number
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (line) handleChunk(JSON.parse(line) as OllamaChatChunk)
        }
      }
      const tail = buffer.trim()
      if (tail) handleChunk(JSON.parse(tail) as OllamaChatChunk)

      const reason = finishReason()
      emit({ type: 'usage', usage })
      emit({ type: 'done', finishReason: reason })
      return { content: text, toolCalls, usage, finishReason: reason }
    } catch (err) {
      // A user-initiated cancel is a clean stop, not an error to surface.
      if (isAbortError(err) || params.signal?.aborted) {
        emit({ type: 'usage', usage })
        emit({ type: 'done', finishReason: 'aborted' })
        return { content: text, toolCalls, usage, finishReason: 'aborted' }
      }
      const error = err instanceof LlmError ? err : toLlmError(err)
      emit({ type: 'error', message: error.message, kind: error.kind })
      throw error
    }
  }
}

/** Extract a human error message from a non-2xx Ollama response body. */
async function readOllamaError(res: Response): Promise<string> {
  try {
    const body = await res.text()
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string') {
      return (parsed as { error: string }).error
    }
    return body || `Ollama returned ${res.status}`
  } catch {
    return `Ollama returned ${res.status}`
  }
}
