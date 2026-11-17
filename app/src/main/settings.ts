import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  AIProviderId,
  AISettings,
  DailySettings,
  EditorMode,
  EditorSettings,
  Settings,
  ThemeMode,
  UISettings,
  VaultRecord,
  WindowState,
} from '../shared/types';
import { DEFAULT_BASE_URLS, DEFAULT_MODELS } from '../shared/ai/provider';
import { DEFAULT_DAILY_TEMPLATE } from '../shared/templates';
import { DEFAULT_KEYBINDINGS, sanitizeKeybindings } from '../shared/keybindings';
import type { DeepPartial } from '../shared/ipc';

export const SETTINGS_VERSION = 2;
export const SETTINGS_FILE_NAME = 'settings.json';

const THEMES: ThemeMode[] = ['system', 'light', 'dark'];
const PROVIDERS: AIProviderId[] = ['ollama', 'openai', 'anthropic', 'openai-compatible'];
const MODES: EditorMode[] = ['edit', 'split', 'preview'];
const LINE_WIDTHS: EditorSettings['lineWidth'][] = ['narrow', 'wide', 'full'];

export function defaultAISettings(): AISettings {
  return {
    // AI is opt-in. The setup wizard can leave this false and the app is fully
    // usable without a provider.
    enabled: false,
    provider: 'ollama',
    model: DEFAULT_MODELS.ollama,
    temperature: 0.6,
    maxTokens: 1024,
    systemPrompt: '',
    ollama: {
      baseUrl: DEFAULT_BASE_URLS.ollama,
      model: DEFAULT_MODELS.ollama,
    },
    custom: {
      baseUrl: DEFAULT_BASE_URLS['openai-compatible'],
      model: DEFAULT_MODELS['openai-compatible'],
    },
    openai: {
      model: DEFAULT_MODELS.openai,
    },
    anthropic: {
      model: DEFAULT_MODELS.anthropic,
    },
  };
}

export function defaultEditorSettings(): EditorSettings {
  return {
    fontSize: 17,
    lineWidth: 'wide',
    showLineNumbers: false,
    spellcheck: true,
    autoSaveMs: 900,
    defaultMode: 'split',
  };
}

export function defaultUISettings(): UISettings {
  return {
    leftSidebarOpen: true,
    rightSidebarOpen: true,
    leftSidebarWidth: 248,
    rightSidebarWidth: 296,
    confirmDelete: true,
  };
}

export function defaultDailySettings(): DailySettings {
  return {
    folder: 'Daily',
    format: 'YYYY-MM-DD',
    template: DEFAULT_DAILY_TEMPLATE,
  };
}

export function defaultWindowState(): WindowState {
  return { x: null, y: null, width: 1360, height: 860, maximized: false };
}

export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    theme: 'system',
    onboardingComplete: false,
    tourCompleted: false,
    lastVaultPath: null,
    lastNotePath: null,
    vaults: [],
    ai: defaultAISettings(),
    editor: defaultEditorSettings(),
    ui: defaultUISettings(),
    daily: defaultDailySettings(),
    templatesFolder: 'Templates',
    keybindings: { ...DEFAULT_KEYBINDINGS },
    window: defaultWindowState(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function pickNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickString(value: unknown, fallback: string, maxLength = 500): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function sanitizeVaultRecords(value: unknown): VaultRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const records: VaultRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const vaultPath = typeof entry.path === 'string' ? entry.path.trim() : '';
    if (!vaultPath || seen.has(vaultPath.toLowerCase())) continue;
    seen.add(vaultPath.toLowerCase());
    records.push({
      path: vaultPath,
      name: pickString(entry.name, path.basename(vaultPath), 120) || path.basename(vaultPath),
      lastOpenedAt: pickNumber(entry.lastOpenedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    });
  }
  return records.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 30);
}

