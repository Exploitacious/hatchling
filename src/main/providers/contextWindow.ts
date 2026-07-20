// Pure helpers for extracting a model's context window from provider metadata.
// The app keeps NO hardcoded per-model table — everything here reads what the
// provider's own API reports, and returns undefined when nothing is reported
// (the app then falls back to DEFAULT_CONTEXT_WINDOW and labels it estimated).

function asPositiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Probe an OpenAI-compatible /v1/models entry for a context-window field.
 * Endpoints disagree on the name, so try every variant seen in the wild:
 * `context_length` (OpenRouter, Together), `context_window` (Groq),
 * `max_model_len` (vLLM), `max_context_length` (LM Studio native),
 * `top_provider.context_length` (OpenRouter nested), `meta.n_ctx_train`
 * (llama.cpp server). Base OpenAI and some gateways report nothing.
 */
export function probeOpenAiCompatContextWindow(raw: unknown): number | undefined {
  const model = asRecord(raw)
  if (!model) return undefined
  const direct =
    asPositiveInt(model.context_length) ??
    asPositiveInt(model.context_window) ??
    asPositiveInt(model.max_model_len) ??
    asPositiveInt(model.max_context_length)
  if (direct) return direct
  const topProvider = asRecord(model.top_provider)
  const nested = topProvider && asPositiveInt(topProvider.context_length)
  if (nested) return nested
  const meta = asRecord(model.meta)
  return meta ? asPositiveInt(meta.n_ctx_train) : undefined
}

/**
 * Probe an Anthropic /v1/models entry. The API reports `max_input_tokens`
 * (the input context window) on each model.
 */
export function probeAnthropicContextWindow(raw: unknown): number | undefined {
  const model = asRecord(raw)
  return model ? asPositiveInt(model.max_input_tokens) : undefined
}

/**
 * Extract the trained context length from an Ollama /api/show response. The
 * key is architecture-prefixed (`llama.context_length`, `qwen2.context_length`,
 * ...), so scan `model_info` for any key ending in `.context_length`.
 */
export function probeOllamaContextWindow(showResponse: unknown): number | undefined {
  const body = asRecord(showResponse)
  const modelInfo = body && asRecord(body.model_info)
  if (!modelInfo) return undefined
  for (const [key, value] of Object.entries(modelInfo)) {
    if (key.endsWith('.context_length')) {
      const parsed = asPositiveInt(value)
      if (parsed) return parsed
    }
  }
  return undefined
}
