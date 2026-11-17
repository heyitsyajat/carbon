import { Menu, app, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '../shared/ipc';
import type { MenuCommand } from '../shared/types';

const GITHUB_URL = 'https://github.com/heyitsyajat/carbon';

/**
 * Native menu supplying the standard edit/zoom roles and a Windows-visible
 * menu structure. Application shortcuts are handled in the renderer so they
 * can be remapped by the user; this menu intentionally registers none of them.
 */
export function installMenu(getWindow: () => BrowserWindow | null): void {
  const send = (command: MenuCommand) => () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(IPC.menuCommand, command);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New note', click: send('new-note') },
        { label: 'New folder', click: send('new-folder') },
        { label: 'New meeting note', click: send('new-meeting') },
        { label: 'Open today’s note', click: send('daily-note') },
        { label: 'Insert template…', click: send('templates') },
        { type: 'separator' },
        { label: 'Quick switcher…', click: send('quick-open') },
        { label: 'Search vault…', click: send('search-vault') },
        { label: 'Graph view', click: send('graph-view') },
        { type: 'separator' },
        { label: 'Export note…', click: send('export-note') },
        { label: 'Import Markdown folder…', click: send('import-vault') },
        { type: 'separator' },
        { label: 'Save', click: send('save-note') },
        { label: 'Close tab', click: send('close-tab') },
        { label: 'Settings…', click: send('open-settings') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Delete note', click: send('delete-note') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Command palette…', click: send('command-palette') },
        { label: 'Toggle file explorer', click: send('toggle-left') },
        { label: 'Toggle side panel', click: send('toggle-right') },
        { label: 'Cycle editor / split / preview', click: send('cycle-mode') },
        { label: 'Focus mode', click: send('focus-mode') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Toggle developer tools', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'AI',
      submenu: [
        { label: 'Writing assistant', click: send('ai-panel') },
        { type: 'separator' },
        { label: 'Continue writing', click: send('ai-continue') },
        { label: 'Rewrite selection', click: send('ai-rewrite') },
        { label: 'Summarize note', click: send('ai-summarize') },
        { label: 'Make bullets', click: send('ai-bullets') },
        { label: 'Make table', click: send('ai-table') },
        { label: 'Extract action items', click: send('ai-actions') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Instructions & shortcuts', click: send('open-help') },
        { label: 'Replay the tour', click: send('play-tour') },
        { type: 'separator' },
        { label: 'Carbon on GitHub', click: () => void shell.openExternal(GITHUB_URL) },
        { label: 'Report an issue', click: () => void shell.openExternal(`${GITHUB_URL}/issues`) },
        { type: 'separator' },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
