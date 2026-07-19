import type {
  LlmProvider,
  LlmResponse,
  ModelInfo,
  ProviderShape,
  SendMessageParams
} from '@shared/types'
import type { AdapterConfig } from './factory'
import { LlmError } from './errors'

// STUB — implemented in Phase 1's provider fan-out. Raw HTTP to a local Ollama
// server (no SDK): POST /api/chat with tools and NDJSON streaming, and GET
// /api/tags for the installed-model list. No API key required.
export class OllamaProvider implements LlmProvider {
  readonly shape: ProviderShape = 'ollama'

  constructor(_config: AdapterConfig) {}

  async listModels(): Promise<ModelInfo[]> {
    throw new LlmError('unknown', 'OllamaProvider.listModels not implemented yet')
  }

  async validateConnection(): Promise<boolean> {
    throw new LlmError('unknown', 'OllamaProvider.validateConnection not implemented yet')
  }

  async sendMessage(_params: SendMessageParams): Promise<LlmResponse> {
    throw new LlmError('unknown', 'OllamaProvider.sendMessage not implemented yet')
  }
}
