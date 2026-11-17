import type {
  AIConnectionResult,
  AIChatRequest,
  AIErrorPayload,
  AIModelList,
  AppInfo,
  FileNode,
  LinkGraph,
  MenuCommand,
  NoteDoc,
  NoteMeta,
  ResolvedTheme,
  SearchHit,
  SearchOptions,
  SecretKey,
  SecretStatus,
  Settings,
  VaultInfo,
} from './types';
import type { ExportFormat } from './export';

/** Every IPC channel used between the renderer, preload and main process. */
export const IPC = {
  appInfo: 'app:info',
  appOpenExternal: 'app:open-external',
  appShowItemInFolder: 'app:show-item-in-folder',

  themeSet: 'theme:set',
  themeChanged: 'theme:changed',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  secretsStatus: 'secrets:status',
  secretsSet: 'secrets:set',
  secretsClear: 'secrets:clear',

  vaultChoose: 'vault:choose',
  vaultCreate: 'vault:create',
  vaultOpen: 'vault:open',
  vaultClose: 'vault:close',
  vaultSnapshot: 'vault:snapshot',
  vaultRead: 'vault:read',
  vaultWrite: 'vault:write',
  vaultCreateNote: 'vault:create-note',
  vaultCreateFolder: 'vault:create-folder',
  vaultRename: 'vault:rename',
  vaultDelete: 'vault:delete',
  vaultSearch: 'vault:search',
  vaultLinks: 'vault:links',
  vaultImport: 'vault:import',
  vaultChanged: 'vault:changed',

  exportNote: 'note:export',

  aiModels: 'ai:models',
  aiTest: 'ai:test',
  aiChat: 'ai:chat',
  aiCancel: 'ai:cancel',
  aiChunk: 'ai:chunk',
  aiDone: 'ai:done',
  aiError: 'ai:error',

  menuCommand: 'menu:command',
} as const;

export interface VaultSnapshot {
  vault: VaultInfo;
  notes: NoteMeta[];
  tree: FileNode;
  links: LinkGraph;
}

export interface WriteResult {
  path: string;
  mtime: number;
}

export interface RenameResult {
  oldPath: string;
  newPath: string;
}

export interface AIStreamChunk {
  streamId: string;
  delta: string;
}

export interface AIStreamDone {
  streamId: string;
  text: string;
}

export interface AIStreamError {
  streamId: string;
  error: AIErrorPayload;
}

export interface ImportResult {
  folder: string;
  imported: number;
}

export interface ExportRequest {
  format: ExportFormat;
  title: string;
  markdown: string;
  html: string;
}

export interface ExportResult {
  path: string;
}

/** The API exposed on `window.carbon` by the preload script. */
export interface CarbonApi {
  platform: 'win32' | 'darwin' | 'linux' | string;
  getAppInfo(): Promise<AppInfo>;

  settings: {
    get(): Promise<Settings>;
    update(patch: DeepPartial<Settings>): Promise<Settings>;
  };

  secrets: {
    status(): Promise<SecretStatus>;
    set(key: SecretKey, value: string): Promise<SecretStatus>;
    clear(key: SecretKey): Promise<SecretStatus>;
  };

  vault: {
    choose(): Promise<VaultInfo | null>;
    create(name: string, createInside: string | null): Promise<VaultInfo | null>;
    open(path: string): Promise<VaultSnapshot>;
    close(): Promise<void>;
    snapshot(): Promise<VaultSnapshot | null>;
    read(path: string): Promise<NoteDoc>;
    write(path: string, content: string): Promise<WriteResult>;
    createNote(path: string, content?: string): Promise<WriteResult>;
    createFolder(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<RenameResult>;
    delete(path: string): Promise<void>;
    search(options: SearchOptions): Promise<SearchHit[]>;
    links(): Promise<LinkGraph>;
    importMarkdown(): Promise<ImportResult | null>;
    onChanged(cb: () => void): () => void;
  };

  ai: {
    models(): Promise<AIModelList>;
    test(): Promise<AIConnectionResult>;
    chat(request: AIChatRequest): Promise<void>;
    cancel(streamId: string): Promise<void>;
    onChunk(cb: (chunk: AIStreamChunk) => void): () => void;
    onDone(cb: (done: AIStreamDone) => void): () => void;
    onError(cb: (err: AIStreamError) => void): () => void;
  };

  window: {
    setTheme(theme: ResolvedTheme): Promise<void>;
  };

  menu: {
    onCommand(cb: (command: MenuCommand) => void): () => void;
  };

  exportNote(request: ExportRequest): Promise<ExportResult | null>;

  openExternal(url: string): Promise<void>;
  showItemInFolder(path: string): Promise<void>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends Array<unknown> ? T[K] : DeepPartial<T[K]>) : T[K];
};
