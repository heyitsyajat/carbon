/**
 * A tiny bridge that lets palettes, the AI panel and menu commands talk to the
 * live CodeMirror instance without threading refs through every component.
 */

export interface EditorSelection {
  text: string;
  from: number;
  to: number;
  empty: boolean;
}

export interface EditorHandle {
  focus(): void;
  getSelection(): EditorSelection;
  insert(text: string): void;
  replaceSelection(text: string): void;
  insertAtLine(text: string, line: number): void;
  scrollToLine(line: number): void;
}

let current: EditorHandle | null = null;

export function registerEditor(handle: EditorHandle | null): void {
  current = handle;
}

export function editor(): EditorHandle | null {
  return current;
}

export function readSelection(): EditorSelection {
  return current?.getSelection() ?? { text: '', from: 0, to: 0, empty: true };
}
