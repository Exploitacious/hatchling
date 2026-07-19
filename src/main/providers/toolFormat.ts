import type { JsonSchema, ToolCall, ToolDefinition, ToolName } from '@shared/types'

// Pure translation helpers between the app's unified tool format and each
// provider's native format. Kept separate from the adapters so every adapter
// speaks the same dialect and the translation is unit-testable in isolation.

const KNOWN_TOOLS: readonly ToolName[] = ['write_file', 'read_file', 'delete_file']

export interface OpenAiTool {
  type: 'function'
  function: { name: string; description: string; parameters: JsonSchema }
}

export interface AnthropicTool {
  name: string
  description: string
  input_schema: JsonSchema
}

/** OpenAI (and OpenAI-compatible, and Ollama) function-tool format. */
export function toOpenAiTools(defs: readonly ToolDefinition[]): OpenAiTool[] {
  return defs.map((d) => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.parameters }
  }))
}

/** Anthropic tool format (`input_schema` instead of `parameters`). */
export function toAnthropicTools(defs: readonly ToolDefinition[]): AnthropicTool[] {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.parameters
  }))
}

/** True when a tool name is one Hatchling defines. */
export function isKnownToolName(name: string): name is ToolName {
  return (KNOWN_TOOLS as readonly string[]).includes(name)
}

/**
 * Normalize a raw tool call from any provider into the unified `ToolCall`.
 * `rawArguments` may be a JSON string (OpenAI/Ollama) or an object (Anthropic).
 * Returns null when the tool name is unknown or the arguments cannot be parsed.
 */
export function normalizeToolCall(
  id: string,
  name: string,
  rawArguments: string | Record<string, unknown> | undefined
): ToolCall | null {
  if (!isKnownToolName(name)) return null

  let args: Record<string, unknown>
  if (typeof rawArguments === 'string') {
    try {
      args = JSON.parse(rawArguments || '{}') as Record<string, unknown>
    } catch {
      return null
    }
  } else {
    args = rawArguments ?? {}
  }

  return { id, name, arguments: args }
}
