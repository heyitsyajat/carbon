import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc';
import { createProvider, secretKeyForProvider, validateProviderSettings } from '../shared/ai';
import { isAbortError } from '../shared/ai/errors';
import type { AIProvider } from '../shared/ai/provider';
import type {
  AIChatRequest,
  AIConnectionResult,
  AIErrorPayload,
  AIModelList,
  AISettings,
  Settings,
} from '../shared/types';
import type { SecretStore } from './secrets';

/**
 * Runs AI requests in the main process so provider keys never reach the
 * renderer. Responses stream back over IPC as text deltas.
 */
export class AIService {
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly getSettings: () => Settings,
    private readonly secrets: SecretStore,
    private readonly getWindow: () => BrowserWindow | null,
  ) {}

  private async resolve(): Promise<{ settings: AISettings; apiKey?: string }> {
    const settings = this.getSettings().ai;
    const slot = secretKeyForProvider(settings.provider);
    const apiKey = slot ? await this.secrets.get(slot) : undefined;
    return { settings, apiKey };
  }

  private async provider(): Promise<AIProvider> {
    const { settings, apiKey } = await this.resolve();
    if (!settings.enabled) {
      throw new Error('AI is turned off. Add a provider in Settings → AI to use writing assistance.');
    }
    const problem = validateProviderSettings(settings, Boolean(apiKey));
    if (problem) throw new Error(problem);
    return createProvider(settings.provider, { settings, apiKey });
  }

  async listModels(): Promise<AIModelList> {
    try {
      const provider = await this.provider();
      return { models: await provider.listModels() };
    } catch (error) {
      return { models: [], error: (error as Error).message };
    }
  }

  async test(): Promise<AIConnectionResult> {
    try {
      const provider = await this.provider();
      return await provider.test();
    } catch (error) {
      return { ok: false, models: [], message: (error as Error).message };
    }
  }

  async chat(request: AIChatRequest): Promise<void> {
    if (this.controllers.has(request.streamId)) {
      throw new Error('That request is already running.');
    }
    const provider = await this.provider();
    const controller = new AbortController();
    this.controllers.set(request.streamId, controller);
    void this.run(provider, request, controller);
  }

  private async run(provider: AIProvider, request: AIChatRequest, controller: AbortController): Promise<void> {
    const window = this.getWindow();
    let text = '';
    try {
      for await (const delta of provider.stream(request.messages, controller.signal)) {
        if (controller.signal.aborted) break;
        text += delta;
        if (window && !window.isDestroyed()) {
          window.webContents.send(IPC.aiChunk, { streamId: request.streamId, delta });
        }
      }
      if (window && !window.isDestroyed()) {
        window.webContents.send(IPC.aiDone, { streamId: request.streamId, text });
      }
    } catch (error) {
      if (isAbortError(error)) {
        if (window && !window.isDestroyed()) {
          window.webContents.send(IPC.aiDone, { streamId: request.streamId, text });
        }
        return;
      }
      const payload: AIErrorPayload =
        error instanceof Error && 'code' in error && 'toPayload' in error
          ? (error as { toPayload: () => AIErrorPayload }).toPayload()
          : { code: 'unknown', message: (error as Error).message || 'The AI request failed.' };
      if (window && !window.isDestroyed()) {
        window.webContents.send(IPC.aiError, { streamId: request.streamId, error: payload });
      }
    } finally {
      this.controllers.delete(request.streamId);
    }
  }

  async cancel(streamId: string): Promise<void> {
    const controller = this.controllers.get(streamId);
    if (controller) {
      controller.abort();
      this.controllers.delete(streamId);
    }
  }

  cancelAll(): void {
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
  }
}
