import type { AIErrorCode, AIErrorPayload } from '../types';

export class AIProviderError extends Error {
  readonly code: AIErrorCode;
  readonly detail?: string;

  constructor(code: AIErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.detail = detail;
  }

  toPayload(): AIErrorPayload {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError')
  );
}

/** Turns a fetch/network failure into a message that names the likely cause. */
export function describeNetworkError(error: unknown, baseUrl: string, providerLabel: string): AIProviderError {
  if (isAbortError(error)) {
    return new AIProviderError('aborted', 'Generation stopped.');
  }
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const code = (error as { cause?: { code?: string } } | undefined)?.cause?.code ?? '';
  const hint =
    /ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(`${detail} ${code}`)
      ? `${providerLabel} is not accepting connections at ${baseUrl}. Start it, or update the base URL in Settings → AI.`
      : /ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED/i.test(`${detail} ${code}`)
        ? `Could not resolve the host for ${baseUrl}. Check the URL and your network connection.`
        : /CERT|SSL|TLS|self.signed/i.test(detail)
          ? `The TLS certificate for ${baseUrl} could not be verified.`
          : /ETIMEDOUT|timeout|timed out/i.test(`${detail} ${code}`)
            ? `${providerLabel} did not respond in time (${baseUrl}).`
            : `Could not reach ${providerLabel} at ${baseUrl}.`;
  return new AIProviderError('network', hint, detail);
}

export function errorFromResponse(status: number, body: string, providerLabel: string): AIProviderError {
  let message = body.trim();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') message = parsed.error;
    else if (parsed.error && typeof parsed.error.message === 'string') message = parsed.error.message;
    else if (typeof parsed.message === 'string') message = parsed.message;
  } catch {
    // Body was not JSON; keep the raw text.
  }
  const trimmed = message.replace(/\s+/g, ' ').slice(0, 400);
  if (status === 401 || status === 403) {
    return new AIProviderError(
      'auth',
      `${providerLabel} rejected the API key. Check it in Settings → AI.`,
      trimmed,
    );
  }
  if (status === 404) {
    return new AIProviderError(
      'model',
      `${providerLabel} could not find that model or endpoint. Verify the model name and base URL.`,
      trimmed,
    );
  }
  if (status === 429) {
    return new AIProviderError('rate-limit', `${providerLabel} is rate limiting requests. Try again shortly.`, trimmed);
  }
  if (status >= 500) {
    return new AIProviderError(
      'network',
      `${providerLabel} returned a server error (${status}). It may be starting up or overloaded.`,
      trimmed,
    );
  }
  return new AIProviderError('bad-request', `${providerLabel} rejected the request (${status}).`, trimmed);
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[…truncated ${text.length - maxChars} characters…]`;
}
