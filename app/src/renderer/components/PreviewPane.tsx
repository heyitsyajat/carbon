import { useMemo, type MouseEvent } from 'react';
import { setState, useApp } from '../state/store';
import { openNote, openSearch } from '../state/actions';
import { renderNote } from '../lib/preview';
import { Icon } from './Icons';

/** Live Markdown preview with in-app wiki-link and tag navigation. */
export function PreviewPane({ content }: { content: string }) {
  const notes = useApp((state) => state.notes);

  const rendered = useMemo(() => {
    const notePaths = new Set(notes.map((note) => note.path.toLowerCase()));
    const noteTitles = new Map(notes.map((note) => [note.path, note.title]));
    return renderNote(content, { notePaths, noteTitles });
  }, [content, notes]);

  const resolveTarget = (target: string): string | null => {
    const clean = target.split('#')[0]?.trim().toLowerCase() ?? '';
    const direct = notes.find(
      (note) =>
        note.path.toLowerCase() === `${clean}.md` ||
        note.path.toLowerCase() === clean ||
        note.title.toLowerCase() === clean,
    );
    if (direct) return direct.path;
    const byName = notes.find(
      (note) =>
        note.path.toLowerCase().endsWith(`/${clean}.md`) ||
        note.title.toLowerCase() === clean.split('/').pop(),
    );
    return byName?.path ?? null;
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest<HTMLElement>('.wiki-link, .tag-chip');
    if (!anchor) return;
    event.preventDefault();
    if (anchor.classList.contains('wiki-link')) {
      const target = anchor.dataset.target ?? '';
      const path = resolveTarget(target);
      if (path) void openNote(path);
      else setState({ prompt: { kind: 'new-note', title: `Create “${target}”`, value: `${target}.md` } });
      return;
    }
    const tag = anchor.dataset.tag ?? '';
    if (tag) openSearch({ tag });
  };

  if (!content.trim()) {
    return (
      <div className="preview">
        <div className="preview-empty">
          <Icon name="edit" size={18} />
          <p>Nothing written yet.</p>
          <p className="muted">Start typing — the preview follows along.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview" onClick={onClick}>
      <article className="preview-content markdown" dangerouslySetInnerHTML={{ __html: rendered.html }} />
    </div>
  );
}
