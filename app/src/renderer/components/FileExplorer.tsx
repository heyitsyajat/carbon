import { useMemo, useRef, useState } from 'react';
import type { FileNode } from '@shared/types';
import { setState, useApp } from '../state/store';
import {
  createFolder,
  createNote,
  openNote,
  openSearch,
  refreshVault,
  requestDelete,
  requestRename,
  selectNote,
  toggleFolder,
} from '../state/actions';
import { matchesFilter } from '../lib/format';
import { Icon } from './Icons';

interface RowProps {
  node: FileNode;
  depth: number;
  collapsed: Record<string, boolean>;
  activePath: string | null;
  selected: string[];
  onContext: (node: FileNode, event: React.MouseEvent) => void;
}

function TreeRow({ node, depth, collapsed, activePath, selected, onContext }: RowProps) {
  const isFolder = node.type === 'folder';
  const isCollapsed = Boolean(collapsed[node.path]);
  const isActive = node.path === activePath;
  const isSelected = selected.includes(node.path);
  const children = node.children ?? [];

  if (isFolder) {
    return (
      <div className="tree-branch">
        <button
          type="button"
          className="tree-row tree-folder"
          style={{ paddingLeft: 8 + depth * 13 }}
          onClick={() => toggleFolder(node.path)}
          onContextMenu={(event) => onContext(node, event)}
          aria-expanded={!isCollapsed}
        >
          <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={12} className="tree-chevron" />
          <span className="tree-label">{node.name}</span>
          <span className="tree-count">{children.length || ''}</span>
        </button>
        {!isCollapsed
          ? children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                activePath={activePath}
                selected={selected}
                onContext={onContext}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`tree-row tree-file${isActive ? ' is-active' : ''}${isSelected && !isActive ? ' is-selected' : ''}`}
      style={{ paddingLeft: 8 + depth * 13 + 18 }}
      title={node.path}
      onClick={(event) => {
        selectNote(node.path, event.ctrlKey || event.metaKey);
        void openNote(node.path);
      }}
      onContextMenu={(event) => onContext(node, event)}
      onDoubleClick={() => requestRename(node.path)}
    >
      <span className="tree-dot" aria-hidden="true" />
      <span className="tree-label">{node.name.replace(/\.md$/i, '')}</span>
    </button>
  );
}

export function FileExplorer() {
  const vault = useApp((state) => state.vault);
  const tree = useApp((state) => state.tree);
  const notes = useApp((state) => state.notes);
  const collapsed = useApp((state) => state.collapsed);
  const activePath = useApp((state) => state.activePath);
  const selected = useApp((state) => state.selected);
  const filter = useApp((state) => state.explorerFilter);
  const [context, setContext] = useState<{ node: FileNode; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  const filteredNotes = useMemo(
    () => (filter ? notes.filter((note) => matchesFilter(note.path, filter)) : notes),
    [notes, filter],
  );

  if (!vault) return null;

  const openContext = (node: FileNode, event: React.MouseEvent) => {
    event.preventDefault();
    setContext({ node, x: event.clientX, y: event.clientY });
  };
  const closeContext = () => setContext(null);

  return (
    <aside className="explorer" aria-label="File explorer">
      <div className="explorer-header">
        <button type="button" className="explorer-vault" onClick={() => void window.carbon.showItemInFolder('')} title={vault.path}>
          <span className="explorer-vault-name">{vault.name}</span>
          <span className="explorer-vault-count">{notes.length}</span>
        </button>
        <div className="explorer-actions">
          <button type="button" className="icon-button" onClick={() => createNote()} aria-label="New note" data-tooltip="New note">
            <Icon name="plus" size={14} />
          </button>
          <button type="button" className="icon-button" onClick={createFolder} aria-label="New folder" data-tooltip="New folder">
            <Icon name="folder" size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void refreshVault()}
            aria-label="Reload vault"
            data-tooltip="Reload vault"
          >
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      <div className="explorer-filter">
        <Icon name="search" size={13} />
        <input
          type="search"
          value={filter}
          placeholder="Filter files"
          aria-label="Filter files"
          onChange={(event) => setState({ explorerFilter: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              openSearch({ query: filter });
              setState({ explorerFilter: '' });
            }
            if (event.key === 'Escape') {
              setState({ explorerFilter: '' });
              event.currentTarget.blur();
            }
          }}
        />
        {filter ? (
          <button type="button" className="icon-button" onClick={() => setState({ explorerFilter: '' })} aria-label="Clear filter">
            <Icon name="close" size={11} />
          </button>
        ) : null}
      </div>

      <div className="explorer-tree" role="tree" aria-label="Vault files">
        {filter ? (
          filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <button
                key={note.path}
                type="button"
                className={`tree-row tree-file${note.path === activePath ? ' is-active' : ''}`}
                style={{ paddingLeft: 12 }}
                onClick={() => void openNote(note.path)}
                title={note.path}
              >
                <span className="tree-dot" aria-hidden="true" />
                <span className="tree-label">{note.path.replace(/\.md$/i, '')}</span>
              </button>
            ))
          ) : (
            <p className="explorer-empty">No files match “{filter}”. Press Enter to search contents.</p>
          )
        ) : tree && (tree.children?.length ?? 0) > 0 ? (
          tree.children?.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={0}
              collapsed={collapsed}
              activePath={activePath}
              selected={selected}
              onContext={openContext}
            />
          ))
        ) : (
          <div className="explorer-empty">
            <p>This vault is empty.</p>
            <button type="button" className="text-button" onClick={() => createNote()}>
              Create the first note
            </button>
          </div>
        )}
      </div>

      {context ? (
        <>
          <div
            className="context-backdrop"
            role="presentation"
            onMouseDown={closeContext}
            onContextMenu={(event) => event.preventDefault()}
          />
          <div
            className="context-menu"
            ref={contextRef}
            role="menu"
            style={{
              left: Math.min(context.x, window.innerWidth - 190),
              top: Math.min(context.y, window.innerHeight - 170),
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                closeContext();
                requestRename(context.node.path);
              }}
            >
              <Icon name="pencil" size={13} /> Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                closeContext();
                void window.carbon.showItemInFolder(context.node.path);
              }}
            >
              <Icon name="external" size={13} /> Show in Explorer
            </button>
            <div className="menu-separator" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="menu-item is-danger"
              onClick={() => {
                closeContext();
                requestDelete(context.node.path);
              }}
            >
              <Icon name="trash" size={13} /> Delete
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
