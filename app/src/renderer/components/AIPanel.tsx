import { useState } from 'react';
import type { AIAction } from '@shared/types';
import { PROVIDER_LABELS } from '@shared/ai/provider';
import { useApp } from '../state/store';
import {
  applyAIResult,
  cancelAI,
  clearAIResult,
  openAIPanel,
  openSettings,
  runAI,
  setTranscript,
  toast,
} from '../state/actions';
import { Icon, type IconName } from './Icons';

const ACTIONS: Array<{ action: AIAction; label: string; icon: IconName }> = [
  { action: 'continue', label: 'Continue', icon: 'edit' },
  { action: 'rewrite', label: 'Rewrite', icon: 'pencil' },
  { action: 'summarize', label: 'Summarize', icon: 'outline' },
  { action: 'bullets', label: 'Bullets', icon: 'tag' },
  { action: 'table', label: 'Table', icon: 'columns' },
  { action: 'action-items', label: 'Actions', icon: 'check' },
];

export function AIPanel() {
  const ai = useApp((state) => state.ai);
  const enabled = useApp((state) => state.settings.ai.enabled);
  const provider = useApp((state) => state.settings.ai.provider);
  const hasNote = useApp((state) => Boolean(state.activePath));
  const selectedCount = useApp((state) => state.selected.filter((path) => path.endsWith('.md')).length);
  const [instruction, setInstruction] = useState('');
  const [question, setQuestion] = useState('');

  if (!enabled) {
    return (
      <div className="ai-off">
        <Icon name="assistant" size={22} />
        <h3 className="ai-off-title">AI is optional</h3>
        <p>
          Notes, search, links, export and the daily template all work without it. Add a provider when you want
          writing help.
        </p>
        <button type="button" className="button button-secondary button-small" onClick={() => openSettings('ai')}>
          <Icon name="settings" size={12} /> Add an AI provider in Settings
        </button>
        <p className="ai-off-note">Local model, any OpenAI-compatible endpoint, or your own API key.</p>
      </div>
    );
  }

  const copyResult = async () => {
    if (!ai.result) return;
    try {
      await navigator.clipboard.writeText(ai.result);
      toast('Copied to clipboard', 'success');
    } catch {
      toast('Could not access the clipboard', 'error');
    }
  };

  return (
    <div className="ai-panel">
      <button type="button" className="ai-provider" onClick={() => openSettings('ai')} title="Change AI provider">
        <span className="statusbar-pip is-on" aria-hidden="true" />
        <span className="ai-provider-name">{PROVIDER_LABELS[provider]}</span>
        <Icon name="settings" size={12} />
      </button>

      <div className="ai-action-grid">
        {ACTIONS.map((entry) => (
          <button
            key={entry.action}
            type="button"
            className={`ai-action${ai.action === entry.action ? ' is-active' : ''}`}
            onClick={() => {
              openAIPanel(entry.action);
              void runAI(entry.action);
            }}
            disabled={ai.streaming || !hasNote}
          >
            <Icon name={entry.icon} size={14} />
            <span>{entry.label}</span>
          </button>
        ))}
      </div>

      <p className="ai-hint">
        {ai.hasSelection && ai.selection
          ? `Using ${ai.selection.length.toLocaleString()} selected characters.`
          : selectedCount > 1
            ? `Using this note plus ${selectedCount - 1} selected note${selectedCount - 1 === 1 ? '' : 's'}.`
            : 'Uses the current note. Select text to target just that passage.'}
      </p>

      <form
        className="ai-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!instruction.trim()) return;
          openAIPanel('custom');
          void runAI('custom', instruction.trim());
        }}
      >
        <input
          type="text"
          value={instruction}
          placeholder="Custom instruction…"
          aria-label="Custom AI instruction"
          onChange={(event) => setInstruction(event.target.value)}
        />
        <button type="submit" className="icon-button" aria-label="Run instruction" disabled={ai.streaming || !instruction.trim()}>
          <Icon name="arrow-right" size={14} />
        </button>
      </form>

      <form
        className="ai-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!question.trim()) return;
          openAIPanel('chat');
          void runAI('chat', question.trim());
        }}
      >
        <input
          type="text"
          value={question}
          placeholder="Ask about this note…"
          aria-label="Ask about this note"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="icon-button" aria-label="Ask" disabled={ai.streaming || !question.trim()}>
          <Icon name="search" size={14} />
        </button>
      </form>

      <details className="ai-meeting">
        <summary>
          <Icon name="calendar" size={13} /> Meeting transcript
        </summary>
        <p className="ai-hint">Paste a transcript to get a summary and action items.</p>
        <textarea
          rows={5}
          value={ai.transcript}
          placeholder="Paste the transcript here…"
          aria-label="Meeting transcript"
          onChange={(event) => setTranscript(event.target.value)}
        />
        <button
          type="button"
          className="button button-secondary button-small"
          disabled={ai.streaming || ai.transcript.trim().length < 20}
          onClick={() => void runAI('meeting')}
        >
          Summarize transcript
        </button>
      </details>

      {ai.error ? (
        <div className="ai-error" role="alert">
          <div className="ai-error-head">
            <Icon name="warning" size={13} />
            <span>Assistant unavailable</span>
          </div>
          <p>{ai.error.message}</p>
          {ai.error.detail ? <pre>{ai.error.detail}</pre> : null}
          <button type="button" className="button button-secondary button-small" onClick={() => openSettings('ai')}>
            Open AI settings
          </button>
        </div>
      ) : null}

      {ai.result || ai.streaming ? (
        <div className="ai-result">
          <div className="ai-result-head">
            <span>{ai.label ?? 'Result'}</span>
            {ai.streaming ? (
              <button type="button" className="button button-ghost button-small" onClick={() => void cancelAI()}>
                <Icon name="stop" size={11} /> Stop
              </button>
            ) : (
              <button type="button" className="icon-button" onClick={clearAIResult} aria-label="Clear result">
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
          <pre className="ai-output">{ai.result}</pre>
          {ai.streaming ? <div className="ai-streaming">Generating…</div> : null}
          {!ai.streaming && ai.result ? (
            <div className="ai-result-actions">
              <button type="button" className="button button-primary button-small" onClick={() => applyAIResult('insert')}>
                <Icon name="insert" size={12} /> Insert
              </button>
              {ai.selection ? (
                <button type="button" className="button button-secondary button-small" onClick={() => applyAIResult('replace')}>
                  Replace
                </button>
              ) : null}
              <button type="button" className="button button-secondary button-small" onClick={() => applyAIResult('append')}>
                Append
              </button>
              <button type="button" className="button button-ghost button-small" onClick={() => void copyResult()}>
                <Icon name="copy" size={12} /> Copy
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ai-empty">
          <p>Run an action above, or ask about the open note.</p>
          <p className="muted">With a local model, nothing leaves this computer.</p>
        </div>
      )}
    </div>
  );
}
