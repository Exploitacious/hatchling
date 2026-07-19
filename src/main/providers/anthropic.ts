import type {
  LlmProvider,
  LlmResponse,
  ModelInfo,
  ProviderShape,
  SendMessageParams
} from '@shared/types'
import type { AdapterConfig } from './factory'
import { LlmError } from './errors'

// STUB — implemented in Phase 1's provider fan-out. Uses @anthropic-ai/sdk:
// Messages API with tool_use blocks, streaming, and GET /v1/models for the model
// list (Anthropic does expose a models endpoint — do NOT hardcode a model list).
export class AnthropicProvider implements LlmProvider {
  readonly shape: ProviderShape = 'anthropic'

  constructor(_config: AdapterConfig) {}

  async listModels(): Promise<ModelInfo[]> {
    throw new LlmError('unknown', 'AnthropicProvider.listModels not implemented yet')
  }

  async validateConnection(): Promise<boolean> {
    throw new LlmError('unknown', 'AnthropicProvider.validateConnection not implemented yet')
  }

  async sendMessage(_params: SendMessageParams): Promise<LlmResponse> {
    throw new LlmError('unknown', 'AnthropicProvider.sendMessage not implemented yet')
  }
}
