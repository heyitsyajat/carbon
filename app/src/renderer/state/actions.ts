import type {
  AIChatRequest,
  AIProviderId,
  AIAction,
  ChatMessage,
  MenuCommand,
  NoteDoc,
  SearchOptions,
  Settings,
} from '@shared/types';
import { buildMessages, describeRequest, type ActionContext } from '@shared/ai/actions';
import { PROVIDER_LABELS } from '@shared/ai/provider';
import { friendlyError } from '@shared/errors';
import { DEFAULT_KEYBINDINGS } from '@shared/keybindings';
import { noteToHtmlDocument, type ExportFormat } from '@shared/export';
import {
  DEFAULT_DAILY_TEMPLATE,
  DEFAULT_MEETING_TEMPLATE,
  dailyNotePath,
  meetingNotePath,
  resolveTemplate,
} from '@shared/templates';
import { renderNote } from '../lib/preview';
import {
  activeTab,
  getState,
  isDirty,
  resolveTheme,
  setState,
  untitledName,
  type PaletteMode,
  type State,
  type Tab,
} from './store';
import { editor, readSelection } from '../lib/editor-bridge';

let toastCounter = 0;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let linksTimer: ReturnType<typeof setTimeout> | null = null;

/* ------------------------------- feedback ------------------------------ */

export function toast(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  toastCounter += 1;
  const id = toastCounter;
  setState((state) => ({ toasts: [...state.toasts, { id, message, tone }].slice(-4) }));
  setTimeout(
    () => setState((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) })),
    tone === 'error' ? 8000 : 3600,
  );
}

export function toastError(error: unknown, context: string): void {
  toast(friendlyError(error, context), 'error');
}

export function setStatus(status: string): void {
  setState({ status });
}

function alignTheme(settings: Settings): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = resolveTheme(settings.theme, prefersDark);
  document.documentElement.dataset.theme = theme;
  setState({ theme, settings });
  void window.carbon.window.setTheme(theme);
}

/* ------------------------------- startup ------------------------------- */

export async function bootstrap(): Promise<void> {
  try {
    const settings = await window.carbon.settings.get();
    alignTheme(settings);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const current = getState().settings;
      if (current.theme === 'system') alignTheme(current);
    });

    document.documentElement.style.setProperty('--editor-font-size', `${settings.editor.fontSize}px`);
    setState({
      ready: true,
      explorerOpen: settings.ui.leftSidebarOpen,
      tourOpen: settings.onboardingComplete && !settings.tourCompleted,
    });

    if (settings.lastVaultPath) {
      try {
        await openVault(settings.lastVaultPath, { auto: true });
        return;
      } catch {
        // Fall through to the startup screen if the last vault is gone.
      }
    }
    setState({ screen: 'startup' });
  } catch (error) {
    setState({ ready: true, screen: 'startup' });
    toastError(error, 'Carbon could not read its settings');
  }
}

/* -------------------------------- vault -------------------------------- */

function snapshotIntoVault(snapshot: Awaited<ReturnType<typeof window.carbon.vault.snapshot>>): void {
  if (!snapshot) return;
  setState({
    vault: snapshot.vault,
    notes: snapshot.notes,
    tree: snapshot.tree,
    links: snapshot.links,
  });
}

export async function refreshVault(): Promise<void> {
  if (!getState().vault) return;
  try {
    const snapshot = await window.carbon.vault.snapshot();
    snapshotIntoVault(snapshot);
  } catch (error) {
    setStatus(`Refresh failed: ${friendlyError(error, 'The vault')}`);
  }
}

export function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshVault();
  }, 400);
}

