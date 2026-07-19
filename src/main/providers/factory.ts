import type { LlmProvider, Provider } from '@shared/types'
import { MockProvider } from './mock'
import { AnthropicProvider } from './anthropic'
import { OpenAiCompatibleProvider } from './openaiCompatible'
import { OllamaProvider } from './ollama'
import { LlmError } from './errors'

/** Construction inputs common to the real adapters. */
export interface AdapterConfig {
  apiKey?: string
  baseUrl?: string
}

/**
 * Build a live provider instance from a stored provider row and (optionally) its
 * decrypted API key. The key is passed in by the caller (main) — it is read from
 * the key vault and never crosses IPC.
 */
export function createProvider(provider: Provider, apiKey?: string): LlmProvider {
  const baseUrl = provider.baseUrl ?? undefined
  switch (provider.shape) {
    case 'mock':
      return new MockProvider()
    case 'anthropic':
      return new AnthropicProvider({ apiKey, baseUrl })
    case 'openai-compatible':
      return new OpenAiCompatibleProvider({ apiKey, baseUrl })
    case 'ollama':
      return new OllamaProvider({ baseUrl })
    default:
      throw new LlmError('unknown', `Unsupported provider shape: ${provider.shape}`)
  }
}
