import { useState } from 'react';
import { useApp } from '../state/store';
import { completeTour } from '../state/actions';
import { Icon, LogoMark } from './Icons';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Your notes are files',
    body: 'A vault is just a folder on disk. Every note is a .md file you can open, sync or back up with anything else.',
  },
  {
    title: 'Connect what you write',
    body: 'Link notes with [[double brackets]]. Backlinks, unlinked mentions and the graph view show how ideas fit together.',
  },
  {
    title: 'Find anything in two keys',
    body: 'Ctrl+O jumps to a note by name, Ctrl+Shift+F searches the text inside every note, and Ctrl+P lists every command.',
  },
  {
    title: 'AI is optional',
    body: 'Carbon works without any AI. When you want writing help, add a local model, an OpenAI-compatible endpoint, or your own API key in Settings → AI.',
  },
  {
    title: 'Make it yours',
    body: 'Daily notes, templates, focus mode and export live in the File and View menus. All shortcuts can be remapped in Settings → Shortcuts.',
  },
];

/** First-run tour. Shown once, dismissible, replayable from Help. */
export function Tour() {
  const open = useApp((state) => state.tourOpen);
  const [step, setStep] = useState(0);

  if (!open) return null;
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label="Carbon tour">
      <div className="tour-card">
        <div className="tour-head">
          <span className="tour-mark">
            <LogoMark size={22} />
          </span>
          <span className="tour-count">
            {step + 1} / {STEPS.length}
          </span>
          <button type="button" className="icon-button" onClick={() => void completeTour()} aria-label="Dismiss tour">
            <Icon name="close" size={13} />
          </button>
        </div>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="tour-footer">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((entry, index) => (
              <span key={entry.title} className={index === step ? 'is-active' : ''} />
            ))}
          </div>
          <div className="tour-actions">
            <button type="button" className="button button-ghost button-small" onClick={() => void completeTour()}>
              Skip
            </button>
            {step > 0 ? (
              <button type="button" className="button button-ghost button-small" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="button button-primary button-small"
              onClick={() => (last ? void completeTour() : setStep(step + 1))}
            >
              {last ? 'Start writing' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
