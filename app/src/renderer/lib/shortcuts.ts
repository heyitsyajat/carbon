export interface ShortcutGroup {
  title: string;
  items: Array<{ keys: string; action: string }>;
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Essentials',
    items: [
      { keys: 'Ctrl+P', action: 'Command palette' },
      { keys: 'Ctrl+Shift+P', action: 'Command palette (commands only)' },
      { keys: 'Ctrl+O', action: 'Quick open a note' },
      { keys: 'Ctrl+S', action: 'Save the current note' },
      { keys: 'Ctrl+N', action: 'New note' },
      { keys: 'Ctrl+Shift+N', action: 'New folder' },
      { keys: 'Ctrl+W', action: 'Close the current tab' },
      { keys: 'Ctrl+,', action: 'Open settings' },
      { keys: 'F1', action: 'Instructions and shortcuts' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: 'Ctrl+B', action: 'Show or hide the file explorer' },
      { keys: 'Ctrl+Shift+B', action: 'Show or hide the side panel' },
      { keys: 'Ctrl+E', action: 'Cycle editor / split / preview' },
      { keys: 'Ctrl+Shift+O', action: 'Open another vault' },
      { keys: 'F5', action: 'Reload the vault from disk' },
      { keys: 'Ctrl+F', action: 'Find inside the current note' },
      { keys: 'Ctrl+Shift+F', action: 'Search the whole vault' },
    ],
  },
  {
    title: 'Writing with AI',
    items: [
      { keys: 'Ctrl+K', action: 'Open the writing assistant' },
      { keys: 'Ctrl+Alt+C', action: 'Continue writing' },
      { keys: 'Ctrl+Alt+R', action: 'Rewrite the selection' },
      { keys: 'Ctrl+Alt+S', action: 'Summarize the note' },
      { keys: 'Ctrl+Alt+B', action: 'Turn text into bullets' },
      { keys: 'Ctrl+Alt+T', action: 'Turn text into a table' },
      { keys: 'Ctrl+Alt+A', action: 'Extract action items' },
    ],
  },
];
