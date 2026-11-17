import type { MenuCommand } from './types';

export interface CommandDefinition {
  id: MenuCommand;
  label: string;
  group: 'Notes' | 'Navigation' | 'AI' | 'View';
  defaultAccelerator: string;
}

/**
 * Every command that can be triggered from the keyboard, the command palette,
 * or the in-app menus. Accelerators are user-editable in Settings → Shortcuts.
 */
export const COMMANDS: CommandDefinition[] = [
  { id: 'quick-open', label: 'Quick switcher', group: 'Navigation', defaultAccelerator: 'Ctrl+O' },
  { id: 'command-palette', label: 'Command palette', group: 'Navigation', defaultAccelerator: 'Ctrl+P' },
  { id: 'search-vault', label: 'Search vault', group: 'Navigation', defaultAccelerator: 'Ctrl+Shift+F' },
  { id: 'graph-view', label: 'Graph view', group: 'Navigation', defaultAccelerator: 'Ctrl+G' },
  { id: 'focus-mode', label: 'Focus mode', group: 'View', defaultAccelerator: 'Ctrl+Alt+F' },
  { id: 'toggle-left', label: 'Toggle file explorer', group: 'View', defaultAccelerator: 'Ctrl+B' },
  { id: 'toggle-right', label: 'Toggle side panel', group: 'View', defaultAccelerator: 'Ctrl+Shift+B' },
  { id: 'cycle-mode', label: 'Cycle editor / split / preview', group: 'View', defaultAccelerator: 'Ctrl+E' },
  { id: 'new-note', label: 'New note', group: 'Notes', defaultAccelerator: 'Ctrl+N' },
  { id: 'new-folder', label: 'New folder', group: 'Notes', defaultAccelerator: 'Ctrl+Shift+N' },
  { id: 'new-meeting', label: 'New meeting note', group: 'Notes', defaultAccelerator: 'Ctrl+Shift+M' },
  { id: 'daily-note', label: 'Open today’s note', group: 'Notes', defaultAccelerator: 'Ctrl+D' },
  { id: 'templates', label: 'Insert template', group: 'Notes', defaultAccelerator: 'Ctrl+Shift+T' },
  { id: 'export-note', label: 'Export note', group: 'Notes', defaultAccelerator: 'Ctrl+Shift+E' },
  { id: 'save-note', label: 'Save note', group: 'Notes', defaultAccelerator: 'Ctrl+S' },
  { id: 'close-tab', label: 'Close tab', group: 'Notes', defaultAccelerator: 'Ctrl+W' },
  { id: 'delete-note', label: 'Delete note', group: 'Notes', defaultAccelerator: 'Ctrl+Shift+Backspace' },
  { id: 'open-settings', label: 'Settings', group: 'Navigation', defaultAccelerator: 'Ctrl+,' },
  { id: 'open-help', label: 'Instructions', group: 'Navigation', defaultAccelerator: 'F1' },
  { id: 'ai-panel', label: 'Writing assistant', group: 'AI', defaultAccelerator: 'Ctrl+K' },
  { id: 'ai-continue', label: 'AI: continue writing', group: 'AI', defaultAccelerator: 'Ctrl+Alt+C' },
  { id: 'ai-rewrite', label: 'AI: rewrite selection', group: 'AI', defaultAccelerator: 'Ctrl+Alt+R' },
  { id: 'ai-summarize', label: 'AI: summarize note', group: 'AI', defaultAccelerator: 'Ctrl+Alt+S' },
  { id: 'ai-bullets', label: 'AI: make bullets', group: 'AI', defaultAccelerator: 'Ctrl+Alt+B' },
  { id: 'ai-table', label: 'AI: make a table', group: 'AI', defaultAccelerator: 'Ctrl+Alt+T' },
  { id: 'ai-actions', label: 'AI: extract action items', group: 'AI', defaultAccelerator: 'Ctrl+Alt+A' },
];

export const DEFAULT_KEYBINDINGS: Record<string, string> = Object.fromEntries(
  COMMANDS.map((command) => [command.id, command.defaultAccelerator]),
);

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];

/** Normalises a user-entered accelerator such as `ctrl + shift + p`. */
export function normalizeAccelerator(input: string): string {
  const parts = input
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const modifiers = new Set<string>();
  let key = '';
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') modifiers.add('Ctrl');
    else if (lower === 'alt' || lower === 'option') modifiers.add('Alt');
    else if (lower === 'shift') modifiers.add('Shift');
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'win') modifiers.add('Meta');
    else key = normaliseKey(part);
  }
  if (!key) return '';
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

function normaliseKey(key: string): string {
  const map: Record<string, string> = {
    esc: 'Escape',
    escape: 'Escape',
    space: 'Space',
    spacebar: 'Space',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
    del: 'Delete',
    return: 'Enter',
    backspace: 'Backspace',
    tab: 'Tab',
    comma: ',',
    period: '.',
    slash: '/',
  };
  const lower = key.toLowerCase();
  if (map[lower]) return map[lower]!;
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Ensures a keybindings map is valid, unique and complete. */
export function sanitizeKeybindings(raw: unknown): Record<string, string> {
  const result: Record<string, string> = { ...DEFAULT_KEYBINDINGS };
  if (!raw || typeof raw !== 'object') return result;
  const used = new Set<string>();
  for (const command of COMMANDS) {
    const value = (raw as Record<string, unknown>)[command.id];
    if (typeof value !== 'string') continue;
    // An explicit empty string means the user unbound this command.
    if (!value.trim()) {
      result[command.id] = '';
      continue;
    }
    const normalized = normalizeAccelerator(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (used.has(key)) {
      result[command.id] = '';
      continue;
    }
    used.add(key);
    result[command.id] = normalized;
  }
  return result;
}

/** Accelerators that share a key with another command. */
export function findConflicts(keybindings: Record<string, string>): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const [command, accelerator] of Object.entries(keybindings)) {
    if (!accelerator) continue;
    const key = accelerator.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), command]);
  }
  return new Map([...grouped].filter(([, commands]) => commands.length > 1));
}