export async function openVault(vaultPath: string, options: { auto?: boolean } = {}): Promise<boolean> {
  setState({ busy: true, status: 'Opening vault…' });
  try {
    const snapshot = await window.carbon.vault.open(vaultPath);
    snapshotIntoVault(snapshot);
    const settings = await window.carbon.settings.get();
    alignTheme(settings);
    setState({
      screen: 'workspace',
      busy: false,
      tabs: [],
      activePath: null,
      selected: [],
      explorerOpen: settings.ui.leftSidebarOpen,
      focusMode: false,
      status: 'Ready',
    });

    const remembered = settings.lastNotePath
      ? snapshot.notes.find((note) => note.path === settings.lastNotePath)
      : undefined;
    const first =
      remembered ?? snapshot.notes.find((note) => /welcome/i.test(note.title)) ?? snapshot.notes[0];
    if (first) await openNote(first.path);
    return true;
  } catch (error) {
    setState({ busy: false, status: 'Vault could not be opened' });
    toastError(error, 'That folder');
    if (options.auto) setState({ screen: 'startup' });
    return false;
  }
}

export async function chooseVault(): Promise<string | null> {
  const chosen = await window.carbon.vault.choose();
  if (!chosen) return null;
  const ok = await openVault(chosen.path);
  return ok ? chosen.path : null;
}

export async function closeVault(): Promise<void> {
  await window.carbon.vault.close();
  setState({
    screen: 'startup',
    vault: null,
    notes: [],
    tree: null,
    links: { outgoing: {}, backlinks: {}, mentions: {}, unresolved: [] },
    tabs: [],
    activePath: null,
    focusMode: false,
    graphOpen: false,
    ai: { ...getState().ai, open: false, result: '', error: null },
  });
}

/* --------------------------------- tabs -------------------------------- */

export async function openNote(notePath: string, options: { newTab?: boolean } = {}): Promise<void> {
  const state = getState();
  const existing = state.tabs.find((tab) => tab.path === notePath);
  if (existing && !options.newTab) {
    setState({ activePath: notePath, focusMode: state.focusMode });
    rememberNote(notePath);
    setTimeout(() => editor()?.focus(), 0);
    return;
  }
  try {
    const doc: NoteDoc = await window.carbon.vault.read(notePath);
    const tab: Tab = {
      path: doc.path,
      title: doc.path.split('/').pop()?.replace(/\.md$/i, '') ?? doc.path,
      content: doc.content,
      savedContent: doc.content,
      mode: getState().settings.editor.defaultMode,
    };
    setState((current) => ({
      tabs: [...current.tabs, tab],
      activePath: tab.path,
      selected: [tab.path],
      graphOpen: false,
    }));
    rememberNote(notePath);
  } catch (error) {
    toastError(error, 'That note');
  }
}

function rememberNote(notePath: string): void {
  if (getState().settings.lastNotePath === notePath) return;
  void window.carbon.settings.update({ lastNotePath: notePath }).then((settings) => {
    setState({ settings });
  });
}

export function activateTab(notePath: string): void {
  setState({ activePath: notePath });
  rememberNote(notePath);
}

export async function closeTab(notePath: string): Promise<void> {
  const state = getState();
  const tab = state.tabs.find((entry) => entry.path === notePath);
  if (tab && isDirty(tab)) await saveTab(notePath);
  const index = state.tabs.findIndex((entry) => entry.path === notePath);
  const tabs = state.tabs.filter((entry) => entry.path !== notePath);
  const nextActive =
    state.activePath === notePath
      ? (tabs[Math.max(0, index - 1)]?.path ?? tabs[0]?.path ?? null)
      : state.activePath;
  setState({ tabs, activePath: nextActive });
}

export async function closeActiveTab(): Promise<void> {
  const path = getState().activePath;
  if (path) await closeTab(path);
}

export function setTabMode(notePath: string, mode: Tab['mode']): void {
  setState((state) => ({
    tabs: state.tabs.map((tab) => (tab.path === notePath ? { ...tab, mode } : tab)),
  }));
}

export function cycleTabMode(): void {
  const state = getState();
  const tab = activeTab(state);
  if (!tab) return;
  const order: Tab['mode'][] = ['edit', 'split', 'preview'];
  const next = order[(order.indexOf(tab.mode) + 1) % order.length] ?? 'split';
  setTabMode(tab.path, next);
}

