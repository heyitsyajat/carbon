import { describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from '../../shared/ai/anthropic';
import { OllamaProvider } from '../../shared/ai/ollama';
import { OpenAICompatibleProvider, OpenAIProvider } from '../../shared/ai/openai';
import { createProvider, secretKeyForProvider, validateProviderSettings } from '../../shared/ai';
import { buildMessages, describeRequest } from '../../shared/ai/actions';
import { AIProviderError } from '../../shared/ai/errors';
import { extractAnthropicDelta, extractOpenAIDelta, readSSEPayloads } from '../../shared/ai/stream';
import { defaultAISettings } from '../settings';
import type { AISettings, ChatMessage } from '../../shared/types';

function settingsWith(patch: Partial<AISettings> = {}): AISettings {
  return { ...defaultAISettings(), ...patch };
}

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function sse(lines: string[]): Response {
  const payload = lines.map((line) => `data: ${line}\n\n`).join('');
  return new Response(streamOf([payload]), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const PROMPT: ChatMessage[] = [{ role: 'user', content: 'Continue this note' }];

describe('OllamaProvider', () => {
  it('streams NDJSON chunks into text deltas', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        streamOf([
          `${JSON.stringify({ message: { content: 'Hello' }, done: false })}\n`,
          `${JSON.stringify({ message: { content: ' world' }, done: false })}\n`,
          `${JSON.stringify({ message: { content: '' }, done: true })}\n`,
        ]),
        { status: 200 },
      ),
    );
    const provider = new OllamaProvider({ settings: settingsWith(), fetchImpl });

    let text = '';
    for await (const delta of provider.stream(PROMPT, new AbortController().signal)) {
      text += delta;
    }
    expect(text).toBe('Hello world');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(JSON.parse(String(init.body)).stream).toBe(true);
  });

  it('lists models and passes a connection test when the model exists', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ models: [{ name: 'llama3.2:latest' }, { name: 'qwen2.5:7b' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const provider = new OllamaProvider({ settings: settingsWith(), fetchImpl });
    expect(await provider.listModels()).toEqual(['llama3.2:latest', 'qwen2.5:7b']);
    const result = await provider.test();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Connected to Ollama/);
  });

  it('explains a refused connection in plain language', async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new TypeError('fetch failed');
      (error as { cause?: unknown }).cause = { code: 'ECONNREFUSED' };
      throw error;
    });
    const provider = new OllamaProvider({ settings: settingsWith(), fetchImpl });
    const result = await provider.test();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not accepting connections/);
    expect(result.message).toMatch(/Settings/);
  });

  it('warns when no models are installed', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ models: [] }), { status: 200 }));
    const provider = new OllamaProvider({ settings: settingsWith(), fetchImpl });
    const result = await provider.test();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/llama pull/);
  });

  it('raises a structured error on HTTP failure', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 }));
    const provider = new OllamaProvider({ settings: settingsWith(), fetchImpl });
    const run = async () => {
      for await (const _chunk of provider.stream(PROMPT, new AbortController().signal)) {
        // consume
      }
    };
    await expect(run()).rejects.toMatchObject({ code: 'model' });
  });
});

describe('OpenAICompatibleProvider', () => {
  const stub = () =>
    vi.fn(async (url: string) => {
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), { status: 200 });
      }
      return sse([
        JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
        JSON.stringify({ choices: [{ delta: { content: ', writer' } }] }),
        '[DONE]',
      ]);
    });

  it('streams deltas and sends the bearer token', async () => {
    const fetchImpl = stub();
    const provider = new OpenAICompatibleProvider(
      { settings: settingsWith({ custom: { baseUrl: 'http://127.0.0.1:1234/v1/', model: 'local-7b' } }), fetchImpl, apiKey: 'sk-test' },
      'openai-compatible',
    );

    let text = '';
    for await (const delta of provider.stream(PROMPT, new AbortController().signal)) text += delta;
    expect(text).toBe('Hello, writer');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:1234/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(String(init.body)).model).toBe('local-7b');
  });

  it('uses the official OpenAI base URL for the OpenAI variant', async () => {
    const fetchImpl = stub();
    const provider = new OpenAIProvider({
      settings: settingsWith({ openai: { model: 'gpt-4o' } }),
      fetchImpl,
      apiKey: 'sk-test',
    });
    for await (const _delta of provider.stream(PROMPT, new AbortController().signal)) {
      // consume
    }
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('maps 401 responses to an auth error that points at settings', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"message":"Invalid API key"}}', { status: 401 }));
    const provider = new OpenAICompatibleProvider({ settings: settingsWith(), fetchImpl }, 'openai-compatible');
    const run = async () => {
      for await (const _chunk of provider.stream(PROMPT, new AbortController().signal)) {
        // consume
      }
    };
    await expect(run()).rejects.toMatchObject({ code: 'auth' });
    await expect(run()).rejects.toThrow(/Settings → AI/);
  });

  it('reports reachability through the models endpoint', async () => {
    const provider = new OpenAICompatibleProvider({ settings: settingsWith(), fetchImpl: stub() }, 'openai-compatible');
    const result = await provider.test();
    expect(result.ok).toBe(true);
    expect(result.models).toEqual(['gpt-4o-mini']);
  });
});

