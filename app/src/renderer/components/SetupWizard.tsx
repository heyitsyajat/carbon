import { useState } from 'react';
import type { ThemeMode } from '@shared/types';
import { useApp } from '../state/store';
import { finishWizard, setWizard, updateSettings } from '../state/actions';
import { AIProviderFields } from './AIProviderFields';
import { Icon, LogoMark } from './Icons';

const STEPS = ['Vault', 'AI (optional)', 'Appearance'];

export function SetupWizard() {
  const wizard = useApp((state) => state.wizard);
  const settings = useApp((state) => state.settings);
  const busy = useApp((state) => state.busy);
  const [name, setName] = useState(wizard.vaultName);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = wizard.step;
  const choice = wizard.aiChoice ?? 'skip';

  const createVault = async () => {
    setPicking(true);
    setError(null);
    try {
      const created = await window.carbon.vault.create(name || 'Carbon Vault', null);
      if (created) setWizard({ vaultPath: created.path, vaultName: created.name });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPicking(false);
    }
  };

  const pickExistingFolder = async () => {
    setPicking(true);
    setError(null);
    try {
      const chosen = await window.carbon.vault.choose();
      if (chosen) setWizard({ vaultPath: chosen.path, vaultName: chosen.name });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPicking(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setWizard({ step: step + 1 });
    else void finishWizard();
  };

  return (
    <div className="wizard">
      <aside className="wizard-rail">
        <div className="wizard-brand">
          <LogoMark size={30} />
          <span>Carbon</span>
        </div>
        <ol className="wizard-steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`wizard-step${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`}
            >
              <span className="wizard-step-index">
                {index < step ? <Icon name="check" size={11} /> : index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <p className="wizard-note">
          No account, no telemetry. Notes stay in the folder you pick, as plain Markdown files.
        </p>
      </aside>

      <section className="wizard-main">
        {step === 0 ? (
          <div className="wizard-panel">
            <header>
              <h1>Where should your notes live?</h1>
              <p>
                A vault is a folder of <code>.md</code> files. Create one, or point Carbon at a folder you already
                write in.
              </p>
            </header>

            <label className="field">
              <span className="field-label">New vault name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Carbon Vault"
              />
            </label>

            <div className="wizard-actions-row">
              <button
                type="button"
                className="button button-primary"
                onClick={() => void createVault()}
                disabled={picking}
              >
                <Icon name="plus" size={14} /> Create folder…
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void pickExistingFolder()}
                disabled={picking}
              >
                <Icon name="folder-open" size={14} /> Use an existing folder…
              </button>
            </div>

            {wizard.vaultPath ? (
              <div className="callout callout-success">
                <Icon name="check" size={13} />
                <span>
                  Vault ready: <code>{wizard.vaultPath}</code>
                </span>
              </div>
            ) : null}
            {error ? (
              <div className="callout callout-error" role="alert">
                <Icon name="warning" size={13} />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-panel">
            <header>
              <h1>Writing help is optional</h1>
              <p>
                Carbon works fully without AI — notes, links, search, templates, graph and export are all local.
                Add a provider now, or at any time later from Settings.
              </p>
            </header>

            <div className="ai-choice" role="radiogroup" aria-label="AI setup">
              <button
                type="button"
                role="radio"
                aria-checked={choice === 'skip'}
                className={`ai-choice-option${choice === 'skip' ? ' is-selected' : ''}`}
                onClick={() => setWizard({ aiChoice: 'skip' })}
              >
                <span className="ai-choice-head">
                  <strong>Continue without AI</strong>
                  <span className="ai-choice-badge">Recommended</span>
                </span>
                <span className="ai-choice-body">
                  Everything except the writing assistant. Assistant buttons will show a short note about adding a
                  provider, never an error.
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={choice === 'configure'}
                className={`ai-choice-option${choice === 'configure' ? ' is-selected' : ''}`}
                onClick={() => setWizard({ aiChoice: 'configure' })}
              >
                <span className="ai-choice-head">
                  <strong>Set up AI provider</strong>
                </span>
                <span className="ai-choice-body">
                  Choose a local model, an OpenAI-compatible endpoint, or your own API key. You can turn it off
                  again in Settings → AI.
                </span>
              </button>
            </div>

            {choice === 'configure' ? (
              <div className="wizard-provider">
                <AIProviderFields />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-panel">
            <header>
              <h1>Pick an appearance</h1>
              <p>“Match Windows” follows your system setting and can be changed later in Settings.</p>
            </header>
            <div className="theme-grid theme-grid-large">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`theme-card${settings.theme === mode ? ' is-selected' : ''}`}
                  aria-pressed={settings.theme === mode}
                  onClick={() => void updateSettings({ theme: mode })}
                >
                  <span className={`theme-swatch theme-${mode}`} aria-hidden="true">
                    <span />
                    <span />
                  </span>
                  <span className="theme-label">
                    {mode === 'system' ? 'Match Windows' : mode === 'light' ? 'Light' : 'Dark'}
                  </span>
                </button>
              ))}
            </div>
            <p className="wizard-finish-note">
              {choice === 'configure'
                ? 'AI will be enabled — test the connection in Settings → AI after setup.'
                : 'AI stays off. You can add a provider later; nothing else changes.'}
            </p>
          </div>
        ) : null}

        <footer className="wizard-footer">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setWizard({ step: Math.max(0, step - 1) })}
            disabled={step === 0}
          >
            <Icon name="arrow-left" size={13} /> Back
          </button>
          <div className="wizard-footer-right">
            <span className="wizard-step-count">
              Step {step + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              className="button button-primary"
              onClick={next}
              disabled={busy || picking || (step === 0 && !wizard.vaultPath)}
            >
              {step === STEPS.length - 1 ? 'Finish setup' : 'Continue'} <Icon name="arrow-right" size={13} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
