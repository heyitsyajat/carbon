import { useApp } from '../state/store';
import { closeHelp, openSettings, openTour } from '../state/actions';
import { COMMANDS } from '@shared/keybindings';
import { Modal } from './Modal';
import { Icon } from './Icons';

const GROUPS = ['Notes', 'Navigation', 'View', 'AI'] as const;

export function HelpDialog() {
  const open = useApp((state) => state.helpOpen);
  const keybindings = useApp((state) => state.settings.keybindings);
  const aiEnabled = useApp((state) => state.settings.ai.enabled);
  if (!open) return null;

  return (
    <Modal
      title="Instructions"
      subtitle="Short notes on how Carbon works. Nothing here needs AI."
      onClose={closeHelp}
      size="large"
    >
      <div className="help">
        <section className="help-section">
          <h3>Your vault is a folder</h3>
          <p>
            Every note is a <code>.md</code> file inside a folder you choose. Carbon keeps no database and no
            account, so the same folder works in any editor, sync tool or backup.
          </p>
        </section>

        <section className="help-section">
          <h3>Finding things</h3>
          <ul>
            <li>
              <kbd>Ctrl</kbd>+<kbd>O</kbd> — jump to a note by name. Type <code>tag:</code> to narrow by tag.
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> — search the text inside every note, filtered by tag
              or folder.
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>P</kbd> — run any command. <kbd>Ctrl</kbd>+<kbd>G</kbd> — graph view.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>Connecting notes</h3>
          <p>
            Write <code>[[Note name]]</code> to link a note. The Links panel shows backlinks, outgoing links and
            unlinked mentions of the current title. Tags use <code>#topic</code> or frontmatter:
          </p>
          <pre>{'---\ntags: [meetings, q4]\n---'}</pre>
        </section>

        <section className="help-section">
          <h3>Daily notes, templates and meetings</h3>
          <ul>
            <li>
              <kbd>Ctrl</kbd>+<kbd>D</kbd> opens today’s note, created from your daily template. Folder, file name
              and template live in Settings → Writing.
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> inserts a template. Variables:{' '}
              <code>{'{{date}}'}</code>, <code>{'{{date:dddd D MMMM}}'}</code>, <code>{'{{title}}'}</code>,{' '}
              <code>{'{{time}}'}</code>.
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> starts a meeting note with a timestamped template. Paste
              a transcript into the Assistant panel to summarize it when AI is enabled.
            </li>
            <li>
              <strong>File → Export note…</strong> writes Markdown, HTML or PDF. <strong>File → Import Markdown
              folder…</strong> copies an existing vault into this one.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>AI is optional</h3>
          <p>
            Carbon is complete without AI: writing, linking, search, templates, graph and export all work offline.
            To add assistance, open{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                closeHelp();
                openSettings('ai');
              }}
            >
              Settings → AI
            </button>{' '}
            and choose:
          </p>
          <ol>
            <li>
              <strong>Local (Ollama)</strong> — install Ollama, run <code>ollama pull llama3.2</code>, keep the
              default address. Nothing leaves the machine.
            </li>
            <li>
              <strong>OpenAI-compatible endpoint</strong> — LM Studio, vLLM, OpenRouter or your own gateway. Include{' '}
              <code>/v1</code> if the server expects it.
            </li>
            <li>
              <strong>Your own API key</strong> — OpenAI or Anthropic. Keys are encrypted with Windows secure
              storage.
            </li>
          </ol>
          <p className="muted">
            AI is currently <strong>{aiEnabled ? 'on' : 'off'}</strong>. With it off, assistant buttons explain how
            to add a provider instead of failing.
          </p>
        </section>

        <section className="help-section">
          <h3>Keyboard shortcuts</h3>
          <div className="shortcut-groups">
            {GROUPS.map((group) => (
              <div className="shortcut-group" key={group}>
                <h4>{group}</h4>
                <dl>
                  {COMMANDS.filter((command) => command.group === group).map((command) => (
                    <div className="shortcut-row" key={command.id}>
                      <dt>
                        {keybindings[command.id] ? (
                          keybindings[command.id]!
                            .split('+')
                            .map((key) => <kbd key={`${command.id}-${key}`}>{key}</kbd>)
                        ) : (
                          <span className="muted">Unassigned</span>
                        )}
                      </dt>
                      <dd>{command.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="field-hint">Change any of these in Settings → Shortcuts.</p>
        </section>

        <section className="help-section">
          <h3>If something goes wrong</h3>
          <ul>
            <li>
              <strong>“Can’t reach the local AI server”</strong> — Ollama or LM Studio is not running. Start it,
              then use <em>Test connection</em> in Settings → AI.
            </li>
            <li>
              <strong>“The AI service rejected the key”</strong> — replace the key in Settings → AI.
            </li>
            <li>
              <strong>“That note changed on disk”</strong> — another program edited the file. Reopen it from the
              file list to load the version on disk.
            </li>
            <li>
              <strong>Notes missing after an import</strong> — press the reload button in the file explorer header.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>Privacy</h3>
          <p>
            No accounts and no telemetry. Note text leaves the machine only when you run an AI action with a
            provider configured, and only the text that action needs.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => {
                closeHelp();
                openTour();
              }}
            >
              <Icon name="refresh" size={12} /> Replay the tour
            </button>
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => void window.carbon.openExternal('https://github.com/heyitsyajat/carbon')}
            >
              <Icon name="github" size={12} /> GitHub
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
