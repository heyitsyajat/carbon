import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  nativeTheme,
  screen,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { IPC, type ExportRequest, type VaultSnapshot } from '../shared/ipc';
import type {
  AIChatRequest,
  AppInfo,
  ResolvedTheme,
  SearchOptions,
  SecretKey,
  Settings,
  ThemeMode,
} from '../shared/types';
import { resolveWithinRoot, sanitizeFileName, toRelativePath } from '../shared/paths';
import { AIService } from './ai-service';
import { exportNote } from './exporter';
import { installMenu } from './menu';
import { SecretStore } from './secrets';
import { SettingsStore, clampWindowState } from './settings';
import { VaultService } from './vault';

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let vault: VaultService | null = null;
let watcher: FSWatcher | null = null;
let watchTimer: NodeJS.Timeout | null = null;

// Isolated profiles (portable runs, screenshot capture) can point elsewhere.
if (process.env.CARBON_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.CARBON_USER_DATA));
}

const userDataDir = app.getPath('userData');
const settingsStore = new SettingsStore(path.join(userDataDir, 'settings.json'));
const secretStore = new SecretStore(path.join(userDataDir, 'secrets.json'));

const aiService = new AIService(() => settingsStore.current, secretStore, () => mainWindow);

const WINDOW_COLORS: Record<ResolvedTheme, { background: string; symbol: string }> = {
  light: { background: '#fbefe8', symbol: '#3b2026' },
  dark: { background: '#1b0f14', symbol: '#f6eae4' },
};

function effectiveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return mode;
}

function applyWindowTheme(theme: ResolvedTheme): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const colors = WINDOW_COLORS[theme];
  mainWindow.setBackgroundColor(colors.background);
  try {
    mainWindow.setTitleBarOverlay({ color: colors.background, symbolColor: colors.symbol, height: 38 });
  } catch {
    // Older Electron builds may not support updating the overlay; ignore.
  }
}

function savedBounds(): { x?: number; y?: number; width: number; height: number } {
  const displays = screen.getAllDisplays().map((display) => display.workArea);
  const state = clampWindowState(settingsStore.current.window, displays);
  return {
    ...(state.x !== null && state.y !== null ? { x: state.x, y: state.y } : {}),
    width: state.width,
    height: state.height,
  };
}

function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;
  const persist = () => {
    if (window.isDestroyed()) return;
    // getNormalBounds() is the restored size even while maximized, so the
    // saved size stays useful when the user later un-maximizes.
    const normal = window.getNormalBounds();
    void settingsStore
      .update({
        window: {
          x: normal.x,
          y: normal.y,
          width: normal.width,
          height: normal.height,
          maximized: window.isMaximized(),
        },
      })
      .catch((error: unknown) => console.warn('[window] could not save bounds:', error));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      persist();
    }, 500);
  };
  window.on('resize', schedule);
  window.on('move', schedule);
  window.on('close', () => {
    if (timer) clearTimeout(timer);
    persist();
  });
}

function createWindow(): void {
  const theme = effectiveTheme(settingsStore.current.theme);
  const colors = WINDOW_COLORS[theme];

  mainWindow = new BrowserWindow({
    ...savedBounds(),
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: colors.background,
    title: 'Carbon',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: colors.background, symbolColor: colors.symbol, height: 38 },
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
      devTools: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  if (settingsStore.current.window.maximized) mainWindow.maximize();
  trackWindowState(mainWindow);
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    aiService.cancelAll();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? '';
    if (url !== current) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

/* ------------------------------------------------------------------ */
/* Vault plumbing                                                      */
/* ------------------------------------------------------------------ */

function requireVault(): VaultService {
  if (!vault) throw new Error('No vault is open.');
  return vault;
}

async function snapshot(): Promise<VaultSnapshot | null> {
  if (!vault) return null;
  const { notes, tree } = await vault.scan();
  return { vault: { path: vault.root, name: vault.name }, notes, tree, links: vault.links() };
}

function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (watchTimer) {
    clearTimeout(watchTimer);
    watchTimer = null;
  }
}

function startWatching(): void {
  stopWatching();
  if (!vault) return;
  try {
    watcher = watch(vault.root, { recursive: true }, () => {
      if (watchTimer) clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        watchTimer = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC.vaultChanged);
        }
      }, 350);
    });
    watcher.on('error', (error) => {
      console.warn('[vault] watcher error:', error.message);
    });
  } catch (error) {
    console.warn('[vault] file watching unavailable:', (error as Error).message);
  }
}