/** Updates note text in memory and schedules an autosave. */
export function updateNoteContent(notePath: string, content: string): void {
  setState((state) => ({
    tabs: state.tabs.map((tab) => (tab.path === notePath ? { ...tab, content } : tab)),
  }));
  const delay = getState().settings.editor.autoSaveMs;
  if (delay <= 0) return;
  const existing = saveTimers.get(notePath);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    notePath,
    setTimeout(() => {
      saveTimers.delete(notePath);
      void saveTab(notePath, { silent: true });
    }, delay),
  );
}

export async function saveTab(notePath: string, options: { silent?: boolean } = {}): Promise<boolean> {
  const timer = saveTimers.get(notePath);
  if (timer) {
    clearTimeout(timer);
    saveTimers.delete(notePath);
  }
  const state = getState();
  const tab = state.tabs.find((entry) => entry.path === notePath);
  if (!tab) return false;
  if (!isDirty(tab)) return true;
  try {
    await window.carbon.vault.write(tab.path, tab.content);
    setState((current) => ({
      tabs: current.tabs.map((entry) =>
        entry.path === tab.path ? { ...entry, savedContent: entry.content } : entry,
      ),
      status: 'Saved',
    }));
    scheduleLinksRefresh();
    if (!options.silent) setStatus('Saved');
    return true;
  } catch (error) {
    toastError(error, 'The note could not be saved');
    return false;
  }
}

export async function saveActive(): Promise<void> {
  const path = getState().activePath;
  if (path) await saveTab(path);
}

export function scheduleLinksRefresh(): void {
  if (linksTimer) clearTimeout(linksTimer);
  linksTimer = setTimeout(() => {
    if (!getState().vault) return;
    void window.carbon.vault
      .links()
      .then((links) => setState({ links }))
      .catch(() => undefined);
  }, 500);
}

/* ----------------------------- file actions ---------------------------- */

function selectedFolderPath(): string {
  const state = getState();
  const selected = state.selected[0];
  if (!selected) return '';
  return selected.includes('.') ? selected.split('/').slice(0, -1).join('/') : selected;
}

export function createNote(folder?: string): void {
  const state = getState();
  if (!state.vault) return;
  setState({
    prompt: {
      kind: 'new-note',
      title: 'New note',
      value: untitledName(state.notes),
      ...(folder !== undefined ? { folder } : {}),
    },
  });
}

export function createFolder(): void {
  if (!getState().vault) return;
  setState({ prompt: { kind: 'new-folder', title: 'New folder', value: 'New folder' } });
}

export function createMeetingNote(): void {
  if (!getState().vault) return;
  setState({ prompt: { kind: 'meeting', title: 'New meeting note', value: 'Weekly sync' } });
}

export function requestRename(notePath: string): void {
  const name = notePath.split('/').pop() ?? notePath;
  setState({ prompt: { kind: 'rename', title: 'Rename', value: name, target: notePath } });
}

async function createNoteAt(notePath: string, content: string): Promise<void> {
  try {
    await window.carbon.vault.createNote(notePath, content);
    await refreshVault();
    await openNote(notePath);
    setStatus('Note created');
  } catch (error) {
    toastError(error, 'The note');
  }
}

