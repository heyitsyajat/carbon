/** Streaming parsers for server-sent events and newline-delimited JSON. */

export async function* iterateLines(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string, void, void> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        yield line;
        index = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield buffer.replace(/\r$/, '');
  } finally {
    reader.releaseLock();
  }
}

/** Yields the `data:` payload of each server-sent event, skipping comments. */
export async function* readSSEPayloads(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string, void, void> {
  let dataLines: string[] = [];
  for await (const line of iterateLines(body)) {
    if (line === '') {
      if (dataLines.length > 0) {
        yield dataLines.join('\n');
        dataLines = [];
      }
      continue;
    }
    if (line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }
  if (dataLines.length > 0) yield dataLines.join('\n');
}

/** Yields parsed objects from a newline-delimited JSON stream (Ollama). */
export async function* readNDJSON<T>(body: ReadableStream<Uint8Array> | null): AsyncGenerator<T, void, void> {
  for await (const line of iterateLines(body)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      yield JSON.parse(trimmed) as T;
    } catch {
      throw new Error(`Malformed streaming response: ${trimmed.slice(0, 120)}`);
    }
  }
}

export function extractOpenAIDelta(raw: string): string {
  if (!raw || raw === '[DONE]') return '';
  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{ delta?: { content?: string | null }; text?: string | null }>;
    };
    const choice = parsed.choices?.[0];
    return choice?.delta?.content ?? choice?.text ?? '';
  } catch {
    return '';
  }
}

export function extractAnthropicDelta(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      delta?: { type?: string; text?: string };
      error?: { message?: string };
    };
    if (parsed.type === 'error' && parsed.error?.message) throw new Error(parsed.error.message);
    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
      return parsed.delta.text ?? '';
    }
    return '';
  } catch (error) {
    if (error instanceof SyntaxError) return '';
    throw error;
  }
}
