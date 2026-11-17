import { normalizeAccelerator } from './keybindings';

/** The parts of a keyboard event this module needs (works in renderer and main). */
export interface KeyboardLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface ParsedAccelerator {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

/** Parses a normalized accelerator string into its parts. */
export function parseAccelerator(accelerator: string): ParsedAccelerator | null {
  const normalized = normalizeAccelerator(accelerator);
  if (!normalized) return null;
  const parts = normalized.split('+');
  const key = parts.pop();
  if (!key) return null;
  return {
    ctrl: parts.includes('Ctrl'),
    alt: parts.includes('Alt'),
    shift: parts.includes('Shift'),
    meta: parts.includes('Meta'),
    key,
  };
}

function eventKey(event: Pick<KeyboardLike, 'key'>): string {
  const { key } = event;
  if (key === ' ' || key === 'Spacebar') return 'Space';
  if (key === 'Esc') return 'Escape';
  if (key === 'Backspace' || key === 'Delete' || key === 'Enter' || key === 'Tab' || key === 'Escape') return key;
  if (key.startsWith('Arrow')) return key;
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** True when a keyboard event matches an accelerator like `Ctrl+Shift+F`. */
export function matchesAccelerator(event: KeyboardLike, accelerator: string): boolean {
  const parsed = parseAccelerator(accelerator);
  if (!parsed) return false;
  if (event.ctrlKey !== parsed.ctrl) return false;
  if (event.altKey !== parsed.alt) return false;
  if (event.shiftKey !== parsed.shift) return false;
  if (event.metaKey !== parsed.meta) return false;
  return eventKey(event) === parsed.key;
}

/** Finds the command bound to an event, if any. */
export function commandForEvent(
  event: KeyboardLike,
  keybindings: Record<string, string>,
): string | null {
  for (const [command, accelerator] of Object.entries(keybindings)) {
    if (accelerator && matchesAccelerator(event, accelerator)) return command;
  }
  return null;
}

/** Builds an accelerator string from a keydown event, for the editor UI. */
export function acceleratorFromEvent(event: KeyboardLike): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  let key = event.key;
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    Esc: 'Escape',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
  };
  key = keyMap[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  parts.push(key);
  return parts.join('+');
}

/** Human readable accelerator for menus (`Ctrl+Shift+F` -> `Ctrl Shift F`). */
export function displayAccelerator(accelerator: string): string[] {
  const normalized = normalizeAccelerator(accelerator);
  return normalized ? normalized.split('+').map((part) => (part === 'Ctrl' ? 'Ctrl' : part)) : [];
}
