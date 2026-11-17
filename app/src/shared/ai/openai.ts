import type { AIConnectionResult, ChatMessage } from '../types';
import { describeNetworkError, errorFromResponse } from './errors';
import { DEFAULT_BASE_URLS } from './provider';
import type { AIProvider, ProviderRuntime } from './provider';
import { extractOpenAIDelta, readSSEPayloads } from './stream';

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}

/**
 * Any endpoint that implements `POST {base}/chat/completions` and
 * `GET {base}/models` in the OpenAI format.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id: 'openai' | 'openai-compatible';
  readonly label: string;

  protected readonly baseUrl: string;
  protected readonly model: string;
  protected readonly apiKey: string | undefined;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  private readonly timeoutMs: number;
  private readonly labelForErrors: string;

  constructor(runtime: ProviderRuntime, variant: 'openai' | 'openai-compatible' = 'openai-compatible') {
    const { settings } = runtime;
    this.id = variant;
    this.labelForErrors = variant === 'openai' ? 'OpenAI' : 'The endpoint';
    this.label = variant === 'openai' ? 'OpenAI' : 'Custom endpoint';
    this.baseUrl = normalizeBase(
      variant === 'openai'
        ? DEFAULT_BASE_URLS.openai
        : settings.custom.baseUrl || DEFAULT_BASE_URLS['openai-compatible'],
    );
    this.model = variant === 'openai' ? settings.openai.model || settings.model : settings.custom.model || settings.model;
    this.apiKey = runtime.apiKey;
    this.temperature = settings.temperature;
    this.maxTokens = settings.maxTokens;
    this.fetchImpl = runtime.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = runtime.timeoutMs ?? 120_000;
  }

  protected headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  protected async request(path: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
        signal: init.signal ?? controller.signal,
      });
    } catch (error) {
      throw describeNetworkError(error, this.baseUrl, this.labelForErrors);
    } finally {
      clearTimeout(timer);
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.request('/models');
    if (!response.ok) {
      throw errorFromResponse(response.status, await response.text(), this.labelForErrors);
    }
    const data = (await response.json()) as OpenAIModelsResponse;
    return (data.data ?? [])
      .map((entry) => entry.id ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async test(): Promise<AIConnectionResult> {
    try {
      const models = await this.listModels();
      const hasModel = models.some((name) => name === this.model);
      return {
        ok: true,
        models,
        message: hasModel
          ? `Connected to ${this.baseUrl} — ${models.length} model${models.length === 1 ? '' : 's'} available.`
          : `Connected to ${this.baseUrl}. "${this.model}" was not in the model list; pick one from the list if generation fails.`,
      };
    } catch (error) {
      const message = (error as Error).message;
      // Some gateways do not expose /models; a tiny completion proves reachability.
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'model') {
        return {
          ok: false,
          models: [],
          message: `${message} If this endpoint has no /models route, check that the base URL includes the API prefix (for example /v1).`,
        };
      }
      return { ok: false, models: [], message };
    }
  }

  async *stream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string, void, void> {
    const response = await this.request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
      signal,
    });
    if (!response.ok) {
      throw errorFromResponse(response.status, await response.text(), this.labelForErrors);
    }
    if (!response.body) {
      const text = await response.text();
      if (text) yield text;
      return;
    }
    for await (const payload of readSSEPayloads(response.body)) {
      if (payload === '[DONE]') return;
      const delta = extractOpenAIDelta(payload);
      if (delta) yield delta;
    }
  }
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(runtime: ProviderRuntime) {
    super(runtime, 'openai');
  }
}

function normalizeBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme;
}
