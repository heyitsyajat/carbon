import { useEffect, useMemo, useRef } from 'react';
import { useApp, vaultFolders, vaultTags } from '../state/store';
import {
  closeSearch,
  revealSearchHit,
  setSearchFolder,
  setSearchQuery,
  setSearchTag,
} from '../state/actions';
import { Icon } from './Icons';

/** Full-text search across the vault, with tag and folder filters. */
export function SearchOverlay() {
  const search = useApp((state) => state.search);
  const notes = useApp((state) => state.notes);
  const inputRef = useRef<HTMLInputElement>(null);
  const tags = useMemo(() => vaultTags(notes).slice(0, 14), [notes]);
  const folders = useMemo(() => vaultFolders(notes), [notes]);

  useEffect(() => {
    if (!search.open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearch();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [search.open]);

  if (!search.open) return null;

  const grouped = new Map<string, typeof search.results>();
  for (const hit of search.results) {
    grouped.set(hit.path, [...(grouped.get(hit.path) ?? []), hit]);
  }

  return (
    <div
      className="search-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSearch();
      }}
    >
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search vault">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            type="search"
            value={search.query}
            placeholder="Search every note in this vault…"
            aria-label="Search query"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && search.results[0]) {
                void revealSearchHit(search.results[0].path, search.results[0].line);
              }
            }}
          />
          {search.loading ? <span className="search-spinner" aria-label="Searching" /> : null}
          <kbd>Esc</kbd>
        </div>

        <div className="search-filters">
          <label className="search-field">
            <Icon name="tag" size={12} />
            <select
              value={search.tag ?? ''}
              onChange={(event) => setSearchTag(event.target.value || null)}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {tags.map(({ tag, count }) => (
                <option key={tag} value={tag}>
                  #{tag} ({count})
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <Icon name="folder" size={12} />
            <select
              value={search.folder ?? ''}
              onChange={(event) => setSearchFolder(event.target.value || null)}
              aria-label="Filter by folder"
            >
              <option value="">All folders</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>
          {search.tag || search.folder ? (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSearchTag(null);
                setSearchFolder(null);
              }}
            >
              Clear filters
            </button>
          ) : null}
          <span className="search-count">
            {search.results.length} {search.results.length === 1 ? 'hit' : 'hits'}
          </span>
        </div>

        <div className="search-results" aria-live="polite">
          {search.error ? <p className="search-message is-error">{search.error}</p> : null}
          {!search.error && !search.loading && search.results.length === 0 ? (
            <p className="search-message">
              {search.query.trim() || search.tag || search.folder
                ? 'No notes match. Try a shorter word, or clear the filters.'
                : 'Type to search. Filters work on their own too.'}
            </p>
          ) : null}
          {[...grouped.entries()].map(([path, hits]) => (
            <div className="search-group" key={path}>
              <div className="search-group-head">
                <Icon name="note" size={12} />
                <span>{path.replace(/\.md$/i, '')}</span>
              </div>
              {(hits ?? []).map((hit, hitIndex) => (
                <button
                  key={`${hit.path}-${hit.line}-${hitIndex}`}
                  type="button"
                  className="search-hit"
                  onClick={() => void revealSearchHit(hit.path, hit.line)}
                >
                  {hit.line > 0 ? <span className="search-hit-line">L{hit.line}</span> : null}
                  <span className={`search-hit-snippet${hit.line > 0 ? '' : ' is-title'}`}>
                    {hit.snippet || 'Matched by filter'}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
