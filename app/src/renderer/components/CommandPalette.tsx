import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuCommand } from '@shared/types';
import { COMMANDS } from '@shared/keybindings';
import { fuzzyRank } from '@shared/fuzzy';
import { useApp } from '../state/store';
import {
  closePalette,
  createTemplate,
  insertTemplate,
  openNote,
  openSearch,
  runMenuCommand,
  templateNotes,
} from '../state/actions';
import { Icon, type IconName } from './Icons';

interface Entry {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon: IconName;
  group: string;
  run: () => void;
}

export function CommandPalette() {
  const palette = useApp((state) => state.palette);
  const notes = useApp((state) => state.notes);
  const keybindings = useApp((state) => state.settings.keybindings);
  const vault = useApp((state) => state.vault);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(palette.query);
    setIndex(0);
  }, [palette.open, palette.query]);

  useEffect(() => {
    if (!palette.open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [palette.open]);

  const menu = (command: MenuCommand) => () => {
    closePalette();
    runMenuCommand(command);
  };

  const commands: Entry[] = useMemo(
    () =>
      COMMANDS.filter((command) => command.id !== 'command-palette').map((command) => ({
        id: command.id,
        label: command.label,
        icon: iconFor(command.group),
        group: 'Commands',
        shortcut: keybindings[command.id],
        run: menu(command.id),
      })),
    [keybindings],
  );

  const tagQuery = query.startsWith('tag:') ? query.slice(4).trim().toLowerCase() : null;

  const noteEntries: Entry[] = useMemo(() => {
    if (palette.mode !== 'notes') return [];
    const filtered = tagQuery !== null ? notes.filter((note) => note.tags.some((tag) => tag.includes(tagQuery))) : notes;
    const ranked =
      tagQuery !== null || !query.trim()
        ? filtered.slice(0, 60).map((note) => ({ item: note, score: 0, indices: [] }))
        : fuzzyRank(filtered, query, (note) => [note.title, note.path, ...note.tags], 60);
    return ranked.map(({ item: note }) => ({
      id: `note:${note.path}`,
      label: note.title,
      hint: note.path,
      icon: 'note' as IconName,
      group: 'Notes',
      run: () => {
        closePalette();
        void openNote(note.path);
      },
    }));
  }, [notes, query, tagQuery, palette.mode]);

  const templateEntries: Entry[] = useMemo(() => {
    if (palette.mode !== 'templates') return [];
    const templates = templateNotes().map((template) => ({
      id: `template:${template.path}`,
      label: template.title,
      hint: 'Insert into the open note',
      icon: 'template' as IconName,
      group: 'Templates',
      run: () => {
        closePalette();
        void insertTemplate(template.path);
      },
    }));
    return [
      ...templates,
      {
        id: 'template:new',
        label: 'New template…',
        hint: 'Saved in your templates folder',
        icon: 'plus' as IconName,
        group: 'Templates',
        run: () => {
          closePalette();
          createTemplate();
        },
      },
    ];
  }, [palette.mode]);

  const results = useMemo(() => {
    if (palette.mode === 'notes') return noteEntries;
    if (palette.mode === 'templates') {
      if (!query.trim()) return templateEntries;
      return fuzzyRank(templateEntries, query, (entry) => [entry.label], 20).map((result) => result.item);
    }
    if (!query.trim()) return commands;
    return fuzzyRank(commands, query, (entry) => [entry.label], 40).map((result) => result.item);
  }, [commands, noteEntries, templateEntries, palette.mode, query]);

  useEffect(() => {
    setIndex(0);
  }, [query, palette.mode]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!palette.open) return null;

  const placeholder =
    palette.mode === 'notes'
      ? 'Jump to a note…'
      : palette.mode === 'templates'
        ? 'Insert a template…'
        : 'Type a command…';

  let running = 0;

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <div className={`palette palette-${palette.mode}`} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <Icon name={palette.mode === 'commands' ? 'command' : 'search'} size={16} />
          <input
            ref={inputRef}
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setIndex((current) => Math.min(results.length - 1, current + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((current) => Math.max(0, current - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                results[index]?.run();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                closePalette();
              } else if (event.key === 'Tab' && palette.mode === 'notes') {
                event.preventDefault();
                closePalette();
                openSearch({ query });
              }
            }}
          />
          <kbd className="palette-esc">Esc</kbd>
        </div>

        <div className="palette-list" ref={listRef} role="listbox" aria-label="Results">
          {results.length === 0 ? (
            <p className="palette-empty">
              {palette.mode === 'notes' ? 'No notes match. Try Tab to search inside notes.' : 'Nothing matches that.'}
            </p>
          ) : null}
          {results.map((entry) => {
            const entryIndex = running++;
            return (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={entryIndex === index}
                data-index={entryIndex}
                className={`palette-item${entryIndex === index ? ' is-active' : ''}`}
                onMouseMove={() => setIndex(entryIndex)}
                onClick={entry.run}
              >
                <Icon name={entry.icon} size={14} />
                <span className="palette-label">{entry.label}</span>
                {entry.hint ? <span className="palette-hint">{entry.hint}</span> : null}
                {entry.shortcut ? <kbd>{entry.shortcut}</kbd> : null}
              </button>
            );
          })}
        </div>

        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> select
          </span>
          {palette.mode === 'notes' ? (
            <span>
              <kbd>Tab</kbd> full-text search
            </span>
          ) : null}
          {vault ? <span className="palette-vault">{vault.name}</span> : null}
        </div>
      </div>
    </div>
  );
}

function iconFor(group: string): IconName {
  switch (group) {
    case 'Notes':
      return 'note';
    case 'AI':
      return 'assistant';
    case 'View':
      return 'eye';
    default:
      return 'arrow-right';
  }
}
