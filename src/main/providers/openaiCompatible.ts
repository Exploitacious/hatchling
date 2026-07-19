import type {
  LlmProvider,
  LlmResponse,
  ModelInfo,
  ProviderShape,
  SendMessageParams
} from '@shared/types'
import type { AdapterConfig } from './factory'
import { LlmError } from './errors'

// STUB — implemented in Phase 1's provider fan-out. Uses the `openai` SDK pointed
// at a configurable base URL (covers OpenAI, OpenRouter, self-hosted gateways,
// Gemini's OpenAI-compatible endpoint, etc.): chat completions with function
// calling, SSE streaming, and GET /models for the (dynamic) model list.
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly shape: ProviderShape = 'openai-compatible'

  constructor(_config: AdapterConfig) {}

  async listModels(): Promise<ModelInfo[]> {
    throw new LlmError('unknown', 'OpenAiCompatibleProvider.listModels not implemented yet')
  }

  async validateConnection(): Promise<boolean> {
    throw new LlmError('unknown', 'OpenAiCompatibleProvider.validateConnection not implemented yet')
  }

  async sendMessage(_params: SendMessageParams): Promise<LlmResponse> {
    throw new LlmError('unknown', 'OpenAiCompatibleProvider.sendMessage not implemented yet')
  }
}
