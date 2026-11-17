import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SettingsStore,
  defaultSettings,
  forgetVault,
  mergeSettings,
  rememberVault,
  sanitizeSettings,
} from '../settings';
import type { Settings } from '../../shared/types';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'carbon-settings-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('defaultSettings', () => {
  it('uses a local Ollama backend and system theme by default', () => {
    const settings = defaultSettings();
    expect(settings.theme).toBe('system');
    expect(settings.ai.provider).toBe('ollama');
    expect(settings.ai.ollama.baseUrl).toBe('http://127.0.0.1:11434');
    expect(settings.onboardingComplete).toBe(false);
    expect(settings.vaults).toEqual([]);
  });
});

describe('sanitizeSettings', () => {
  it('falls back to defaults for non-object input', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings('nope')).toEqual(defaultSettings());
    expect(sanitizeSettings([])).toEqual(defaultSettings());
  });

  it('drops unknown keys and keeps valid ones', () => {
    const result = sanitizeSettings({
      theme: 'dark',
      onboardingComplete: true,
      somethingElse: 'x',
      editor: { fontSize: 18, bogus: true },
    });
    expect(result.theme).toBe('dark');
    expect(result.onboardingComplete).toBe(true);
    expect(result.editor.fontSize).toBe(18);
    expect('somethingElse' in result).toBe(false);
    expect('bogus' in result.editor).toBe(false);
  });

  it('clamps numbers into a safe range', () => {
    const result = sanitizeSettings({
      editor: { fontSize: 400, autoSaveMs: -50 },
      ai: { temperature: 99, maxTokens: 5 },
      ui: { leftSidebarWidth: 5, rightSidebarWidth: 9999 },
    });
    expect(result.editor.fontSize).toBe(28);
    expect(result.editor.autoSaveMs).toBe(0);
    expect(result.ai.temperature).toBe(2);
    expect(result.ai.maxTokens).toBe(64);
    expect(result.ui.leftSidebarWidth).toBe(180);
    expect(result.ui.rightSidebarWidth).toBe(620);
  });

  it('rejects invalid enum values and keeps the fallback', () => {
    const result = sanitizeSettings({ theme: 'neon', ai: { provider: 'magic' }, editor: { defaultMode: 'both' } });
    expect(result.theme).toBe('system');
    expect(result.ai.provider).toBe('ollama');
    expect(result.editor.defaultMode).toBe('split');
  });

  it('normalises recent vaults, removing duplicates and bad rows', () => {
    const result = sanitizeSettings({
      vaults: [
        { path: 'C:/One', name: 'One', lastOpenedAt: 10 },
        { path: 'c:/one', name: 'Duplicate', lastOpenedAt: 20 },
        { path: '', name: 'Empty' },
        { name: 'No path' },
        { path: 'C:/Two', lastOpenedAt: 'nope' },
      ],
    });
    expect(result.vaults.map((vault) => vault.path)).toEqual(['C:/One', 'C:/Two']);
    expect(result.vaults[1]?.lastOpenedAt).toBe(0);
    expect(result.lastVaultPath).toBe('C:/One');
  });
});

describe('mergeSettings', () => {
  it('deep merges nested patches without losing siblings', () => {
    const base = defaultSettings();
    const merged = mergeSettings(base, { ai: { provider: 'openai' } });
    expect(merged.ai.provider).toBe('openai');
    expect(merged.ai.ollama.baseUrl).toBe(base.ai.ollama.baseUrl);
    expect(merged.ai.maxTokens).toBe(base.ai.maxTokens);
  });

  it('replaces arrays instead of merging them', () => {
    const base = rememberVault(defaultSettings(), { path: 'C:/A', name: 'A' }, 1);
    const merged = mergeSettings(base, { vaults: [{ path: 'C:/B', name: 'B', lastOpenedAt: 5 }] });
    expect(merged.vaults.map((vault) => vault.path)).toEqual(['C:/B']);
  });

  it('ignores undefined values and invalid patches', () => {
    const base = defaultSettings();
    expect(mergeSettings(base, { theme: undefined })).toEqual(base);
    expect(mergeSettings(base, null)).toBe(base);
  });
});

describe('rememberVault / forgetVault', () => {
  it('moves the most recent vault to the front', () => {
    let settings: Settings = defaultSettings();
    settings = rememberVault(settings, { path: 'C:/A', name: 'A' }, 1);
    settings = rememberVault(settings, { path: 'C:/B', name: 'B' }, 2);
    settings = rememberVault(settings, { path: 'C:/A', name: 'A' }, 3);
    expect(settings.vaults.map((vault) => vault.path)).toEqual(['C:/A', 'C:/B']);
    expect(settings.lastVaultPath).toBe('C:/A');
  });

  it('caps the recents list at 30 entries', () => {
    let settings: Settings = defaultSettings();
    for (let index = 0; index < 40; index += 1) {
      settings = rememberVault(settings, { path: `C:/V${index}`, name: `V${index}` }, index);
    }
    expect(settings.vaults).toHaveLength(30);
    expect(settings.vaults[0]?.path).toBe('C:/V39');
  });

  it('forgets a vault and falls back to the next most recent', () => {
    let settings: Settings = defaultSettings();
    settings = rememberVault(settings, { path: 'C:/A', name: 'A' }, 1);
    settings = rememberVault(settings, { path: 'C:/B', name: 'B' }, 2);
    const next = forgetVault(settings, 'C:/B');
    expect(next.vaults.map((vault) => vault.path)).toEqual(['C:/A']);
    expect(next.lastVaultPath).toBe('C:/A');
  });
});

describe('SettingsStore', () => {
  it('returns defaults when the file is missing', async () => {
    const store = new SettingsStore(path.join(dir, 'settings.json'));
    const settings = await store.load();
    expect(settings).toEqual(defaultSettings());
  });

  it('persists updates atomically and reloads them', async () => {
    const file = path.join(dir, 'settings.json');
    const store = new SettingsStore(file);
    await store.load();
    await store.update({ theme: 'dark', editor: { fontSize: 20 } });

    const onDisk = JSON.parse(await fs.readFile(file, 'utf8')) as Settings;
    expect(onDisk.theme).toBe('dark');
    expect(onDisk.editor.fontSize).toBe(20);

    const reloaded = new SettingsStore(file);
    expect((await reloaded.load()).editor.fontSize).toBe(20);
  });

  it('recovers from corrupt JSON without throwing', async () => {
    const file = path.join(dir, 'settings.json');
    await fs.writeFile(file, '{ "theme": "dar', 'utf8');
    const store = new SettingsStore(file);
    const settings = await store.load();
    expect(settings.theme).toBe('system');
  });

  it('sanitises values written through update', async () => {
    const store = new SettingsStore(path.join(dir, 'settings.json'));
    await store.load();
    const result = await store.update({ editor: { fontSize: 999 } });
    expect(result.editor.fontSize).toBe(28);
  });
});