export async function submitPrompt(value: string): Promise<void> {
  const state = getState();
  const prompt = state.prompt;
  if (!prompt) return;
  const clean = value.trim();
  if (!clean) return;
  setState({ prompt: null });

  if (prompt.kind === 'meeting') {
    const now = new Date();
    const path = meetingNotePath('Meetings', now, clean);
    const template = DEFAULT_MEETING_TEMPLATE;
    await createNoteAt(path, resolveTemplate(template, { title: clean, date: now }));
    return;
  }

  try {
    if (prompt.kind === 'new-note') {
      const name = /\.md$/i.test(clean) ? clean : `${clean}.md`;
      const folder = prompt.folder ?? selectedFolderPath();
      const notePath = folder ? `${folder}/${name}` : name;
      await createNoteAt(notePath, `# ${name.replace(/\.md$/i, '')}\n\n`);
    } else if (prompt.kind === 'new-folder') {
      const parent = selectedFolderPath();
      const folderPath = parent ? `${parent}/${clean}` : clean;
      await window.carbon.vault.createFolder(folderPath);
      await refreshVault();
      setState({ collapsed: { ...getState().collapsed, [parent]: false } });
      setStatus('Folder created');
    } else if (prompt.kind === 'rename' && prompt.target) {
      const oldPath = prompt.target;
      const dir = oldPath.split('/').slice(0, -1).join('/');
      const name = /\.md$/i.test(clean) ? clean : `${clean}.md`;
      const newPath = dir ? `${dir}/${name}` : name;
      await window.carbon.vault.rename(oldPath, newPath);
      setState((current) => ({
        tabs: current.tabs.map((tab) =>
          tab.path === oldPath
            ? { ...tab, path: newPath, title: newPath.split('/').pop()?.replace(/\.md$/i, '') ?? newPath }
            : tab,
        ),
        activePath: current.activePath === oldPath ? newPath : current.activePath,
        selected: [newPath],
      }));
      await refreshVault();
      setStatus('Renamed');
    }
  } catch (error) {
    toastError(error, 'That change');
  }
}

export function requestDelete(notePath: string): void {
  const name = notePath.split('/').pop() ?? notePath;
  const remove = async () => {
    try {
      await window.carbon.vault.delete(notePath);
      setState((state) => ({
        tabs: state.tabs.filter((tab) => tab.path !== notePath),
        activePath:
          state.activePath === notePath
            ? (state.tabs.find((tab) => tab.path !== notePath)?.path ?? null)
            : state.activePath,
      }));
      await refreshVault();
      toast(`“${name}” moved to the Recycle Bin`, 'success');
    } catch (error) {
      toastError(error, 'The note');
    }
  };
  if (getState().settings.ui.confirmDelete) {
    setState({
      confirm: {
        title: `Delete “${name}”?`,
        message: 'The file moves to the Windows Recycle Bin, so you can restore it from there if needed.',
        confirmLabel: 'Move to Recycle Bin',
        tone: 'danger',
        onConfirm: () => {
          setState({ confirm: null });
          void remove();
        },
      },
    });
  } else {
    void remove();
  }
}

export function toggleFolder(folderPath: string): void {
  setState((state) => ({
    collapsed: { ...state.collapsed, [folderPath]: !state.collapsed[folderPath] },
  }));
}

export function selectNote(notePath: string, additive: boolean): void {
  setState((state) => {
    if (!additive) return { selected: [notePath] };
    const has = state.selected.includes(notePath);
    return {
      selected: has ? state.selected.filter((entry) => entry !== notePath) : [...state.selected, notePath],
    };
  });
}

/* --------------------------- daily + templates ------------------------- */

export async function openDailyNote(): Promise<void> {
  const state = getState();
  if (!state.vault) return;
  const now = new Date();
  const path = dailyNotePath(state.settings.daily.folder, state.settings.daily.format, now);
  const existing = state.notes.find((note) => note.path === path);
  if (existing) {
    await openNote(path);
    return;
  }
  try {
    if (state.settings.daily.folder) await window.carbon.vault.createFolder(state.settings.daily.folder);
    const template = state.settings.daily.template.trim() || DEFAULT_DAILY_TEMPLATE;
    const title = path.split('/').pop()?.replace(/\.md$/i, '') ?? 'Today';
    await window.carbon.vault.createNote(path, resolveTemplate(template, { title, date: now }));
    await refreshVault();
    await openNote(path);
    setStatus('Today’s note is ready');
  } catch (error) {
    toastError(error, 'Today’s note');
  }
}

export function templateNotes(): Array<{ path: string; title: string }> {
  const state = getState();
  const folder = state.settings.templatesFolder.replace(/\/+$/, '');
  if (!folder) return [];
  return state.notes
    .filter((note) => note.path === folder || note.path.startsWith(`${folder}/`))
    .map((note) => ({ path: note.path, title: note.title }));
}