describe('AnthropicProvider', () => {
  it('streams text deltas and hoists the system prompt', async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        JSON.stringify({ type: 'message_start' }),
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } }),
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: ' there' } }),
        '[DONE]',
      ]),
    );
    const provider = new AnthropicProvider({ settings: settingsWith(), apiKey: 'sk-ant', fetchImpl });

    let text = '';
    for await (const delta of provider.stream(
      [{ role: 'system', content: 'Be terse.' }, { role: 'user', content: 'Hello' }],
      new AbortController().signal,
    )) {
      text += delta;
    }
    expect(text).toBe('Hi there');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(String(init.body)) as { system: string; messages: ChatMessage[] };
    expect(body.system).toBe('Be terse.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant');
  });

  it('requires an API key before making a request', async () => {
    const provider = new AnthropicProvider({ settings: settingsWith(), fetchImpl: vi.fn() });
    const run = async () => {
      for await (const _chunk of provider.stream(PROMPT, new AbortController().signal)) {
        // consume
      }
    };
    await expect(run()).rejects.toBeInstanceOf(AIProviderError);
    await expect(run()).rejects.toMatchObject({ code: 'auth' });
  });

  it('lists models for the connection test', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'claude-3-5-sonnet-latest' }] }), { status: 200 }),
    );
    const provider = new AnthropicProvider({ settings: settingsWith(), apiKey: 'k', fetchImpl });
    const result = await provider.test();
    expect(result.ok).toBe(true);
    expect(result.models).toContain('claude-3-5-sonnet-latest');
  });
});

describe('provider factory', () => {
  it('creates the provider matching the settings', () => {
    const settings = settingsWith();
    expect(createProvider('ollama', { settings })).toBeInstanceOf(OllamaProvider);
    expect(createProvider('openai', { settings })).toBeInstanceOf(OpenAIProvider);
    expect(createProvider('anthropic', { settings })).toBeInstanceOf(AnthropicProvider);
    expect(createProvider('openai-compatible', { settings })).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it('maps providers to their secret slots', () => {
    expect(secretKeyForProvider('openai')).toBe('openai');
    expect(secretKeyForProvider('anthropic')).toBe('anthropic');
    expect(secretKeyForProvider('openai-compatible')).toBe('custom');
    expect(secretKeyForProvider('ollama')).toBeNull();
  });

  it('validates settings before a request', () => {
    expect(validateProviderSettings(settingsWith(), false)).toBeNull();
    expect(validateProviderSettings(settingsWith({ provider: 'openai' }), false)).toMatch(/API key/);
    expect(validateProviderSettings(settingsWith({ provider: 'openai' }), true)).toBeNull();
    expect(
      validateProviderSettings(settingsWith({ provider: 'ollama', ollama: { baseUrl: '', model: 'x' } }), false),
    ).toMatch(/address/);
    expect(
      validateProviderSettings(
        settingsWith({ provider: 'openai-compatible', custom: { baseUrl: '', model: '' } }),
        false,
      ),
    ).toMatch(/base URL/);
  });
});

describe('stream parsing', () => {
  it('extracts OpenAI deltas and ignores malformed payloads', () => {
    expect(extractOpenAIDelta('{"choices":[{"delta":{"content":"x"}}]}')).toBe('x');
    expect(extractOpenAIDelta('[DONE]')).toBe('');
    expect(extractOpenAIDelta('not json')).toBe('');
  });

  it('extracts Anthropic deltas only for text blocks', () => {
    expect(
      extractAnthropicDelta('{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}'),
    ).toBe('hi');
    expect(extractAnthropicDelta('{"type":"message_stop"}')).toBe('');
  });

  it('joins multi-line data events', async () => {
    const body = streamOf(['data: line one\n', 'data: line two\n\n', 'data: next\n\n']);
    const payloads: string[] = [];
    for await (const payload of readSSEPayloads(body)) payloads.push(payload);
    expect(payloads).toEqual(['line one\nline two', 'next']);
  });
});

describe('buildMessages', () => {
  it('sends the note with the continue instruction', () => {
    const messages = buildMessages({
      action: 'continue',
      noteTitle: 'Diary',
      noteContent: '# Monday\n\nToday I started',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toContain('Today I started');
    expect(messages[1]?.content).toMatch(/Continue this note:/);
  });

  it('prefers the selection for rewrite and includes extra notes', () => {
    const messages = buildMessages({
      action: 'rewrite',
      selection: 'this are bad',
      noteContent: 'full note',
      extraNotes: [{ title: 'Other', content: 'context' }],
    });
    const user = messages[1]?.content ?? '';
    expect(user).toContain('this are bad');
    expect(user).toContain('Related notes for context');
    expect(user).toContain('context');
  });

  it('adds the author standing instructions to the system prompt', () => {
    const messages = buildMessages({ action: 'summarize', noteContent: 'x' }, 'Use British English.');
    expect(messages[0]?.content).toContain('Use British English.');
    expect(messages[0]?.content).toContain('Never invent facts');
  });

  it('truncates very long notes', () => {
    const messages = buildMessages({ action: 'summarize', noteContent: 'a'.repeat(50_000), maxNoteChars: 100 });
    expect(messages[1]?.content).toContain('truncated');
    expect(messages[1]!.content.length).toBeLessThan(2000);
  });

  it('keeps chat questions verbatim and includes notes as context', () => {
    const messages = buildMessages({ action: 'chat', instruction: 'What did we decide?', noteContent: 'We decided X.' });
    expect(messages[1]?.content).toContain('What did we decide?');
    expect(messages[1]?.content).toContain('We decided X.');
  });

  it('uses the custom instruction as the task', () => {
    const messages = buildMessages({ action: 'custom', instruction: 'Tighten the intro', selection: 'Intro text' });
    expect(messages[1]?.content).toContain('Task: Tighten the intro');
    expect(messages[1]?.content).toContain('Intro text');
  });

  it('describes the request for the UI', () => {
    expect(describeRequest({ action: 'summarize', noteContent: 'x' })).toMatch(/Summarize.*current note/);
    expect(describeRequest({ action: 'rewrite', selection: 'x', extraNotes: [{ title: 'a', content: 'b' }] })).toMatch(
      /selection/,
    );
  });
});
