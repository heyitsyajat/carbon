import { useEffect, useRef, useState } from 'react';
import type { MenuCommand } from '@shared/types';
import { activeTab, useApp } from '../state/store';
import { runMenuCommand } from '../state/actions';
import { Icon } from './Icons';

interface MenuEntry {
  label: string;
  command?: MenuCommand;
  shortcutFor?: string;
  separator?: boolean;
}

interface MenuDefinition {
  label: string;
  items: MenuEntry[];
}

const MENUS: MenuDefinition[] = [
  {
    label: 'File',
    items: [
      { label: 'New note', command: 'new-note', shortcutFor: 'new-note' },
      { label: 'New folder', command: 'new-folder', shortcutFor: 'new-folder' },
      { label: 'New meeting note', command: 'new-meeting', shortcutFor: 'new-meeting' },
      { label: 'Today’s note', command: 'daily-note', shortcutFor: 'daily-note' },
      { label: 'Insert template…', command: 'templates', shortcutFor: 'templates' },
      { label: '', separator: true },
      { label: 'Save', command: 'save-note', shortcutFor: 'save-note' },
      { label: 'Close tab', command: 'close-tab', shortcutFor: 'close-tab' },
      { label: '', separator: true },
      { label: 'Export note…', command: 'export-note', shortcutFor: 'export-note' },
      { label: 'Import Markdown folder…', command: 'import-vault' },
      { label: '', separator: true },
      { label: 'Settings…', command: 'open-settings', shortcutFor: 'open-settings' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Quick switcher', command: 'quick-open', shortcutFor: 'quick-open' },
      { label: 'Search vault', command: 'search-vault', shortcutFor: 'search-vault' },
      { label: 'Command palette', command: 'command-palette', shortcutFor: 'command-palette' },
      { label: '', separator: true },
      { label: 'Delete note', command: 'delete-note' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle file explorer', command: 'toggle-left', shortcutFor: 'toggle-left' },
      { label: 'Toggle side panel', command: 'toggle-right', shortcutFor: 'toggle-right' },
      { label: 'Cycle editor / split / preview', command: 'cycle-mode', shortcutFor: 'cycle-mode' },
      { label: 'Focus mode', command: 'focus-mode', shortcutFor: 'focus-mode' },
      { label: 'Graph view', command: 'graph-view', shortcutFor: 'graph-view' },
    ],
  },
  {
    label: 'AI',
    items: [
      { label: 'Writing assistant', command: 'ai-panel', shortcutFor: 'ai-panel' },
      { label: '', separator: true },
      { label: 'Continue writing', command: 'ai-continue', shortcutFor: 'ai-continue' },
      { label: 'Rewrite selection', command: 'ai-rewrite', shortcutFor: 'ai-rewrite' },
      { label: 'Summarize note', command: 'ai-summarize', shortcutFor: 'ai-summarize' },
      { label: 'Make bullets', command: 'ai-bullets', shortcutFor: 'ai-bullets' },
      { label: 'Make table', command: 'ai-table', shortcutFor: 'ai-table' },
      { label: 'Extract action items', command: 'ai-actions', shortcutFor: 'ai-actions' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Instructions & shortcuts', command: 'open-help', shortcutFor: 'open-help' },
      { label: 'Replay the tour', command: 'play-tour' },
      { label: 'Settings', command: 'open-settings' },
    ],
  },
];

/** In-app menu bar; shortcuts come from the user's keybindings. */
export function TitleBar() {
  const vault = useApp((state) => state.vault);
  const tab = useApp(activeTab);
  const keybindings = useApp((state) => state.settings.keybindings);
  const busy = useApp((state) => state.busy);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  const run = (command?: MenuCommand) => {
    setOpenMenu(null);
    if (command) runMenuCommand(command);
  };

  return (
    <header className="titlebar" ref={containerRef}>
      <div className="titlebar-menus" role="menubar" aria-label="Application menu">
        {MENUS.map((menu) => (
          <div className="titlebar-menu" key={menu.label}>
            <button
              type="button"
              className={`titlebar-menu-button${openMenu === menu.label ? ' is-open' : ''}`}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openMenu === menu.label}
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label ? (
              <div className="menu-popover" role="menu" aria-label={menu.label}>
                {menu.items.map((item, index) =>
                  item.separator ? (
                    <div className="menu-separator" role="separator" key={`sep-${index}`} />
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      key={item.label}
                      onClick={() => run(item.command)}
                    >
                      <span>{item.label}</span>
                      {item.shortcutFor && keybindings[item.shortcutFor] ? (
                        <span className="menu-shortcut">{keybindings[item.shortcutFor]}</span>
                      ) : null}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="titlebar-title">
        {busy ? <span className="titlebar-busy" aria-label="Working" /> : null}
        {tab ? (
          <>
            <span className="titlebar-note">{tab.title}</span>
            {vault ? <span className="titlebar-vault">{vault.name}</span> : null}
          </>
        ) : (
          <span className="titlebar-note">{vault?.name ?? 'Carbon'}</span>
        )}
      </div>

      <div className="titlebar-spacer" aria-hidden="true">
        <Icon name="logo" size={15} className="titlebar-mark" />
      </div>
    </header>
  );
}
