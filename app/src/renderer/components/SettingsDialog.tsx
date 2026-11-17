import { useEffect, useMemo, useState } from 'react';
import type { AppInfo, EditorMode, ThemeMode } from '@shared/types';
import { COMMANDS, findConflicts } from '@shared/keybindings';
import { acceleratorFromEvent } from '@shared/accelerator';
import { DEFAULT_DAILY_TEMPLATE } from '@shared/templates';
import { useApp, type SettingsSection } from '../state/store';
import {
  closeSettings,
  openHelp,
  openTour,
  openVaultPicker,
  resetKeybindings,
  setKeybinding,
  setSettingsSection,
  updateSettings,
} from '../state/actions';
import { Modal } from './Modal';
import { AIProviderFields } from './AIProviderFields';
import { Icon } from './Icons';

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'editor', label: 'Writing' },
  { id: 'ai', label: 'AI' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'about', label: 'About' },
];

const MODES: Array<{ id: EditorMode; label: string }> = [
  { id: 'edit', label: 'Editor' },
  { id: 'split', label: 'Split' },
  { id: 'preview', label: 'Preview' },
];

function ShortcutEditor() {
  const keybindings = useApp((state) => state.settings.keybindings);
  const [capturing, setCapturing] = useState<string | null>(null);
  const conflicts = useMemo(() => findConflicts(keybindings), [keybindings]);
  const conflicting = useMemo(
    () => new Set([...conflicts.values()].flat()),
    [conflicts],
  );

  return (
    <div className="shortcut-editor">
      <p className="settings-text">
        Click a shortcut, then press the keys you want. Backspace clears it, Esc cancels. Shortcuts apply
        immediately.
      </p>
      {(['Notes', 'Navigation', 'View', 'AI'] as const).map((group) => (
        <div className="shortcut-edit-group" key={group}>
          <h4>{group}</h4>
          {COMMANDS.filter((command) => command.group === group).map((command) => {
            const accelerator = keybindings[command.id] ?? '';
            const isConflict = conflicting.has(command.id);
            return (
              <div className="shortcut-edit-row" key={command.id}>
                <span className="shortcut-edit-label">{command.label}</span>
                <button
                  type="button"
                  className={`shortcut-input${capturing === command.id ? ' is-capturing' : ''}${
                    isConflict ? ' is-conflict' : ''
                  }${!accelerator ? ' is-empty' : ''}`}
                  aria-label={`Shortcut for ${command.label}`}
                  onClick={() => setCapturing(command.id)}
                  onBlur={() => setCapturing((current) => (current === command.id ? null : current))}
                  onKeyDown={(event) => {
                    if (capturing !== command.id) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.key === 'Escape') {
                      setCapturing(null);
                      return;
                    }
                    if (event.key === 'Backspace' && !event.ctrlKey && !event.altKey) {
                      void setKeybinding(command.id, '');
                      setCapturing(null);
                      return;
                    }
                    const accelerator = acceleratorFromEvent(event);
                    if (!accelerator) return;
                    void setKeybinding(command.id, accelerator);
                    setCapturing(null);
                  }}
                >
                  {capturing === command.id ? 'Press keys…' : accelerator || 'Unassigned'}
                </button>
                {isConflict ? (
                  <span className="shortcut-conflict" title="This shortcut is used more than once">
                    <Icon name="warning" size={12} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
      <div className="settings-actions">
        <button type="button" className="button button-ghost button-small" onClick={() => void resetKeybindings()}>
          Restore defaults
        </button>
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const open = useApp((state) => state.settingsOpen);
  const section = useApp((state) => state.settingsSection);
  const settings = useApp((state) => state.settings);
  const vault = useApp((state) => state.vault);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [dailyTemplate, setDailyTemplate] = useState(settings.daily.template);

  useEffect(() => {
    if (open) void window.carbon.getAppInfo().then(setInfo);
  }, [open]);
  useEffect(() => {
    setDailyTemplate(settings.daily.template);
  }, [settings.daily.template]);

  if (!open) return null;

  const patch = (value: Parameters<typeof updateSettings>[0]) => void updateSettings(value);

  return (
    <Modal
      title="Settings"
      subtitle="Everything stays on this computer."
      onClose={closeSettings}
      size="large"
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`settings-nav-item${section === entry.id ? ' is-active' : ''}`}
              onClick={() => setSettingsSection(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {section === 'general' ? (
            <>
              <section className="settings-section">
                <h3>Appearance</h3>
                <div className="field">
                  <span className="field-label">Theme</span>
                  <div className="theme-grid">
                    {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`theme-card${settings.theme === mode ? ' is-selected' : ''}`}
                        aria-pressed={settings.theme === mode}
                        onClick={() => patch({ theme: mode })}
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
                </div>
              </section>

              <section className="settings-section">
                <h3>Vault</h3>
                <p className="settings-text">
                  {vault ? (
                    <>
                      <code>{vault.path}</code>
                    </>
                  ) : (
                    'No vault is open.'
                  )}
                </p>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => {
                      closeSettings();
                      void openVaultPicker();
                    }}
                  >
                    Open another vault…
                  </button>
                  {vault ? (
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => void window.carbon.showItemInFolder('')}
                    >
                      <Icon name="external" size={12} /> Show folder
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="settings-section">
                <h3>Safety</h3>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={settings.ui.confirmDelete}
                    onChange={(event) => patch({ ui: { ...settings.ui, confirmDelete: event.target.checked } })}
                  />
                  <span>Ask before deleting a note</span>
                </label>
                <p className="field-hint">Deleted notes go to the Windows Recycle Bin either way.</p>
              </section>

              <section className="settings-section">
                <h3>Help</h3>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => {
                      closeSettings();
                      openHelp();
                    }}
                  >
                    <Icon name="help" size={12} /> Instructions
                  </button>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() => {
                      closeSettings();
                      openTour();
                    }}
                  >
                    Replay the tour
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {section === 'editor' ? (
            <>
              <section className="settings-section">
                <h3>Typography</h3>
                <label className="field">
                  <span className="field-label">
                    Editor size <span className="field-value">{settings.editor.fontSize}px</span>
                  </span>
                  <input
                    type="range"
                    min={13}
                    max={24}
                    step={1}
                    value={settings.editor.fontSize}
                    aria-label="Editor font size"
                    onChange={(event) =>
                      patch({ editor: { ...settings.editor, fontSize: Number(event.target.value) } })
                    }
                  />
                </label>
                <div className="field">
                  <span className="field-label">Text width</span>
                  <div className="segmented" role="group" aria-label="Text width">
                    {(['narrow', 'wide', 'full'] as const).map((width) => (
                      <button
                        key={width}
                        type="button"
                        className={settings.editor.lineWidth === width ? 'is-selected' : ''}
                        aria-pressed={settings.editor.lineWidth === width}
                        onClick={() => patch({ editor: { ...settings.editor, lineWidth: width } })}
                      >
                        {width === 'narrow' ? 'Narrow' : width === 'wide' ? 'Wide' : 'Full'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Default view</span>
                  <div className="segmented" role="group" aria-label="Default editor mode">
                    {MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={settings.editor.defaultMode === mode.id ? 'is-selected' : ''}
                        aria-pressed={settings.editor.defaultMode === mode.id}
                        onClick={() => patch({ editor: { ...settings.editor, defaultMode: mode.id } })}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="settings-section">
                <h3>Behaviour</h3>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={settings.editor.showLineNumbers}
                    onChange={(event) =>
                      patch({ editor: { ...settings.editor, showLineNumbers: event.target.checked } })
                    }
                  />
                  <span>Show line numbers</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={settings.editor.spellcheck}
                    onChange={(event) => patch({ editor: { ...settings.editor, spellcheck: event.target.checked } })}
                  />
                  <span>Check spelling while writing</span>
                </label>
                <label className="field">
                  <span className="field-label">Auto-save</span>
                  <select
                    value={settings.editor.autoSaveMs}
                    onChange={(event) =>
                      patch({ editor: { ...settings.editor, autoSaveMs: Number(event.target.value) } })
                    }
                  >
                    <option value={500}>Half a second after typing stops</option>
                    <option value={900}>About a second after typing stops</option>
                    <option value={2000}>Two seconds after typing stops</option>
                    <option value={0}>Only with Ctrl+S</option>
                  </select>
                </label>
              </section>

              <section className="settings-section">
                <h3>Daily notes</h3>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Folder</span>
                    <input
                      type="text"
                      value={settings.daily.folder}
                      onChange={(event) =>
                        patch({ daily: { ...settings.daily, folder: event.target.value } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">File name format</span>
                    <input
                      type="text"
                      value={settings.daily.format}
                      onChange={(event) =>
                        patch({ daily: { ...settings.daily, format: event.target.value } })
                      }
                    />
                  </label>
                </div>
                <p className="field-hint">Tokens: YYYY, MM, DD, dddd. Opened with Ctrl+D.</p>
                <label className="field">
                  <span className="field-label">Daily template</span>
                  <textarea
                    rows={6}
                    value={dailyTemplate}
                    placeholder={DEFAULT_DAILY_TEMPLATE}
                    onChange={(event) => setDailyTemplate(event.target.value)}
                    onBlur={() => patch({ daily: { ...settings.daily, template: dailyTemplate } })}
                  />
                  <span className="field-hint">
                    Variables: <code>{'{{date}}'}</code>, <code>{'{{date:dddd D MMMM}}'}</code>,{' '}
                    <code>{'{{title}}'}</code>, <code>{'{{time}}'}</code>.
                  </span>
                </label>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => {
                    setDailyTemplate(DEFAULT_DAILY_TEMPLATE);
                    patch({ daily: { ...settings.daily, template: DEFAULT_DAILY_TEMPLATE } });
                  }}
                >
                  Use the default template
                </button>
              </section>

              <section className="settings-section">
                <h3>Templates</h3>
                <label className="field">
                  <span className="field-label">Templates folder</span>
                  <input
                    type="text"
                    value={settings.templatesFolder}
                    onChange={(event) => patch({ templatesFolder: event.target.value })}
                  />
                  <span className="field-hint">
                    Any note in this folder appears in the template picker (Ctrl+Shift+T).
                  </span>
                </label>
              </section>
            </>
          ) : null}

          {section === 'ai' ? (
            <>
              <section className="settings-section">
                <h3>AI features</h3>
                <label className="toggle-row toggle-emphasis">
                  <input
                    type="checkbox"
                    checked={settings.ai.enabled}
                    onChange={(event) => patch({ ai: { ...settings.ai, enabled: event.target.checked } })}
                  />
                  <span>Enable AI writing assistance</span>
                </label>
                <p className="field-hint">
                  Carbon is fully usable with AI off. When enabled, only the text you run an action on is sent to
                  the backend you choose.
                </p>
              </section>

              <section className="settings-section">
                <h3>Provider</h3>
                <AIProviderFields />
              </section>

              <section className="settings-section">
                <h3>Generation</h3>
                <label className="field">
                  <span className="field-label">
                    Temperature <span className="field-value">{settings.ai.temperature.toFixed(1)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.ai.temperature}
                    onChange={(event) => patch({ ai: { ...settings.ai, temperature: Number(event.target.value) } })}
                  />
                  <span className="field-hint">Lower is more literal; higher is more exploratory.</span>
                </label>
                <label className="field">
                  <span className="field-label">Max response length (tokens)</span>
                  <input
                    type="number"
                    min={64}
                    max={32000}
                    step={64}
                    value={settings.ai.maxTokens}
                    onChange={(event) =>
                      patch({ ai: { ...settings.ai, maxTokens: Number(event.target.value) || 1024 } })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Standing instructions</span>
                  <textarea
                    rows={3}
                    value={settings.ai.systemPrompt}
                    placeholder="Optional: “Write in British English. Never use em dashes.”"
                    onChange={(event) => patch({ ai: { ...settings.ai, systemPrompt: event.target.value } })}
                  />
                  <span className="field-hint">Sent with every request, before your note.</span>
                </label>
              </section>
            </>
          ) : null}

          {section === 'shortcuts' ? <ShortcutEditor /> : null}

          {section === 'about' ? (
            <>
              <section className="settings-section">
                <h3>Carbon</h3>
                <p className="settings-text">
                  Version {info?.version ?? '—'} · Electron {info?.electron ?? '—'} · Chromium {info?.chrome ?? '—'}
                </p>
                <p className="settings-text muted">
                  Local-first Markdown notes. Your writing stays as plain files in your vault.
                </p>
              </section>
              <section className="settings-section">
                <h3>Storage</h3>
                <p className="settings-text">
                  Settings: <code>{info?.settingsPath ?? '—'}</code>
                </p>
                <p className="settings-text muted">
                  API keys are encrypted with Windows secure storage and never written to this file.
                </p>
              </section>
              <section className="settings-section">
                <h3>Links</h3>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => void window.carbon.openExternal('https://github.com/heyitsyajat/carbon')}
                  >
                    <Icon name="github" size={12} /> GitHub
                  </button>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() =>
                      void window.carbon.openExternal('https://github.com/heyitsyajat/carbon/blob/main/LICENSE')
                    }
                  >
                    MIT License
                  </button>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() => void window.carbon.openExternal('https://github.com/heyitsyajat/carbon/issues')}
                  >
                    Report an issue
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
