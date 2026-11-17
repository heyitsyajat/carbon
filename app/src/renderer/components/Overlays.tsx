import { useEffect, useState } from 'react';
import { setState, useApp } from '../state/store';
import { submitPrompt } from '../state/actions';
import { Modal } from './Modal';

/** Small text-input dialog used for new notes, new folders and renames. */
export function PromptOverlay() {
  const prompt = useApp((state) => state.prompt);
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(prompt?.value ?? '');
  }, [prompt]);

  if (!prompt) return null;

  return (
    <Modal
      title={prompt.title}
      onClose={() => setState({ prompt: null })}
      size="small"
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={() => setState({ prompt: null })}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void submitPrompt(value)}
            disabled={!value.trim()}
          >
            {prompt.kind === 'rename' ? 'Rename' : 'Create'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitPrompt(value);
        }}
      >
        <label className="field">
          <span className="field-label">{prompt.kind === 'new-folder' ? 'Folder name' : 'File name'}</span>
          <input
            data-autofocus
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => {
              const dot = event.target.value.lastIndexOf('.');
              if (dot > 0) event.target.setSelectionRange(0, dot);
              else event.target.select();
            }}
          />
          <span className="field-hint">
            {prompt.kind === 'rename'
              ? 'Links to the old name are not rewritten automatically.'
              : 'Notes are saved as Markdown (.md).'}
          </span>
        </label>
      </form>
    </Modal>
  );
}

export function ConfirmOverlay() {
  const confirm = useApp((state) => state.confirm);
  if (!confirm) return null;
  return (
    <Modal
      title={confirm.title}
      onClose={() => setState({ confirm: null })}
      size="small"
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={() => setState({ confirm: null })}>
            Cancel
          </button>
          <button type="button" className="button button-danger" onClick={confirm.onConfirm}>
            {confirm.confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{confirm.message}</p>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useApp((state) => state.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