export function openTemplates(): void {
  if (templateNotes().length === 0) {
    createTemplate();
    return;
  }
  setState({ palette: { open: true, mode: 'templates', query: '' } });
}

export function createTemplate(): void {
  const folder = getState().settings.templatesFolder || 'Templates';
  setState({
    prompt: {
      kind: 'new-note',
      title: 'New template',
      value: 'Note template.md',
      folder,
    },
  });
}

export async function insertTemplate(templatePath: string): Promise<void> {
  const tab = activeTab(getState());
  if (!tab) {
    toast('Open a note first, then insert a template.', 'info');
    return;
  }
  try {
    const doc = await window.carbon.vault.read(templatePath);
    const resolved = resolveTemplate(doc.content, { title: tab.title, date: new Date() });
    const handle = editor();
    if (!handle) {
      toast('The editor is not ready yet. Try again in a moment.', 'info');
      return;
    }
    handle.insert(`\n${resolved.trim()}\n`);
    setStatus('Template inserted');
  } catch (error) {
    toastError(error, 'That template');
  }
}

/* -------------------------------- export ------------------------------- */

export async function exportCurrentNote(format: ExportFormat): Promise<void> {
  const state = getState();
  const tab = activeTab(state);
  if (!tab) {
    toast('Open a note to export it.', 'info');
    return;
  }
  try {
    const { html } = renderNote(tab.content, {
      notePaths: new Set(state.notes.map((note) => note.path.toLowerCase())),
      noteTitles: new Map(state.notes.map((note) => [note.path, note.title])),
    });
    const document = noteToHtmlDocument({ title: tab.title, bodyHtml: html, content: tab.content });
    const result = await window.carbon.exportNote({
      format,
      title: tab.title,
      markdown: tab.content,
      html: document,
    });
    if (result) toast(`Exported to ${result.path}`, 'success');
  } catch (error) {
    toastError(error, 'The export');
  }
}

/* -------------------------------- import ------------------------------- */

export async function importMarkdownFolder(): Promise<void> {
  if (!getState().vault) return;
  setState({
    confirm: {
      title: 'Import Markdown notes?',
      message:
        'Carbon copies Markdown files from another folder into a new folder in this vault. Your original notes are left untouched.',
      confirmLabel: 'Choose folder…',
      onConfirm: async () => {
        setState({ confirm: null, busy: true, status: 'Importing notes…' });
        try {
          const result = await window.carbon.vault.importMarkdown();
          if (result) {
            await refreshVault();
            toast(`Imported ${result.imported} note${result.imported === 1 ? '' : 's'} into “${result.folder}”`, 'success');
          }
        } catch (error) {
          toastError(error, 'The import');
        } finally {
          setState({ busy: false, status: 'Ready' });
        }
      },
    },
  });
}

/* --------------------------------- search ------------------------------ */

export function openSearch(prefill: { query?: string; tag?: string; folder?: string } = {}): void {
  setState({
    search: {
      open: true,
      query: prefill.query ?? '',
      tag: prefill.tag ?? null,
      folder: prefill.folder ?? null,
      results: [],
      loading: true,
      error: null,
    },
    palette: { ...getState().palette, open: false },
  });
  void runSearch();
}

export function closeSearch(): void {
  setState((state) => ({ search: { ...state.search, open: false } }));
}

export function setSearchQuery(query: string): void {
  setState((state) => ({ search: { ...state.search, query } }));
  scheduleSearch();
}

export function setSearchTag(tag: string | null): void {
  setState((state) => ({ search: { ...state.search, tag, loading: true } }));
  void runSearch();
}

export function setSearchFolder(folder: string | null): void {
  setState((state) => ({ search: { ...state.search, folder, loading: true } }));
  void runSearch();
}

function scheduleSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    void runSearch();
  }, 180);
}