/**
 * Coerces any on-disk payload into a valid Settings object. Unknown keys are
 * dropped, numbers are clamped and enums fall back to their defaults, so a
 * hand-edited or downgraded settings file can never break startup.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!isRecord(raw)) return defaults;

  const rawAI = isRecord(raw.ai) ? raw.ai : {};
  const rawOllama = isRecord(rawAI.ollama) ? rawAI.ollama : {};
  const rawCustom = isRecord(rawAI.custom) ? rawAI.custom : {};
  const rawOpenAI = isRecord(rawAI.openai) ? rawAI.openai : {};
  const rawAnthropic = isRecord(rawAI.anthropic) ? rawAI.anthropic : {};

  const ai: AISettings = {
    enabled: pickBoolean(rawAI.enabled, defaults.ai.enabled),
    provider: pickEnum(rawAI.provider, PROVIDERS, defaults.ai.provider),
    model: pickString(rawAI.model, defaults.ai.model, 120),
    temperature: pickNumber(rawAI.temperature, 0, 2, defaults.ai.temperature),
    maxTokens: Math.round(pickNumber(rawAI.maxTokens, 64, 32_000, defaults.ai.maxTokens)),
    systemPrompt: pickString(rawAI.systemPrompt, '', 4000),
    ollama: {
      baseUrl: pickString(rawOllama.baseUrl, defaults.ai.ollama.baseUrl, 300).trim(),
      model: pickString(rawOllama.model, defaults.ai.ollama.model, 120).trim(),
    },
    custom: {
      baseUrl: pickString(rawCustom.baseUrl, defaults.ai.custom.baseUrl, 300).trim(),
      model: pickString(rawCustom.model, defaults.ai.custom.model, 120).trim(),
    },
    openai: {
      model: pickString(rawOpenAI.model, defaults.ai.openai.model, 120).trim(),
    },
    anthropic: {
      model: pickString(rawAnthropic.model, defaults.ai.anthropic.model, 120).trim(),
    },
  };

  const rawEditor = isRecord(raw.editor) ? raw.editor : {};
  const editor: EditorSettings = {
    fontSize: Math.round(pickNumber(rawEditor.fontSize, 12, 28, defaults.editor.fontSize)),
    lineWidth: pickEnum(rawEditor.lineWidth, LINE_WIDTHS, defaults.editor.lineWidth),
    showLineNumbers: pickBoolean(rawEditor.showLineNumbers, defaults.editor.showLineNumbers),
    spellcheck: pickBoolean(rawEditor.spellcheck, defaults.editor.spellcheck),
    autoSaveMs: Math.round(pickNumber(rawEditor.autoSaveMs, 0, 10_000, defaults.editor.autoSaveMs)),
    defaultMode: pickEnum(rawEditor.defaultMode, MODES, defaults.editor.defaultMode),
  };

  const rawUI = isRecord(raw.ui) ? raw.ui : {};
  const ui: UISettings = {
    leftSidebarOpen: pickBoolean(rawUI.leftSidebarOpen, defaults.ui.leftSidebarOpen),
    rightSidebarOpen: pickBoolean(rawUI.rightSidebarOpen, defaults.ui.rightSidebarOpen),
    leftSidebarWidth: Math.round(pickNumber(rawUI.leftSidebarWidth, 180, 520, defaults.ui.leftSidebarWidth)),
    rightSidebarWidth: Math.round(pickNumber(rawUI.rightSidebarWidth, 220, 620, defaults.ui.rightSidebarWidth)),
    confirmDelete: pickBoolean(rawUI.confirmDelete, defaults.ui.confirmDelete),
  };

  const rawDaily = isRecord(raw.daily) ? raw.daily : {};
  const daily: DailySettings = {
    folder: pickString(rawDaily.folder, defaults.daily.folder, 120).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''),
    format: pickString(rawDaily.format, defaults.daily.format, 60) || defaults.daily.format,
    template: pickString(rawDaily.template, defaults.daily.template, 8000),
  };

  const rawWindow = isRecord(raw.window) ? raw.window : {};
  const windowState: WindowState = {
    x: typeof rawWindow.x === 'number' && Number.isFinite(rawWindow.x) ? Math.round(rawWindow.x) : null,
    y: typeof rawWindow.y === 'number' && Number.isFinite(rawWindow.y) ? Math.round(rawWindow.y) : null,
    width: Math.round(pickNumber(rawWindow.width, 940, 6000, defaults.window.width)),
    height: Math.round(pickNumber(rawWindow.height, 600, 4000, defaults.window.height)),
    maximized: pickBoolean(rawWindow.maximized, defaults.window.maximized),
  };

  const vaults = sanitizeVaultRecords(raw.vaults);
  const lastVaultPath =
    typeof raw.lastVaultPath === 'string' && raw.lastVaultPath.trim()
      ? raw.lastVaultPath.trim()
      : (vaults[0]?.path ?? null);

  return {
    version: SETTINGS_VERSION,
    theme: pickEnum(raw.theme, THEMES, defaults.theme),
    onboardingComplete: pickBoolean(raw.onboardingComplete, defaults.onboardingComplete),
    tourCompleted: pickBoolean(raw.tourCompleted, defaults.tourCompleted),
    lastVaultPath,
    lastNotePath:
      typeof raw.lastNotePath === 'string' && raw.lastNotePath.trim() ? raw.lastNotePath.trim() : null,
    vaults,
    ai,
    editor,
    ui,
    daily,
    templatesFolder:
      pickString(raw.templatesFolder, defaults.templatesFolder, 120).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') ||
      defaults.templatesFolder,
    keybindings: sanitizeKeybindings(raw.keybindings),
    window: windowState,
  };
}

/** Deep-merges a patch into settings and re-validates the result. */
export function mergeSettings(current: Settings, patch: DeepPartial<Settings> | unknown): Settings {
  if (!isRecord(patch)) return current;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isRecord(value) && isRecord((current as unknown as Record<string, unknown>)[key])) {
      merged[key] = deepMerge(
        (current as unknown as Record<string, unknown>)[key] as Record<string, unknown>,
        value,
      );
    } else {
      merged[key] = value;
    }
  }
  return sanitizeSettings(merged);
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isRecord(value) && isRecord(base[key])) {
      out[key] = deepMerge(base[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Adds or refreshes a vault in the recent list, most recent first. */
export function rememberVault(
  settings: Settings,
  vault: { path: string; name: string },
  now = Date.now(),
): Settings {
  const others = settings.vaults.filter((entry) => entry.path.toLowerCase() !== vault.path.toLowerCase());
  const vaults: VaultRecord[] = [{ path: vault.path, name: vault.name, lastOpenedAt: now }, ...others].slice(0, 30);
  return { ...settings, vaults, lastVaultPath: vault.path };
}

export function forgetVault(settings: Settings, vaultPath: string): Settings {
  const vaults = settings.vaults.filter((entry) => entry.path.toLowerCase() !== vaultPath.toLowerCase());
  return {
    ...settings,
    vaults,
    lastVaultPath: settings.lastVaultPath === vaultPath ? (vaults[0]?.path ?? null) : settings.lastVaultPath,
  };
}

/** Keeps saved window bounds on an attached display. */
export function clampWindowState(
  state: WindowState,
  displays: Array<{ x: number; y: number; width: number; height: number }>,
): WindowState {
  const visible = displays.some(
    (display) =>
      state.x !== null &&
      state.y !== null &&
      state.x + 80 < display.x + display.width &&
      state.x + state.width - 80 > display.x &&
      state.y >= display.y - 10 &&
      state.y + 60 < display.y + display.height,
  );
  return visible ? state : { ...state, x: null, y: null };
}

/** Small JSON settings store with atomic writes. No Electron dependency. */
export class SettingsStore {
  private settings: Settings = defaultSettings();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  get current(): Settings {
    return this.settings;
  }

  async load(): Promise<Settings> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.settings = sanitizeSettings(safeParse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[settings] could not read settings, using defaults:', (error as Error).message);
      }
      this.settings = defaultSettings();
    }
    this.loaded = true;
    return this.settings;
  }

  async save(next: Settings): Promise<Settings> {
    this.settings = sanitizeSettings(next);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(this.settings, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, this.filePath);
    return this.settings;
  }

  async update(patch: DeepPartial<Settings>): Promise<Settings> {
    if (!this.loaded) await this.load();
    return this.save(mergeSettings(this.settings, patch));
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
