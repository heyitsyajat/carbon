/**
 * Shared domain types for Carbon. Imported by the Electron main process,
 * the preload bridge and the React renderer, so it must stay free of
 * Node.js and DOM specific APIs.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export type AIProviderId = 'ollama' | 'openai' | 'anthropic' | 'openai-compatible';

export type EditorMode = 'edit' | 'split' | 'preview';

export interface VaultRecord {
  path: string;
  name: string;
  lastOpenedAt: number;
}

export interface VaultInfo {
  path: string;
  name: string;
}

export interface NoteMeta {
  /** POSIX-style path relative to the vault root, e.g. `notes/Ideas.md`. */
  path: string;
  title: string;
  mtime: number;
  size: number;
  tags: string[];
}

export interface FileNode {
  name: string;
  /** Vault-relative POSIX path. Empty string for the vault root. */
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export interface NoteDoc {
  path: string;
  content: string;
  mtime: number;
}

export interface SearchHit {
  path: string;
  title: string;
  line: number;
  snippet: string;
  tags: string[];
}

export interface LinkRecord {
  source: string;
  target: string;
  resolved: string | null;
}

export interface LinkGraph {
  /** Resolved outgoing links per note path. */
  outgoing: Record<string, string[]>;
  /** Notes that link to the given note path. */
  backlinks: Record<string, string[]>;
  /** Notes that mention the title of a note without linking to it. */
  mentions: Record<string, string[]>;
  /** Wiki links that do not resolve to a note in the vault. */
  unresolved: string[];
}

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
}

export interface AISettings {
  /** AI is optional: when false, AI surfaces show a short setup prompt. */
  enabled: boolean;
  provider: AIProviderId;
  /** Model used whenever `provider` is the active backend. */
  model: string;
  temperature: number;
  maxTokens: number;
  /** Optional extra instructions prepended to every AI request. */
  systemPrompt: string;
  ollama: {
    baseUrl: string;
    model: string;
  };
  custom: {
    baseUrl: string;
    model: string;
  };
  openai: {
    model: string;
  };
  anthropic: {
    model: string;
  };
}

export interface EditorSettings {
  fontSize: number;
  lineWidth: 'narrow' | 'wide' | 'full';
  showLineNumbers: boolean;
  spellcheck: boolean;
  autoSaveMs: number;
  defaultMode: EditorMode;
}

export interface UISettings {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  confirmDelete: boolean;
}

export interface DailySettings {
  folder: string;
  /** Date pattern for the note name, e.g. `YYYY-MM-DD`. */
  format: string;
  template: string;
}

export interface WindowState {
  x: number | null;
  y: number | null;
  width: number;
  height: number;
  maximized: boolean;
}

export interface SearchOptions {
  query: string;
  tag?: string | null;
  folder?: string | null;
  limit?: number;
}

export interface Settings {
  version: number;
  theme: ThemeMode;
  onboardingComplete: boolean;
  tourCompleted: boolean;
  lastVaultPath: string | null;
  lastNotePath: string | null;
  vaults: VaultRecord[];
  ai: AISettings;
  editor: EditorSettings;
  ui: UISettings;
  daily: DailySettings;
  templatesFolder: string;
  keybindings: Record<string, string>;
  window: WindowState;
}

export type AIAction =
  | 'chat'
  | 'continue'
  | 'rewrite'
  | 'summarize'
  | 'bullets'
  | 'table'
  | 'action-items'
  | 'meeting'
  | 'custom';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AIErrorCode =
  | 'network'
  | 'auth'
  | 'rate-limit'
  | 'model'
  | 'bad-request'
  | 'aborted'
  | 'unknown';

export interface AIErrorPayload {
  code: AIErrorCode;
  message: string;
  detail?: string;
}

export interface AIChatRequest {
  streamId: string;
  action: AIAction;
  messages: ChatMessage[];
  /** Human readable description of what is being sent, for the UI. */
  label?: string;
}

export interface AIModelList {
  models: string[];
  error?: string;
}

export interface AIConnectionResult {
  ok: boolean;
  message: string;
  models: string[];
}

export type SecretKey = 'openai' | 'anthropic' | 'custom';

export interface SecretStatus {
  openai: boolean;
  anthropic: boolean;
  custom: boolean;
}

export type MenuCommand =
  | 'new-note'
  | 'new-meeting'
  | 'daily-note'
  | 'templates'
  | 'export-note'
  | 'import-vault'
  | 'graph-view'
  | 'focus-mode'
  | 'search-vault'
  | 'play-tour'
  | 'new-folder'
  | 'save-note'
  | 'close-tab'
  | 'open-vault'
  | 'close-vault'
  | 'quick-open'
  | 'search-vault'
  | 'command-palette'
  | 'toggle-left'
  | 'toggle-right'
  | 'cycle-mode'
  | 'open-settings'
  | 'open-help'
  | 'ai-panel'
  | 'ai-continue'
  | 'ai-rewrite'
  | 'ai-summarize'
  | 'ai-bullets'
  | 'ai-table'
  | 'ai-actions'
  | 'focus-editor'
  | 'delete-note'
  | 'reload-vault'
  | 'devtools';

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  settingsPath: string;
  isPackaged: boolean;
}
