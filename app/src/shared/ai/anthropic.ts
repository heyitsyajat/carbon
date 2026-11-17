import type { AIConnectionResult, ChatMessage } from '../types';
import { AIProviderError, describeNetworkError, errorFromResponse, isAbortError } from './errors';
import { DEFAULT_BASE_URLS } from './provider';
import type { AIProvider, ProviderRuntime } from './provider';
import { extractAnthropicDelta, readSSEPayloads } from './stream';

interface AnthropicModelsResponse {
  data?: Array<{ id?: string; display_name?: string }>;
}

const ANTHROPIC_VERSION = '2023-06-01';

/** Direct Anthropic Messages API provider. */
export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly label = 'Anthropic';

  private readonly baseUrl = DEFAULT_BASE_URLS.anthropic;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  private readonly timeoutMs: number;

  constructor(runtime: ProviderRuntime) {
    const { settings } = runtime;
    this.model = settings.anthropic.model || settings.model;
    this.apiKey = runtime.apiKey;
    this.maxTokens = settings.maxTokens;
    this.temperature = Math.min(1, Math.max(0, settings.temperature));
    this.fetchImpl = runtime.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = runtime.timeoutMs ?? 120_000;
  }

  private headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new AIProviderError(
        'auth',
        'Anthropic needs an API key. Add one in Settings → AI.',
      );
    }
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = this.headers();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        signal: init.signal ?? controller.signal,
      });
    } catch (error) {
      if (error instanceof AIProviderError || isAbortError(error)) throw error;
      throw describeNetworkError(error, this.baseUrl, 'Anthropic');
    } finally {
      clearTimeout(timer);
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.request('/models?limit=100');
    if (!response.ok) {
      throw errorFromResponse(response.status, await response.text(), 'Anthropic');
    }
    const data = (await response.json()) as AnthropicModelsResponse;
    return (data.data ?? [])
      .map((entry) => entry.id ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async test(): Promise<AIConnectionResult> {
    try {
      const models = await this.listModels();
      return {
        ok: true,
        models,
        message: `Connected to Anthropic — ${models.length} model${models.length === 1 ? '' : 's'} available.`,
      };
    } catch (error) {
      return { ok: false, models: [], message: (error as Error).message };
    }
  }

  async *stream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string, void, void> {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const conversational = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }));

    const response = await this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: true,
        ...(system ? { system } : {}),
        messages: conversational.length > 0 ? conversational : [{ role: 'user', content: 'Hello' }],
      }),
      signal,
    });
    if (!response.ok) {
      throw errorFromResponse(response.status, await response.text(), 'Anthropic');
    }
    for await (const payload of readSSEPayloads(response.body)) {
      if (payload === '[DONE]') return;
      const delta = extractAnthropicDelta(payload);
      if (delta) yield delta;
    }
  }
}