export async function runSearch(): Promise<void> {
  const { search, vault } = getState();
  if (!search.open || !vault) return;
  if (!search.query.trim() && !search.tag && !search.folder) {
    setState((state) => ({ search: { ...state.search, results: [], loading: false, error: null } }));
    return;
  }
  setState((state) => ({ search: { ...state.search, loading: true, error: null } }));
  try {
    const options: SearchOptions = {
      query: search.query,
      tag: search.tag,
      folder: search.folder,
    };
    const results = await window.carbon.vault.search(options);
    setState((state) => ({ search: { ...state.search, results, loading: false } }));
  } catch (error) {
    setState((state) => ({
      search: { ...state.search, loading: false, error: friendlyError(error, 'Search') },
    }));
  }
}

export async function revealSearchHit(path: string, line: number): Promise<void> {
  closeSearch();
  await openNote(path);
  if (line > 0) setTimeout(() => editor()?.scrollToLine(line), 120);
}

/* ------------------------------- view state ---------------------------- */

export function toggleFocusMode(): void {
  setState((state) => ({ focusMode: !state.focusMode }));
}

export function openGraph(): void {
  setState({ graphOpen: true, focusMode: false });
}

export function closeGraph(): void {
  setState({ graphOpen: false });
}

export function openTour(): void {
  setState({ tourOpen: true });
}

export async function completeTour(): Promise<void> {
  setState({ tourOpen: false });
  if (!getState().settings.tourCompleted) await updateSettings({ tourCompleted: true });
}

/* -------------------------------- AI ---------------------------------- */

const listeners = { attached: false };

export function attachAIListeners(): void {
  if (listeners.attached) return;
  listeners.attached = true;

  window.carbon.ai.onChunk(({ streamId, delta }) => {
    if (getState().ai.streamId !== streamId) return;
    setState((state) => ({ ai: { ...state.ai, result: state.ai.result + delta } }));
  });

  window.carbon.ai.onDone(({ streamId }) => {
    if (getState().ai.streamId !== streamId) return;
    setState((state) => ({
      ai: { ...state.ai, streaming: false, streamId: null },
      status: 'Assistant finished',
    }));
  });

  window.carbon.ai.onError(({ streamId, error }) => {
    if (getState().ai.streamId !== streamId) return;
    setState((state) => ({
      ai: { ...state.ai, streaming: false, streamId: null, error },
      status: 'Assistant request failed',
    }));
  });
}

export function openAIPanel(action?: AIAction): void {
  const selection = readSelection();
  const { settings } = getState();
  if (!settings.ui.rightSidebarOpen) {
    void updateSettings({ ui: { ...settings.ui, rightSidebarOpen: true } });
  }
  setState((state) => ({
    ai: {
      ...state.ai,
      open: true,
      action: action ?? state.ai.action,
      selection: selection.text,
      hasSelection: !selection.empty,
      error: null,
    },
    focusMode: false,
  }));
}

export function setTranscript(transcript: string): void {
  setState((state) => ({ ai: { ...state.ai, transcript } }));
}

