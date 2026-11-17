import type { AIConnectionResult, AIProviderId, AISettings, ChatMessage } from '../types';
import type { AIProviderError } from './errors';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProviderRuntime {
  settings: AISettings;
  /** Decrypted key for the active provider, if one is configured. */
  apiKey?: string | undefined;
  /** Overridable for tests. */
  fetchImpl?: FetchLike;
  /** Overridable for tests; defaults to an idle timeout. */
  timeoutMs?: number;
}

/**
 * The single interface every AI backend implements. The main process owns
 * these instances so API keys never enter the renderer.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly label: string;
  /** Response text chunks for a chat completion. */
  stream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string, void, void>;
  listModels(): Promise<string[]>;
  test(signal?: AbortSignal): Promise<AIConnectionResult>;
}

export type ProviderFactory = (runtime: ProviderRuntime) => AIProvider;

export const PROVIDER_LABELS: Record<AIProviderId, string> = {
  ollama: 'Local model (Ollama)',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'openai-compatible': 'Custom OpenAI-compatible endpoint',
};

export const PROVIDER_BLURBS: Record<AIProviderId, string> = {
  ollama: 'Runs entirely on this machine through a local Ollama server. Nothing leaves your computer.',
  openai: 'Uses your own OpenAI API key. Requests go from this app straight to OpenAI.',
  anthropic: 'Uses your own Anthropic API key. Requests go from this app straight to Anthropic.',
  'openai-compatible': 'Any server that speaks the OpenAI chat completions API — LM Studio, vLLM, OpenRouter, or your own gateway.',
};

export const DEFAULT_MODELS: Record<AIProviderId, string> = {
  ollama: 'llama3.2',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  'openai-compatible': 'gpt-4o-mini',
};

export const DEFAULT_BASE_URLS: Record<AIProviderId, string> = {
  ollama: 'http://127.0.0.1:11434',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  'openai-compatible': 'http://127.0.0.1:1234/v1',
};

export function requiresApiKey(id: AIProviderId): boolean {
  return id === 'openai' || id === 'anthropic';
}

export function providerErrorToPayload(error: unknown): { code: 'unknown'; message: string } {
  return { code: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

export type { AIProviderError };
