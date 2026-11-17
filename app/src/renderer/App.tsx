import { useEffect, useRef, useState } from 'react';
import type { MenuCommand } from '@shared/types';
import { commandForEvent } from '@shared/accelerator';
import { activeTab, getState, useApp } from './state/store';
import {
  attachAIListeners,
  bootstrap,
  createNote,
  openNote,
  openPalette,
  runMenuCommand,
  saveActive,
  scheduleRefresh,
  toggleFocusMode,
  updateSettings,
} from './state/actions';
import { TitleBar } from './components/TitleBar';
import { Ribbon } from './components/Ribbon';
import { FileExplorer } from './components/FileExplorer';
import { TabBar } from './components/TabBar';
import { EditorPane } from './components/EditorPane';
import { RightPanel } from './components/RightPanel';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { SearchOverlay } from './components/SearchOverlay';
import { GraphView } from './components/GraphView';
import { Tour } from './components/Tour';
import { ExportDialog } from './components/ExportDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { HelpDialog } from './components/HelpDialog';
import { StartupScreen } from './components/StartupScreen';
import { SetupWizard } from './components/SetupWizard';
import { ConfirmOverlay, PromptOverlay, Toasts } from './components/Overlays';
import { Icon, LogoMark } from './components/Icons';

function EmptyWorkspace() {
  const notes = useApp((state) => state.notes);
  return (
    <div className="empty-workspace">
      <LogoMark size={40} />
      <h2>No note open</h2>
      <p className="muted">Pick a note from the file list, or start something new.</p>
      <div className="empty-actions">
        <button type="button" className="button button-primary" onClick={() => createNote()}>
          <Icon name="plus" size={14} /> New note
        </button>
        <button type="button" className="button button-secondary" onClick={() => openPalette('notes')}>
          <Icon name="search" size={14} /> Quick open
        </button>
      </div>
      {notes.length > 0 ? (
        <ul className="empty-recent">
          {notes.slice(0, 6).map((note) => (
            <li key={note.path}>
              <button type="button" className="empty-recent-item" onClick={() => void openNote(note.path)}>
                <Icon name="note" size={13} /> {note.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ResizeHandle({
  side,
  onStart,
  onDrag,
  onCommit,
}: {
  side: 'left' | 'right';
  onStart: () => void;
  onDrag: (deltaX: number) => void;
  onCommit: () => void;
}) {
  const startX = useRef(0);

  return (
    <div
      className={`resize-handle resize-${side}`}
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(event) => {
        event.preventDefault();
        startX.current = event.clientX;
        onStart();
        const onMove = (moveEvent: MouseEvent) => onDrag(moveEvent.clientX - startX.current);
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.classList.remove('is-resizing');
          onCommit();
        };
        document.body.classList.add('is-resizing');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }}
    />
  );
}

function Workspace() {
  const tab = useApp(activeTab);
  const explorerOpen = useApp((state) => state.explorerOpen);
  const rightOpen = useApp((state) => state.settings.ui.rightSidebarOpen);
  const focusMode = useApp((state) => state.focusMode);
  const settings = useApp((state) => state.settings);
  const [leftWidth, setLeftWidth] = useState(settings.ui.leftSidebarWidth);
  const [rightWidth, setRightWidth] = useState(settings.ui.rightSidebarWidth);
  const leftStart = useRef(leftWidth);
  const rightStart = useRef(rightWidth);

  useEffect(() => setLeftWidth(settings.ui.leftSidebarWidth), [settings.ui.leftSidebarWidth]);
  useEffect(() => setRightWidth(settings.ui.rightSidebarWidth), [settings.ui.rightSidebarWidth]);

  const commitWidths = () => {
    if (leftWidth === settings.ui.leftSidebarWidth && rightWidth === settings.ui.rightSidebarWidth) return;
    void updateSettings({
      ui: { ...settings.ui, leftSidebarWidth: leftWidth, rightSidebarWidth: rightWidth },
    });
  };

  return (
    <div className={`workspace${focusMode ? ' is-focus' : ''}`}>
      {!focusMode ? <Ribbon /> : null}
      <div className="workspace-body">
        {explorerOpen && !focusMode ? (
          <>
            <div className="sidebar sidebar-left" style={{ width: leftWidth }}>
              <FileExplorer />
            </div>
            <ResizeHandle
              side="left"
              onStart={() => {
                leftStart.current = leftWidth;
              }}
              onDrag={(delta) => setLeftWidth(Math.min(420, Math.max(196, leftStart.current + delta)))}
              onCommit={commitWidths}
            />
          </>
        ) : null}

        <main className="editor-area">
          {!focusMode ? <TabBar /> : null}
          {tab ? <EditorPane key={tab.path} tab={tab} /> : <EmptyWorkspace />}
        </main>

        {rightOpen && !focusMode ? (
          <>
            <ResizeHandle
              side="right"
              onStart={() => {
                rightStart.current = rightWidth;
              }}
              onDrag={(delta) => setRightWidth(Math.min(460, Math.max(252, rightStart.current - delta)))}
              onCommit={commitWidths}
            />
            <div className="sidebar sidebar-right" style={{ width: rightWidth }}>
              <RightPanel />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const OVERLAY_KEYS: Array<keyof ReturnType<typeof getState>> = [
  'settingsOpen',
  'helpOpen',
  'exportOpen',
  'graphOpen',
  'prompt',
  'confirm',
];

export function App() {
  const ready = useApp((state) => state.ready);
  const screen = useApp((state) => state.screen);
  const theme = useApp((state) => state.theme);
  const fontSize = useApp((state) => state.settings.editor.fontSize);
  const lineWidth = useApp((state) => state.settings.editor.lineWidth);
  const keybindings = useApp((state) => state.settings.keybindings);
  const keybindingsRef = useRef(keybindings);

  useEffect(() => {
    keybindingsRef.current = keybindings;
  }, [keybindings]);

  useEffect(() => {
    attachAIListeners();
    void bootstrap();

    const offMenu = window.carbon.menu.onCommand((command) => runMenuCommand(command));
    const offVault = window.carbon.vault.onChanged(() => scheduleRefresh());

    const onKeyDown = (event: KeyboardEvent) => {
      const state = getState();
      const modalOpen =
        Boolean(state.palette.open || state.search.open || state.tourOpen) ||
        OVERLAY_KEYS.some((key) => Boolean(state[key]));

      if (event.key === 'Escape') {
        if (modalOpen) return;
        if (state.focusMode) {
          event.preventDefault();
          toggleFocusMode();
        }
        return;
      }
      if (event.key === 'F1') {
        event.preventDefault();
        runMenuCommand('open-help');
        return;
      }
      if (state.prompt || state.confirm) return;

      const command = commandForEvent(event, keybindingsRef.current);
      if (!command) return;
      if (command === 'save-note' && modalOpen) return;

      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      const modified = event.ctrlKey || event.altKey || event.metaKey;
      if (typing && !modified) return;

      event.preventDefault();
      event.stopPropagation();
      runMenuCommand(command as MenuCommand);
    };

    const flush = () => {
      if (document.visibilityState !== 'visible') void saveActive();
    };
    const onBlur = () => void saveActive();

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('blur', onBlur);

    return () => {
      offMenu();
      offVault();
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
    document.documentElement.dataset.lineWidth = lineWidth;
  }, [fontSize, lineWidth]);

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        {!ready ? (
          <div className="boot">
            <LogoMark size={36} />
            <span>Opening Carbon…</span>
          </div>
        ) : screen === 'workspace' ? (
          <Workspace />
        ) : screen === 'wizard' ? (
          <SetupWizard />
        ) : (
          <StartupScreen />
        )}
      </div>
      {ready && screen === 'workspace' ? <StatusBar /> : null}

      <CommandPalette />
      <SearchOverlay />
      <GraphView />
      <Tour />
      <ExportDialog />
      <SettingsDialog />
      <HelpDialog />
      <PromptOverlay />
      <ConfirmOverlay />
      <Toasts />
    </div>
  );
}
