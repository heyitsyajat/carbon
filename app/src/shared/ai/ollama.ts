import type { AIConnectionResult, ChatMessage } from '../types';
import { AIProviderError, describeNetworkError, errorFromResponse } from './errors';
import type { AIProvider, ProviderRuntime } from './provider';
import { readNDJSON } from './stream';

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

/** Talks to a local Ollama server over its native HTTP API. */
export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const;
  readonly label = 'Local model (Ollama)';

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  private readonly timeoutMs: number;

  constructor(runtime: ProviderRuntime) {
    const { settings } = runtime;
    this.baseUrl = normalizeBaseUrl(settings.ollama.baseUrl || 'http://127.0.0.1:11434');
    this.model = settings.ollama.model || settings.model || 'llama3.2';
    this.temperature = settings.temperature;
    this.maxTokens = settings.maxTokens;
    this.fetchImpl = runtime.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = runtime.timeoutMs ?? 120_000;
  }

  private request(path: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = init.signal ?? controller.signal;
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      signal,
    }).finally(() => clearTimeout(timer));
  }

  async listModels(): Promise<string[]> {
    let response: Response;
    try {
      response = await this.request('/api/tags');
    } catch (error) {
      throw describeNetworkError(error, this.baseUrl, 'Ollama');
    }
    if (!response.ok) {
      throw errorFromResponse(response.status, await response.text(), 'Ollama');
    }
    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? [])
      .map((entry) => entry.name ?? entry.model ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async test(): Promise<AIConnectionResult> {
    try {
      const models = await this.listModels();
      if (models.length === 0) {
        return {
          ok: false,
          models,
          message: `Ollama is running at ${this.baseUrl}, but no models are installed. Run \`ollama pull ${this.model}\` and try again.`,
        };
      }
      const hasModel = models.some((name) => name === this.model || name.startsWith(`${this.model}:`));
      return {
        ok: true,
        models,
        message: hasModel
          ? `Connected to Ollama at ${this.baseUrl} — ${models.length} model${models.length === 1 ? '' : 's'} available.`
          : `Ollama is reachable but "${this.model}" is not installed. Run \`ollama pull ${this.model}\`.`,
      };
    } catch (error) {
      return { ok: false, models: [], message: (error as Error).message };
    }
  }

  async *stream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string, void, void> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((message) => ({ role: message.role, content: message.content })),
          stream: true,
          options: { temperature: this.temperature, num_predict: this.maxTokens },
        }),
        signal,
      });
    } catch (error) {
      throw describeNetworkError(error, this.baseUrl, 'Ollama');
    }
    if (!response.ok) {
      throw errorFromResponse(response.status, await response.text(), 'Ollama');
    }
    for await (const chunk of readNDJSON<OllamaChatChunk>(response.body)) {
      if (chunk.error) throw new AIProviderError('model', `Ollama: ${chunk.error}`);
      const delta = chunk.message?.content;
      if (delta) yield delta;
      if (chunk.done) return;
    }
  }
}

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}