export async function runAI(action: AIAction, instruction?: string): Promise<void> {
  const state = getState();
  const tab = activeTab(state);

  if (!state.settings.ai.enabled) {
    setState((current) => ({
      ai: { ...current.ai, open: true, action, error: null, result: '' },
    }));
    return;
  }

  if (!tab) {
    toast('Open a note first.', 'info');
    return;
  }
  if (state.ai.streaming) await cancelAI();

  const selection = readSelection();
  const useSelection = !selection.empty && ['rewrite', 'summarize', 'bullets', 'table', 'action-items', 'custom', 'meeting'].includes(action);
  const extraPaths = state.selected.filter((path) => path !== tab.path && path.endsWith('.md'));
  const extraNotes: Array<{ title: string; content: string }> = [];
  for (const extraPath of extraPaths.slice(0, 5)) {
    try {
      const doc = await window.carbon.vault.read(extraPath);
      extraNotes.push({ title: doc.path.split('/').pop() ?? doc.path, content: doc.content });
    } catch {
      // Ignore unreadable notes; the active note is still useful context.
    }
  }

  const context: ActionContext = {
    action,
    noteTitle: tab.title,
    noteContent: tab.content,
    extraNotes,
    ...(useSelection ? { selection: selection.text } : {}),
    ...(instruction ? { instruction } : {}),
    ...(action === 'meeting' ? { selection: instruction || state.ai.transcript } : {}),
  };

  const settings = state.settings;
  const messages: ChatMessage[] = buildMessages(context, settings.ai.systemPrompt);
  const streamId = crypto.randomUUID();

  setState((current) => ({
    ai: {
      ...current.ai,
      open: true,
      action,
      streaming: true,
      streamId,
      result: '',
      error: null,
      label: describeRequest(context),
      targetNote: tab.path,
      selection: useSelection ? context.selection ?? '' : '',
      hasSelection: useSelection,
    },
    status: `Asking ${PROVIDER_LABELS[settings.ai.provider]}…`,
  }));

  try {
    const request: AIChatRequest = {
      streamId,
      action,
      messages,
      label: describeRequest(context),
    };
    await window.carbon.ai.chat(request);
  } catch (error) {
    setState((current) => ({
      ai: {
        ...current.ai,
        streaming: false,
        streamId: null,
        error: { code: 'unknown', message: friendlyError(error, 'The assistant') },
      },
    }));
  }
}

export async function cancelAI(): Promise<void> {
  const streamId = getState().ai.streamId;
  if (!streamId) return;
  await window.carbon.ai.cancel(streamId);
  setState((state) => ({ ai: { ...state.ai, streaming: false, streamId: null } }));
}

export function applyAIResult(mode: 'insert' | 'replace' | 'append'): void {
  const state = getState();
  const result = state.ai.result.trim();
  if (!result) return;
  const handle = editor();
  if (!handle || !state.activePath) {
    toast('Open the note you want to edit, then try again.', 'info');
    return;
  }
  if (mode === 'replace' && state.ai.selection) handle.replaceSelection(result);
  else if (mode === 'append') handle.insertAtLine(`\n${result}\n`, Number.MAX_SAFE_INTEGER);
  else handle.insert(`\n${result}\n`);
  setStatus('Inserted assistant text');
  handle.focus();
}

export function clearAIResult(): void {
  setState((state) => ({ ai: { ...state.ai, result: '', error: null, label: null } }));
}

export async function enableAI(): Promise<void> {
  await updateSettings({ ai: { ...getState().settings.ai, enabled: true } });
}

/* ------------------------------ settings ------------------------------ */

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  try {
    const settings = await window.carbon.settings.update(patch);
    alignTheme(settings);
    setState({ settings, explorerOpen: settings.ui.leftSidebarOpen });
    document.documentElement.style.setProperty('--editor-font-size', `${settings.editor.fontSize}px`);
  } catch (error) {
    toastError(error, 'Settings could not be saved');
  }
}

export function toggleLeftSidebar(): void {
  const state = getState();
  const open = !state.explorerOpen;
  setState({ explorerOpen: open });
  void updateSettings({ ui: { ...state.settings.ui, leftSidebarOpen: open } });
}

export function toggleRightSidebar(): void {
  const state = getState();
  const open = !state.settings.ui.rightSidebarOpen;
  void updateSettings({ ui: { ...state.settings.ui, rightSidebarOpen: open } });
}

export function openSettings(section: 'general' | 'editor' | 'ai' | 'shortcuts' | 'about' = 'general'): void {
  setState({ settingsOpen: true, settingsSection: section });
}

export function closeSettings(): void {
  setState({ settingsOpen: false });
}

export function setSettingsSection(section: 'general' | 'editor' | 'ai' | 'shortcuts' | 'about'): void {
  setState({ settingsSection: section });
}

export function openHelp(): void {
  setState({ helpOpen: true });
}

export function openExport(): void {
  if (!activeTab(getState())) {
    toast('Open a note to export it.', 'info');
    return;
  }
  setState({ exportOpen: true });
}

export function closeExport(): void {
  setState({ exportOpen: false });
}

