import { useEffect, useMemo, useState } from 'react';
import { extractOutline, extractTags } from '@shared/markdown';
import { activeTab, setState, useApp, vaultTags } from '../state/store';
import { openGraph, openNote, openSearch } from '../state/actions';
import { editor } from '../lib/editor-bridge';
import { AIPanel } from './AIPanel';
import { Icon } from './Icons';

type PanelTab = 'assistant' | 'outline' | 'links' | 'tags';

const TABS: Array<{ id: PanelTab; label: string; icon: 'assistant' | 'outline' | 'link' | 'tag' }> = [
  { id: 'assistant', label: 'Assistant', icon: 'assistant' },
  { id: 'outline', label: 'Outline', icon: 'outline' },
  { id: 'links', label: 'Links', icon: 'link' },
  { id: 'tags', label: 'Tags', icon: 'tag' },
];

export function RightPanel() {
  const [tab, setTab] = useState<PanelTab>('outline');
  const active = useApp(activeTab);
  const notes = useApp((state) => state.notes);
  const links = useApp((state) => state.links);
  const aiOpen = useApp((state) => state.ai.open);

  // Opening the assistant (ribbon, shortcut, menu) reveals its tab.
  useEffect(() => {
    if (aiOpen) setTab('assistant');
  }, [aiOpen]);

  const outline = useMemo(() => (active ? extractOutline(active.content) : []), [active]);
  const noteTags = useMemo(() => (active ? extractTags(active.content) : []), [active]);
  const tags = useMemo(() => vaultTags(notes), [notes]);
  const path = active?.path ?? '';
  const backlinks = links.backlinks[path] ?? [];
  const outgoing = links.outgoing[path] ?? [];
  const mentions = (links.mentions[path] ?? []).filter((source) => !backlinks.includes(source));

  const titleOf = (notePath: string) => notePath.replace(/\.md$/i, '');

  return (
    <aside className="right-panel" aria-label="Side panel">
      <div className="right-tabs" role="tablist" aria-label="Side panel sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`right-tab${tab === entry.id ? ' is-active' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            <Icon name={entry.icon} size={14} />
            <span>{entry.label}</span>
          </button>
        ))}
      </div>

      <div className="right-body">
        {tab === 'assistant' ? <AIPanel /> : null}

        {tab === 'outline' ? (
          <section className="panel-section">
            {outline.length > 0 ? (
              <ul className="outline-list">
                {outline.map((item, index) => (
                  <li key={`${item.line}-${index}`} style={{ paddingLeft: (item.level - 1) * 11 }}>
                    <button
                      type="button"
                      className="outline-item"
                      onClick={() => editor()?.scrollToLine(item.line + 1)}
                      title={item.text}
                    >
                      {item.text || 'Untitled heading'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-empty">Headings in this note appear here. Add one with <code>#</code>.</p>
            )}
            <button type="button" className="panel-link" onClick={openGraph}>
              <Icon name="graph" size={13} /> Open graph view
            </button>
          </section>
        ) : null}

        {tab === 'links' ? (
          <>
            <section className="panel-section">
              <h3 className="panel-heading">Backlinks</h3>
              {backlinks.length > 0 ? (
                <ul className="link-list">
                  {backlinks.map((notePath) => (
                    <li key={notePath}>
                      <button type="button" className="link-item" onClick={() => void openNote(notePath)}>
                        <Icon name="link" size={12} />
                        <span>{titleOf(notePath)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-empty">No note links here yet.</p>
              )}
            </section>

            <section className="panel-section">
              <h3 className="panel-heading">Links from this note</h3>
              {outgoing.length > 0 ? (
                <ul className="link-list">
                  {outgoing.map((notePath) => (
                    <li key={notePath}>
                      <button type="button" className="link-item" onClick={() => void openNote(notePath)}>
                        <Icon name="arrow-right" size={12} />
                        <span>{titleOf(notePath)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-empty">This note does not link anywhere yet.</p>
              )}
            </section>

            <section className="panel-section">
              <h3 className="panel-heading">Unlinked mentions</h3>
              {mentions.length > 0 ? (
                <ul className="link-list">
                  {mentions.map((notePath) => (
                    <li key={notePath}>
                      <button type="button" className="link-item is-muted" onClick={() => void openNote(notePath)}>
                        <Icon name="search" size={12} />
                        <span>{titleOf(notePath)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-empty">No unlinked mentions of this title.</p>
              )}
            </section>

            {links.unresolved.length > 0 ? (
              <section className="panel-section">
                <h3 className="panel-heading">Unresolved links</h3>
                <ul className="link-list">
                  {links.unresolved.slice(0, 10).map((target) => (
                    <li key={target}>
                      <button
                        type="button"
                        className="link-item is-missing"
                        onClick={() =>
                          setState({ prompt: { kind: 'new-note', title: `Create “${target}”`, value: `${target}.md` } })
                        }
                      >
                        <Icon name="plus" size={12} />
                        <span>{target}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {tab === 'tags' ? (
          <>
            <section className="panel-section">
              <h3 className="panel-heading">All tags</h3>
              {tags.length > 0 ? (
                <ul className="tag-index">
                  {tags.map(({ tag, count }) => (
                    <li key={tag}>
                      <button type="button" className="tag-index-item" onClick={() => openSearch({ tag })}>
                        <span className="tag-index-name">#{tag}</span>
                        <span className="tag-index-count">{count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-empty">No tags yet. Add <code>#topic</code> to a note.</p>
              )}
            </section>
            {noteTags.length > 0 ? (
              <section className="panel-section">
                <h3 className="panel-heading">In this note</h3>
                <div className="tag-list">
                  {noteTags.map((tag) => (
                    <button key={tag} type="button" className="tag-pill" onClick={() => openSearch({ tag })}>
                      #{tag}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            {active ? (
              <section className="panel-section">
                <p className="panel-meta">{path}</p>
                <button
                  type="button"
                  className="panel-link"
                  onClick={() => void window.carbon.showItemInFolder(path)}
                >
                  <Icon name="external" size={12} /> Show file in Explorer
                </button>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