async function openVault(vaultPath: string): Promise<VaultSnapshot> {
  const service = await VaultService.open(vaultPath);
  vault = service;
  const updated = await settingsStore.update({
    lastVaultPath: service.root,
    vaults: [
      { path: service.root, name: service.name, lastOpenedAt: Date.now() },
      ...settingsStore.current.vaults.filter((entry) => entry.path !== service.root),
    ].slice(0, 30),
  });
  applyWindowTheme(effectiveTheme(updated.theme));
  startWatching();
  const result = await snapshot();
  if (!result) throw new Error('Vault could not be read.');
  return result;
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> | TResult,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...(args as TArgs));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ipc] ${channel} failed: ${message}`);
      throw new Error(message);
    }
  });
}

function registerIpc(): void {
  handle(IPC.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    settingsPath: settingsStore.path,
    isPackaged: app.isPackaged,
  }));

  handle(IPC.appOpenExternal, async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https links can be opened.');
    await shell.openExternal(url);
  });

  handle(IPC.appShowItemInFolder, (_event, target: string) => {
    const service = requireVault();
    shell.showItemInFolder(resolveWithinRoot(service.root, target));
  });

  handle(IPC.themeSet, (_event, theme: ResolvedTheme) => {
    applyWindowTheme(theme === 'dark' ? 'dark' : 'light');
  });

  handle(IPC.settingsGet, () => settingsStore.current);

  handle(IPC.settingsUpdate, async (_event, patch: Partial<Settings>) => {
    const next = await settingsStore.update(patch);
    applyWindowTheme(effectiveTheme(next.theme));
    return next;
  });

  handle(IPC.secretsStatus, () => secretStore.status());
  handle(IPC.secretsSet, async (_event, key: SecretKey, value: string) => {
    if (!['openai', 'anthropic', 'custom'].includes(key)) throw new Error('Unknown secret slot.');
    return secretStore.set(key, value);
  });
  handle(IPC.secretsClear, (_event, key: SecretKey) => secretStore.clear(key));

  handle(IPC.vaultChoose, async () => {
    const options = {
      title: 'Open a vault',
      properties: ['openDirectory'] as const,
      buttonLabel: 'Open vault',
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { ...options, properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ ...options, properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    return { path: result.filePaths[0], name: path.basename(result.filePaths[0]) };
  });

  handle(IPC.vaultCreate, async (_event, name: string, createInside: string | null) => {
    let parent = createInside;
    if (!parent) {
      const result = await dialog.showOpenDialog({
        title: 'Choose where to create your vault',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Create vault here',
      });
      if (result.canceled || !result.filePaths[0]) return null;
      parent = result.filePaths[0];
    }
    const folder = sanitizeFileName(name || 'Carbon Vault');
    const target = path.join(parent, folder);
    const existing = await fs
      .readdir(target)
      .then((entries) => entries.filter((entry) => !entry.startsWith('.')))
      .catch(() => [] as string[]);
    if (existing.length > 0) {
      const conflict = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Use this folder', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Folder is not empty',
        message: `"${target}" already contains files.`,
        detail: 'Carbon can open it as a vault, but existing Markdown files will appear in the file list.',
      });
      if (conflict.response !== 0) return null;
    }
    const service = await VaultService.create(target);
    return { path: service.root, name: service.name };
  });

  handle(IPC.vaultOpen, (_event, vaultPath: string) => openVault(vaultPath));

  handle(IPC.vaultClose, () => {
    vault = null;
    stopWatching();
  });

  handle(IPC.vaultSnapshot, () => snapshot());

  handle(IPC.vaultRead, async (_event, notePath: string) => requireVault().read(notePath));

  handle(IPC.vaultWrite, async (_event, notePath: string, content: string) => {
    if (typeof content !== 'string') throw new Error('Note content must be text.');
    return requireVault().write(notePath, content);
  });

  handle(IPC.vaultCreateNote, async (_event, notePath: string, content?: string) => {
    const result = await requireVault().createNote(notePath, content ?? '');
    return result;
  });

  handle(IPC.vaultCreateFolder, async (_event, folderPath: string) => {
    await requireVault().createFolder(folderPath);
  });

  handle(IPC.vaultRename, async (_event, oldPath: string, newPath: string) => {
    return requireVault().rename(oldPath, newPath);
  });

  handle(IPC.vaultDelete, async (_event, target: string) => {
    const service = requireVault();
    const absolute = resolveWithinRoot(service.root, target);
    try {
      await shell.trashItem(absolute);
    } catch {
      await service.remove(toRelativePath(target));
    }
  });

  handle(IPC.vaultSearch, (_event, options: SearchOptions) => {
    if (!options || typeof options.query !== 'string') throw new Error('Search query must be text.');
    return requireVault().search(options.query, {
      tag: typeof options.tag === 'string' ? options.tag : null,
      folder: typeof options.folder === 'string' ? options.folder : null,
    });
  });

  handle(IPC.vaultLinks, () => requireVault().links());

  handle(IPC.vaultImport, async () => {
    const service = requireVault();
    const selection = await dialog.showOpenDialog({
      title: 'Choose a folder of Markdown notes',
      properties: ['openDirectory'],
      buttonLabel: 'Import notes',
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const result = await service.importMarkdown(selection.filePaths[0]);
    await service.scan();
    return result;
  });

  handle(IPC.exportNote, async (_event, request: ExportRequest) => {
    if (!request || typeof request.html !== 'string' || typeof request.markdown !== 'string') {
      throw new Error('Nothing to export yet.');
    }
    return exportNote(mainWindow, request);
  });

  handle(IPC.aiModels, () => aiService.listModels());
  handle(IPC.aiTest, () => aiService.test());
  handle(IPC.aiChat, async (_event, request: AIChatRequest) => {
    if (!request || typeof request.streamId !== 'string' || !Array.isArray(request.messages)) {
      throw new Error('Malformed AI request.');
    }
    await aiService.chat(request);
  });
  handle(IPC.aiCancel, async (_event, streamId: string) => {
    await aiService.cancel(streamId);
  });
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.setAppUserModelId('com.carbon.app');

  app.whenReady().then(async () => {
    const settings = await settingsStore.load();
    nativeTheme.themeSource = settings.theme;
    await secretStore.status();

    registerIpc();
    installMenu(() => mainWindow);
    createWindow();

    nativeTheme.on('updated', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const theme = effectiveTheme(settingsStore.current.theme);
      applyWindowTheme(theme);
      mainWindow.webContents.send(IPC.themeChanged, theme);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    aiService.cancelAll();
    stopWatching();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!url.startsWith('file://') && !(devServerUrl && url.startsWith(devServerUrl))) {
        event.preventDefault();
      }
    });
  });
}
