import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AIStreamChunk,
  type AIStreamDone,
  type AIStreamError,
  type CarbonApi,
  type VaultSnapshot,
} from '../shared/ipc';
import type { MenuCommand, ResolvedTheme, SecretKey, Settings } from '../shared/types';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// Renderer access is limited to this explicit, typed surface. No Node.js APIs
// and no raw ipcRenderer are exposed to page code.
const api: CarbonApi = {
  platform: process.platform,

  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),

  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch) as Promise<Settings>,
  },

  secrets: {
    status: () => ipcRenderer.invoke(IPC.secretsStatus),
    set: (key: SecretKey, value: string) => ipcRenderer.invoke(IPC.secretsSet, key, value),
    clear: (key: SecretKey) => ipcRenderer.invoke(IPC.secretsClear, key),
  },

  vault: {
    choose: () => ipcRenderer.invoke(IPC.vaultChoose),
    create: (name: string, createInside: string | null) => ipcRenderer.invoke(IPC.vaultCreate, name, createInside),
    open: (vaultPath: string) => ipcRenderer.invoke(IPC.vaultOpen, vaultPath) as Promise<VaultSnapshot>,
    close: () => ipcRenderer.invoke(IPC.vaultClose),
    snapshot: () => ipcRenderer.invoke(IPC.vaultSnapshot) as Promise<VaultSnapshot | null>,
    read: (notePath: string) => ipcRenderer.invoke(IPC.vaultRead, notePath),
    write: (notePath: string, content: string) => ipcRenderer.invoke(IPC.vaultWrite, notePath, content),
    createNote: (notePath: string, content?: string) =>
      ipcRenderer.invoke(IPC.vaultCreateNote, notePath, content),
    createFolder: (folderPath: string) => ipcRenderer.invoke(IPC.vaultCreateFolder, folderPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke(IPC.vaultRename, oldPath, newPath),
    delete: (notePath: string) => ipcRenderer.invoke(IPC.vaultDelete, notePath),
    search: (options) => ipcRenderer.invoke(IPC.vaultSearch, options),
    links: () => ipcRenderer.invoke(IPC.vaultLinks),
    importMarkdown: () => ipcRenderer.invoke(IPC.vaultImport),
    onChanged: (cb: () => void) => subscribe<void>(IPC.vaultChanged, () => cb()),
  },

  ai: {
    models: () => ipcRenderer.invoke(IPC.aiModels),
    test: () => ipcRenderer.invoke(IPC.aiTest),
    chat: (request) => ipcRenderer.invoke(IPC.aiChat, request),
    cancel: (streamId: string) => ipcRenderer.invoke(IPC.aiCancel, streamId),
    onChunk: (cb: (chunk: AIStreamChunk) => void) => subscribe<AIStreamChunk>(IPC.aiChunk, cb),
    onDone: (cb: (done: AIStreamDone) => void) => subscribe<AIStreamDone>(IPC.aiDone, cb),
    onError: (cb: (err: AIStreamError) => void) => subscribe<AIStreamError>(IPC.aiError, cb),
  },

  window: {
    setTheme: (theme: ResolvedTheme) => ipcRenderer.invoke(IPC.themeSet, theme) as Promise<void>,
  },

  menu: {
    onCommand: (cb: (command: MenuCommand) => void) => subscribe<MenuCommand>(IPC.menuCommand, cb),
  },

  exportNote: (request) => ipcRenderer.invoke(IPC.exportNote, request),

  openExternal: (url: string) => ipcRenderer.invoke(IPC.appOpenExternal, url),
  showItemInFolder: (itemPath: string) => ipcRenderer.invoke(IPC.appShowItemInFolder, itemPath),
};

contextBridge.exposeInMainWorld('carbon', api);
