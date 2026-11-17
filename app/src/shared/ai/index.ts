import type { AIProviderId, AISettings, SecretKey } from '../types';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { OpenAICompatibleProvider, OpenAIProvider } from './openai';
import { requiresApiKey } from './provider';
import type { AIProvider, FetchLike } from './provider';

export interface ProviderBuildOptions {
  settings: AISettings;
  apiKey?: string | undefined;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/** Resolves the configured provider id to its API-key slot. */
export function secretKeyForProvider(id: AIProviderId): SecretKey | null {
  if (id === 'openai') return 'openai';
  if (id === 'anthropic') return 'anthropic';
  if (id === 'openai-compatible') return 'custom';
  return null;
}

export function createProvider(id: AIProviderId, options: ProviderBuildOptions): AIProvider {
  const runtime = {
    settings: options.settings,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  };
  switch (id) {
    case 'ollama':
      return new OllamaProvider(runtime);
    case 'openai':
      return new OpenAIProvider(runtime);
    case 'anthropic':
      return new AnthropicProvider(runtime);
    case 'openai-compatible':
      return new OpenAICompatibleProvider(runtime, 'openai-compatible');
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown AI provider: ${String(exhaustive)}`);
    }
  }
}

/** Validates the settings that the active provider needs before a request. */
export function validateProviderSettings(settings: AISettings, hasKey: boolean): string | null {
  const id = settings.provider;
  if (requiresApiKey(id) && !hasKey) {
    return `Add your ${id === 'openai' ? 'OpenAI' : 'Anthropic'} API key in Settings → AI.`;
  }
  if (id === 'ollama' && !settings.ollama.baseUrl.trim()) {
    return 'Set the Ollama server address in Settings → AI.';
  }
  if (id === 'ollama' && !settings.ollama.model.trim()) {
    return 'Choose an Ollama model in Settings → AI.';
  }
  if (id === 'openai-compatible' && !settings.custom.baseUrl.trim()) {
    return 'Set the base URL of your OpenAI-compatible endpoint in Settings → AI.';
  }
  if (id === 'openai-compatible' && !settings.custom.model.trim()) {
    return 'Set the model name for your custom endpoint in Settings → AI.';
  }
  return null;
}

export { AnthropicProvider, OllamaProvider, OpenAICompatibleProvider, OpenAIProvider };
