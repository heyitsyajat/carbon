import { useEffect, useRef } from 'react';
import { isDirty, useApp, type Tab } from '../state/store';
import {
  openExport,
  saveTab,
  setStatus,
  toggleFocusMode,
  updateNoteContent,
} from '../state/actions';
import { createEditor, type EditorController } from '../lib/editor';
import { registerEditor } from '../lib/editor-bridge';
import { PreviewPane } from './PreviewPane';
import { Icon } from './Icons';

export function EditorPane({ tab }: { tab: Tab }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EditorController | null>(null);

  const theme = useApp((state) => state.theme);
  const fontSize = useApp((state) => state.settings.editor.fontSize);
  const showLineNumbers = useApp((state) => state.settings.editor.showLineNumbers);
  const spellcheck = useApp((state) => state.settings.editor.spellcheck);
  const focusMode = useApp((state) => state.focusMode);

  useEffect(() => {
    if (!hostRef.current) return;
    const controller = createEditor({
      parent: hostRef.current,
      doc: tab.content,
      dark: theme === 'dark',
      fontSize,
      showLineNumbers,
      onChange: (doc) => updateNoteContent(tab.path, doc),
      onSelectionChange: () => undefined,
      onSave: () => {
        void saveTab(tab.path);
        setStatus('Saved');
      },
    });
    controllerRef.current = controller;
    registerEditor(controller);
    return () => {
      registerEditor(null);
      controller.destroy();
      controllerRef.current = null;
    };
    // The parent keys this component by note path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.path]);

  useEffect(() => {
    controllerRef.current?.setTheme(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    controllerRef.current?.setFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    controllerRef.current?.setLineNumbers(showLineNumbers);
  }, [showLineNumbers]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (controller.view.state.doc.toString() !== tab.content) {
      controller.setDoc(tab.content);
    }
  }, [tab.content]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelector<HTMLElement>('.cm-content')?.setAttribute('spellcheck', String(spellcheck));
  }, [spellcheck]);

  const dirty = isDirty(tab);
  const breadcrumb = tab.path.split('/').slice(0, -1).join(' / ');

  return (
    <div className={`editor-pane mode-${tab.mode}`}>
      <div className="editor-column">
        {!focusMode ? (
          <div className="editor-header">
            <span className="editor-path">
              {breadcrumb ? <span className="editor-crumb">{breadcrumb} / </span> : null}
              <span className="editor-file">{tab.title}.md</span>
            </span>
            <span className="editor-header-actions">
              <span className={`editor-state${dirty ? ' is-dirty' : ''}`}>{dirty ? 'Saving…' : 'Saved'}</span>
              <button
                type="button"
                className="icon-button icon-button-small"
                onClick={() => void window.carbon.showItemInFolder(tab.path)}
                aria-label="Show file in Explorer"
                data-tooltip="Show in Explorer"
              >
                <Icon name="external" size={13} />
              </button>
              <button
                type="button"
                className="icon-button icon-button-small"
                onClick={openExport}
                aria-label="Export note"
                data-tooltip="Export (Ctrl+Shift+E)"
              >
                <Icon name="download" size={13} />
              </button>
              <button
                type="button"
                className="icon-button icon-button-small"
                onClick={toggleFocusMode}
                aria-label="Focus mode"
                data-tooltip="Focus mode (Ctrl+Alt+F)"
              >
                <Icon name="focus" size={13} />
              </button>
            </span>
          </div>
        ) : null}
        <div className="editor-host" ref={hostRef} />
        {focusMode ? (
          <button type="button" className="focus-exit" onClick={toggleFocusMode} aria-label="Leave focus mode">
            Esc — leave focus
          </button>
        ) : null}
      </div>
      {tab.mode !== 'edit' ? (
        <div className="preview-column">
          <PreviewPane content={tab.content} />
        </div>
      ) : null}
    </div>
  );
}
