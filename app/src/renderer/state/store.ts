import { useSyncExternalStore } from 'react';
import type {
  AIAction,
  AIErrorPayload,
  EditorMode,
  FileNode,
  LinkGraph,
  NoteMeta,
  ResolvedTheme,
  SearchHit,
  Settings,
  VaultInfo,
} from '@shared/types';

export type Screen = 'startup' | 'wizard' | 'workspace';
export type PaletteMode = 'commands' | 'notes' | 'templates';
export type SettingsSection = 'general' | 'editor' | 'ai' | 'shortcuts' | 'about';
export type ToastTone = 'info' | 'success' | 'error';

export interface Tab {
  path: string;
  title: string;
  content: string;
  savedContent: string;
  mode: EditorMode;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface WizardState {
  step: number;
  vaultPath: string | null;
  vaultName: string;
  /** `null` until the user picks how to handle AI. */
  aiChoice: 'configure' | 'skip' | null;
}

export interface AIState {
  open: boolean;
  streaming: boolean;
  streamId: string | null;
  action: AIAction;
  result: string;
  error: AIErrorPayload | null;
  label: string | null;
  targetNote: string | null;
  selection: string;
  hasSelection: boolean;
  transcript: string;
}

export interface SearchState {
  open: boolean;
  query: string;
  tag: string | null;
  folder: string | null;
  results: SearchHit[];
  loading: boolean;
  error: string | null;
}

export interface PromptState {
  kind: 'new-note' | 'new-folder' | 'rename' | 'meeting';
  title: string;
  value: string;
  target?: string;
  folder?: string;
}

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: 'danger' | 'default';
}

export interface State {
  ready: boolean;
  screen: Screen;
  wizard: WizardState;
  vault: VaultInfo | null;
  settings: Settings;
  theme: ResolvedTheme;
  notes: NoteMeta[];
  tree: FileNode | null;
  links: LinkGraph;
  tabs: Tab[];
  activePath: string | null;
  collapsed: Record<string, boolean>;
  explorerFilter: string;
  explorerOpen: boolean;
  focusMode: boolean;
  graphOpen: boolean;
  tourOpen: boolean;
  selected: string[];
  ai: AIState;
  search: SearchState;
  palette: { open: boolean; mode: PaletteMode; query: string };
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  helpOpen: boolean;
  exportOpen: boolean;
  prompt: PromptState | null;
  confirm: ConfirmState | null;
  toasts: Toast[];
  status: string;
  busy: boolean;
}

const EMPTY_LINKS: LinkGraph = { outgoing: {}, backlinks: {}, mentions: {}, unresolved: [] };

export const initialState: State = {
  ready: false,
  screen: 'startup',
  wizard: { step: 0, vaultPath: null, vaultName: 'Carbon Vault', aiChoice: null },
  vault: null,
  settings: {
    version: 2,
    theme: 'system',
    onboardingComplete: false,
    tourCompleted: false,
    lastVaultPath: null,
    lastNotePath: null,
    vaults: [],
    ai: {
      enabled: false,
      provider: 'ollama',
      model: 'llama3.2',
      temperature: 0.6,
      maxTokens: 1024,
      systemPrompt: '',
      ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
      custom: { baseUrl: 'http://127.0.0.1:1234/v1', model: 'gpt-4o-mini' },
      openai: { model: 'gpt-4o-mini' },
      anthropic: { model: 'claude-3-5-sonnet-latest' },
    },
    editor: {
      fontSize: 17,
      lineWidth: 'wide',
      showLineNumbers: false,
      spellcheck: true,
      autoSaveMs: 900,
      defaultMode: 'split',
    },
    ui: {
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      leftSidebarWidth: 248,
      rightSidebarWidth: 296,
      confirmDelete: true,
    },
    daily: { folder: 'Daily', format: 'YYYY-MM-DD', template: '' },
    templatesFolder: 'Templates',
    keybindings: {},
    window: { x: null, y: null, width: 1360, height: 860, maximized: false },
  },
  theme: 'light',
  notes: [],
  tree: null,
  links: EMPTY_LINKS,
  tabs: [],
  activePath: null,
  collapsed: {},
  explorerFilter: '',
  explorerOpen: true,
  focusMode: false,
  graphOpen: false,
  tourOpen: false,
  selected: [],
  ai: {
    open: false,
    streaming: false,
    streamId: null,
    action: 'continue',
    result: '',
    error: null,
    label: null,
    targetNote: null,
    selection: '',
    hasSelection: false,
    transcript: '',
  },
  search: { open: false, query: '', tag: null, folder: null, results: [], loading: false, error: null },
  palette: { open: false, mode: 'commands', query: '' },
  settingsOpen: false,
  settingsSection: 'general',
  helpOpen: false,
  exportOpen: false,
  prompt: null,
  confirm: null,
  toasts: [],
  status: 'Ready',
  busy: false,
};

type Listener = () => void;

class Store {
  private state: State = initialState;
  private listeners = new Set<Listener>();

  getState = (): State => this.state;

  setState = (patch: Partial<State> | ((state: State) => Partial<State>)): void => {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const store = new Store();

export function useApp<T>(selector: (state: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(initialState),
  );
}

export function getState(): State {
  return store.getState();
}

export function setState(patch: Partial<State> | ((state: State) => Partial<State>)): void {
  store.setState(patch);
}

/* --------------------------- derived helpers --------------------------- */

export function activeTab(state: State): Tab | null {
  if (!state.activePath) return null;
  return state.tabs.find((tab) => tab.path === state.activePath) ?? null;
}

export function isDirty(tab: Tab): boolean {
  return tab.content !== tab.savedContent;
}

export function untitledName(notes: NoteMeta[], base = 'Untitled'): string {
  const existing = new Set(notes.map((note) => note.path.toLowerCase()));
  let candidate = `${base}.md`;
  let counter = 1;
  while (existing.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${base} ${counter}.md`;
  }
  return candidate;
}

export function resolveTheme(mode: Settings['theme'], prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

/** All tags in the vault with note counts, most used first. */
export function vaultTags(notes: NoteMeta[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Every folder path in the vault, derived from note paths. */
export function vaultFolders(notes: NoteMeta[]): string[] {
  const folders = new Set<string>();
  for (const note of notes) {
    const parts = note.path.split('/');
    parts.pop();
    for (let index = 1; index <= parts.length; index += 1) {
      folders.add(parts.slice(0, index).join('/'));
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}
