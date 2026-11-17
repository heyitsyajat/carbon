import { activeTab, isDirty, useApp } from '../state/store';
import { activateTab, closeTab, createNote, setTabMode } from '../state/actions';
import { Icon } from './Icons';

const MODE_LABEL = { edit: 'Editor', split: 'Split', preview: 'Preview' } as const;
const MODE_ICON = { edit: 'edit', split: 'columns', preview: 'eye' } as const;

export function TabBar() {
  const tabs = useApp((state) => state.tabs);
  const activePath = useApp((state) => state.activePath);
  const active = useApp(activeTab);
  const mode = active?.mode ?? 'split';

  return (
    <div className="tabbar">
      <div className="tab-list" role="tablist" aria-label="Open notes">
        {tabs.map((tab) => {
          const dirty = isDirty(tab);
          const isActive = tab.path === activePath;
          return (
            <div
              key={tab.path}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`tab${isActive ? ' is-active' : ''}`}
              title={tab.path}
              onClick={() => activateTab(tab.path)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activateTab(tab.path);
                }
              }}
            >
              <span className="tab-title">{tab.title}</span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void closeTab(tab.path);
                }}
              >
                {dirty ? <span className="dirty-dot" aria-label="Unsaved changes" /> : <Icon name="close" size={12} />}
              </button>
            </div>
          );
        })}
        <button type="button" className="tab-new" aria-label="New note" onClick={() => createNote()} data-tooltip="New note">
          <Icon name="plus" size={14} />
        </button>
      </div>

      {active ? (
        <div className="tabbar-actions">
          <div className="segmented segmented-small" role="group" aria-label="Editor mode">
            {(['edit', 'split', 'preview'] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                className={mode === entry ? 'is-selected' : ''}
                onClick={() => setTabMode(active.path, entry)}
                aria-pressed={mode === entry}
                data-tooltip={`${MODE_LABEL[entry]} (Ctrl+E)`}
                aria-label={MODE_LABEL[entry]}
              >
                <Icon name={MODE_ICON[entry]} size={13} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
