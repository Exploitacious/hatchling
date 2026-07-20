// Domain model shared across the main process, preload bridge, and renderer.
// These types are the single source of truth for entity shapes; the SQLite
// schema (main) and the React UI (renderer) both conform to them.

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

// The app is provider-agnostic. Every LLM backend reduces to one of three
// adapter *shapes* plus a deterministic in-process mock used for offline demos
// and as the test backbone. Named vendors (OpenAI, OpenRouter, Gemini's
// OpenAI-compatible endpoint, a self-hosted gateway, etc.) all use the
// `openai-compatible` shape with a configurable base URL.
export type ProviderShape = 'openai-compatible' | 'anthropic' | 'ollama' | 'mock'

// Which backend the key vault is using to store API keys, surfaced to the UI.
// 'os-keychain' is the OS secret store (strongest); 'app-key' is the
// app-managed encrypted fallback for systems without a keychain; 'unavailable'
// means no backend can persist a key.
export type KeyStorageMode = 'os-keychain' | 'app-key' | 'unavailable'

export interface Provider {
  id: string
  shape: ProviderShape
  /** User-facing label, e.g. "OpenRouter" or "Local Ollama". */
  name: string
  /** Base URL for openai-compatible / ollama shapes. Null for anthropic/mock. */
  baseUrl: string | null
  /**
   * Reserved for future per-provider OAuth flows. Always false in v1 — the
   * column exists so the schema does not need a migration when OAuth lands.
   */
  isOauth: boolean
  createdAt: string
}

export interface CreateProviderInput {
  shape: ProviderShape
  name: string
  baseUrl?: string | null
}

export interface UpdateProviderInput {
  id: string
  name?: string
  baseUrl?: string | null
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface Template {
  id: string
  name: string
  description: string | null
  /** The markdown template content — becomes the system prompt during a hatch. */
  content: string
  openingMessage: string
  isBuiltin: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateInput {
  name: string
  description?: string | null
  content: string
  openingMessage?: string
}

export interface UpdateTemplateInput {
  id: string
  name?: string
  description?: string | null
  content?: string
  openingMessage?: string
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionStatus = 'in_progress' | 'completed'

export interface TokenUsage {
  input: number
  output: number
  total: number
}

export interface Session {
  id: string
  name: string
  templateId: string | null
  /** Frozen copy of the template content at session start. */
  templateSnapshot: string
  openingMessage: string
  providerId: string | null
  model: string
  status: SessionStatus
  tokenUsage: TokenUsage
  createdAt: string
  completedAt: string | null
}

export interface CreateSessionInput {
  name: string
  templateId: string
  providerId: string
  model: string
  /** Overrides the template's opening message when set. */
  openingMessage?: string
}

export interface UpdateSessionInput {
  id: string
  name?: string
  status?: SessionStatus
}

// ---------------------------------------------------------------------------
// Messages & tool calls
// ---------------------------------------------------------------------------

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type ToolName = 'write_file' | 'read_file' | 'delete_file'

export interface ToolCall {
  /** Provider-assigned id, used to correlate the tool result message. */
  id: string
  name: ToolName
  arguments: Record<string, unknown>
}

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  /** Present on assistant messages that requested tool calls. */
  toolCalls: ToolCall[] | null
  /** Present on tool-result messages, links back to the ToolCall.id. */
  toolCallId: string | null
  tokens: number | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// File artifacts (in-memory during a hatch, persisted to SQLite)
// ---------------------------------------------------------------------------

export interface FileArtifact {
  id: string
  sessionId: string
  filename: string
  content: string
  sizeBytes: number
  createdAt: string
  updatedAt: string
  /** Soft-delete marker — set when the bot deletes a file (e.g. BOOTSTRAP.md). */
  deletedAt: string | null
}

// ---------------------------------------------------------------------------
// LLM layer (unified interface all provider adapters implement, main-side)
// ---------------------------------------------------------------------------

/** Minimal JSON Schema subtype used for tool parameter definitions. */
export interface JsonSchema {
  type: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  description?: string
  enum?: string[]
  [key: string]: unknown
}

export interface ToolDefinition {
  name: ToolName
  description: string
  parameters: JsonSchema
}

export interface LlmMessage {
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface ModelInfo {
  id: string
  /** Provider label the model belongs to (for grouped display). */
  provider?: string
  /** Max context window in tokens when known; undefined when the model is unknown. */
  contextWindow?: number
}

export type LlmStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; message: string; kind: LlmErrorKind }

export interface SendMessageParams {
  model: string
  messages: LlmMessage[]
  tools?: ToolDefinition[]
  onEvent?: (event: LlmStreamEvent) => void
  signal?: AbortSignal
}

export interface LlmResponse {
  content: string
  toolCalls: ToolCall[]
  usage: TokenUsage
  finishReason: string
}

export interface LlmProvider {
  readonly shape: ProviderShape
  sendMessage(params: SendMessageParams): Promise<LlmResponse>
  listModels(): Promise<ModelInfo[]>
  validateConnection(): Promise<boolean>
}

export type LlmErrorKind =
  | 'rate_limit'
  | 'auth'
  | 'network'
  | 'context_length'
  | 'bad_response'
  | 'unknown'

// ---------------------------------------------------------------------------
// Conversation engine (phase 3)
// ---------------------------------------------------------------------------

export type ConversationState =
  | 'initializing'
  | 'sending_opening'
  | 'waiting_for_bot'
  | 'waiting_for_user'
  | 'processing_tool_call'
  | 'completing'
  | 'completed'
  | 'error'
  | 'paused'