export function closeHelp(): void {
  setState({ helpOpen: false });
}

export async function setKeybinding(command: string, accelerator: string): Promise<void> {
  const keybindings = { ...getState().settings.keybindings, [command]: accelerator };
  await updateSettings({ keybindings });
}

export async function resetKeybindings(): Promise<void> {
  await updateSettings({ keybindings: { ...DEFAULT_KEYBINDINGS } });
}

/* -------------------------------- wizard ------------------------------- */

export function startWizard(): void {
  setState({
    screen: 'wizard',
    wizard: { step: 0, vaultPath: null, vaultName: 'Carbon Vault', aiChoice: null },
  });
}

export function setWizard(patch: Partial<State['wizard']>): void {
  setState((state) => ({ wizard: { ...state.wizard, ...patch } }));
}

export async function finishWizard(): Promise<void> {
  const wizard = getState().wizard;
  if (!wizard.vaultPath) {
    toast('Choose a vault folder to finish setup.', 'error');
    return;
  }
  const settings = getState().settings;
  await updateSettings({
    onboardingComplete: true,
    ai: { ...settings.ai, enabled: wizard.aiChoice === 'configure' },
  });
  const opened = await openVault(wizard.vaultPath);
  if (opened) {
    setState({ tourOpen: true });
    if (!settings.ai.enabled && wizard.aiChoice === 'configure') {
      toast('AI is enabled — add your provider details in Settings → AI.', 'info');
    }
  }
}

export async function openVaultPicker(): Promise<void> {
  await chooseVault();
}

/* ------------------------------- palette ------------------------------ */

export function openPalette(mode: PaletteMode): void {
  setState({ palette: { open: true, mode, query: '' } });
}

export function closePalette(): void {
  setState({ palette: { open: false, mode: 'commands', query: '' } });
}

/* ------------------------------ commands ------------------------------ */

export function runMenuCommand(command: MenuCommand): void {
  switch (command) {
    case 'new-note':
      createNote();
      break;
    case 'new-meeting':
      createMeetingNote();
      break;
    case 'daily-note':
      void openDailyNote();
      break;
    case 'templates':
      openTemplates();
      break;
    case 'export-note':
      openExport();
      break;
    case 'import-vault':
      void importMarkdownFolder();
      break;
    case 'graph-view':
      openGraph();
      break;
    case 'focus-mode':
      toggleFocusMode();
      break;
    case 'play-tour':
      openTour();
      break;
    case 'new-folder':
      createFolder();
      break;
    case 'save-note':
      void saveActive();
      break;
    case 'close-tab':
      void closeActiveTab();
      break;
    case 'open-vault':
      void chooseVault();
      break;
    case 'close-vault':
      void closeVault();
      break;
    case 'quick-open':
      openPalette('notes');
      break;
    case 'search-vault':
      openSearch();
      break;
    case 'command-palette':
      openPalette('commands');
      break;
    case 'toggle-left':
      toggleLeftSidebar();
      break;
    case 'toggle-right':
      toggleRightSidebar();
      break;
    case 'cycle-mode':
      cycleTabMode();
      break;
    case 'open-settings':
      openSettings();
      break;
    case 'open-help':
      openHelp();
      break;
    case 'ai-panel':
      openAIPanel();
      break;
    case 'ai-continue':
      void runAI('continue');
      break;
    case 'ai-rewrite':
      void runAI('rewrite');
      break;
    case 'ai-summarize':
      void runAI('summarize');
      break;
    case 'ai-bullets':
      void runAI('bullets');
      break;
    case 'ai-table':
      void runAI('table');
      break;
    case 'ai-actions':
      void runAI('action-items');
      break;
    case 'focus-editor':
      editor()?.focus();
      break;
    case 'delete-note':
      if (getState().activePath) requestDelete(getState().activePath!);
      break;
    case 'reload-vault':
      void refreshVault();
      break;
    case 'devtools':
      break;
    default:
      break;
  }
}

export function providerLabel(id: AIProviderId): string {
  return PROVIDER_LABELS[id];
}
