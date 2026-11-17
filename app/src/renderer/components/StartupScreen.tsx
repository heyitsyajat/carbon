import { useEffect, useState } from 'react';
import type { AppInfo } from '@shared/types';
import { useApp } from '../state/store';
import { openHelp, openSettings, openVault, openVaultPicker, startWizard } from '../state/actions';
import { formatRelativeTime } from '../lib/format';
import { Icon, LogoMark } from './Icons';

export function StartupScreen() {
  const settings = useApp((state) => state.settings);
  const busy = useApp((state) => state.busy);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    void window.carbon.getAppInfo().then(setInfo);
  }, []);

  const lastVault = settings.vaults[0] ?? null;
  const recent = settings.vaults.slice(0, showAll ? 8 : 3);

  return (
    <div className="startup">
      <section className="startup-intro">
        <div className="startup-brandline">
          <LogoMark size={30} />
          <span>Carbon</span>
          <span className="startup-version">v{info?.version ?? '1.0.0'}</span>
        </div>

        <h1>
          Notes that stay
          <br />
          on your machine.
        </h1>
        <p className="startup-lede">
          Markdown files in a folder you choose, with links, search, templates and an optional AI assistant.
        </p>

        <dl className="startup-facts">
          <div>
            <dt>Storage</dt>
            <dd>Plain .md files. No database, no account.</dd>
          </div>
          <div>
            <dt>Offline</dt>
            <dd>Writing, links, graph, export and import all work without a network.</dd>
          </div>
          <div>
            <dt>AI</dt>
            <dd>Optional. Ollama locally, any OpenAI-compatible endpoint, or your own key.</dd>
          </div>
        </dl>

        <div className="startup-footer-links">
          <button type="button" className="link-button" onClick={openHelp}>
            Instructions
          </button>
          <button type="button" className="link-button" onClick={() => openSettings()}>
            Settings
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => void window.carbon.openExternal('https://github.com/heyitsyajat/carbon')}
          >
            GitHub
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => void window.carbon.openExternal('https://github.com/heyitsyajat/carbon/blob/main/LICENSE')}
          >
            MIT License
          </button>
        </div>
      </section>

      <section className="startup-side">
        <div className="startup-start">
          <h2>Start</h2>
          <button type="button" className="button button-primary button-block" onClick={startWizard} disabled={busy}>
            <Icon name="plus" size={15} /> Create a vault
          </button>
          <button
            type="button"
            className="button button-secondary button-block"
            onClick={() => void openVaultPicker()}
            disabled={busy}
          >
            <Icon name="folder-open" size={15} /> Open a folder
          </button>
          {lastVault ? (
            <button
              type="button"
              className="startup-continue"
              disabled={busy}
              onClick={() => void openVault(lastVault.path)}
            >
              <span className="startup-continue-label">Continue</span>
              <span className="startup-continue-name">{lastVault.name}</span>
              <Icon name="arrow-right" size={13} />
            </button>
          ) : (
            <p className="startup-hint">Your last vault appears here for one-click access.</p>
          )}
        </div>

        {recent.length > 0 ? (
          <div className="startup-recent">
            <div className="startup-recent-head">
              <h3>Recent</h3>
              {settings.vaults.length > 3 ? (
                <button type="button" className="link-button" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? 'Less' : 'All'}
                </button>
              ) : null}
            </div>
            <ul>
              {recent.map((vault) => (
                <li key={vault.path}>
                  <button
                    type="button"
                    className="recent-vault"
                    onClick={() => void openVault(vault.path)}
                    title={vault.path}
                  >
                    <span className="recent-vault-text">
                      <strong>{vault.name}</strong>
                      <span>{vault.path}</span>
                    </span>
                    <span className="recent-vault-time">{formatRelativeTime(vault.lastOpenedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
