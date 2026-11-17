import { countWords, readingMinutes } from '@shared/markdown';
import { activeTab, isDirty, useApp } from '../state/store';

export function StatusBar() {
  const vault = useApp((state) => state.vault);
  const notes = useApp((state) => state.notes);
  const tab = useApp(activeTab);
  const status = useApp((state) => state.status);
  const aiEnabled = useApp((state) => state.settings.ai.enabled);
  const provider = useApp((state) => state.settings.ai.provider);
  const busy = useApp((state) => state.busy || state.ai.streaming);

  const words = tab ? countWords(tab.content) : 0;
  const dirty = tab ? isDirty(tab) : false;

  return (
    <footer className="statusbar" aria-live="polite">
      <div className="statusbar-group">
        <span className="statusbar-item">{vault ? vault.name : 'No vault'}</span>
        <span className="statusbar-divider" aria-hidden="true" />
        <span className="statusbar-item">{notes.length} notes</span>
      </div>

      <div className="statusbar-center">
        {busy ? <span className="statusbar-spinner" aria-hidden="true" /> : null}
        <span>{status}</span>
      </div>

      <div className="statusbar-group">
        {tab ? (
          <>
            <span className="statusbar-item">
              {words.toLocaleString()} words · {readingMinutes(tab.content)} min
            </span>
            <span className="statusbar-divider" aria-hidden="true" />
            <span className={`statusbar-item statusbar-save${dirty ? ' is-dirty' : ''}`}>
              {dirty ? 'Saving…' : <><span className="statusbar-tick" aria-hidden="true" /> Saved</>}
            </span>
            <span className="statusbar-divider" aria-hidden="true" />
          </>
        ) : null}
        <span className="statusbar-item statusbar-ai" title={aiEnabled ? 'AI provider' : 'AI is off'}>
          <span className={`statusbar-pip${aiEnabled ? ' is-on' : ''}`} aria-hidden="true" />
          {aiEnabled ? provider : 'AI off'}
        </span>
      </div>
    </footer>
  );
}
