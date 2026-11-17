const REPO = 'https://github.com/heyitsyajat/carbon';
const DOWNLOAD = `${REPO}/releases/latest`;

const FEATURES = [
  {
    title: 'Quick switcher',
    body: 'Ctrl+O jumps to any note by name, with fuzzy matching. Type tag: to narrow by tag.',
  },
  {
    title: 'Search the text, not just titles',
    body: 'Ctrl+Shift+F searches the contents of every note and filters by tag or folder. Results show the matching line.',
  },
  {
    title: 'Links both ways',
    body: 'Write [[Note name]]. The side panel lists backlinks, links from the note, and unlinked mentions of its title.',
  },
  {
    title: 'Graph view',
    body: 'A force layout of your vault. Node size follows link count; click a node to open the note.',
  },
  {
    title: 'Daily notes and templates',
    body: 'Ctrl+D creates today’s note from your template. Templates support {{date}}, {{time}} and {{title}}.',
  },
  {
    title: 'Meeting notes',
    body: 'Ctrl+Shift+M starts a timestamped meeting note. With AI configured, paste a transcript for a summary and action items.',
  },
  {
    title: 'Export and import',
    body: 'Export a note as Markdown, HTML or PDF. Import an Obsidian vault or any folder of Markdown files, structure intact.',
  },
  {
    title: 'Shortcuts, remapped',
    body: 'Every command can be rebound in Settings → Shortcuts. Focus mode hides the sidebars; the editor takes the window.',
  },
];

const FAQ = [
  {
    q: 'Do I need an AI provider to use Carbon?',
    a: 'No. Setup offers “Continue without AI” next to “Set up AI provider”, and notes, search, links, graph, templates, export and import all work without one. Assistant buttons show a short prompt to add a provider in Settings instead of failing. You can add one at any time from Settings → AI, and the setup wizard does not appear again once it is finished.',
  },
  {
    q: 'Where are my notes stored?',
    a: 'In the folder you pick, one .md file per note. Carbon keeps settings in your Windows user profile; your writing is never copied into a database.',
  },
  {
    q: 'Which AI backends are supported?',
    a: 'A local Ollama server, any OpenAI-compatible endpoint (LM Studio, vLLM, OpenRouter, your own gateway), or an OpenAI or Anthropic API key. Keys are encrypted with Windows secure storage and never reach the editor.',
  },
  {
    q: 'Can I import an Obsidian vault?',
    a: 'Yes. File → Import Markdown folder copies Markdown files and folder structure into a new folder inside the open vault. Obsidian’s .obsidian folder is skipped, and the original vault is left untouched.',
  },
  {
    q: 'Does it work offline?',
    a: 'Writing, linking, search, graph, export and import are entirely local. Only an AI request needs a network connection, and a local model needs none.',
  },
  {
    q: 'What does it cost?',
    a: 'Carbon is free and MIT licensed. There is no account, no telemetry and no subscription. AI usage is billed by whichever provider you choose.',
  },
];

function Logo({ dark = false }) {
  return (
    <img
      className="logo"
      src={dark ? './brand/logo-dark.svg' : './brand/logo-light.svg'}
      alt=""
      width="26"
      height="26"
    />
  );
}

function Figure({ src, alt, caption, className = '' }) {
  return (
    <figure className={`shot ${className}`}>
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function App() {
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Carbon home">
          <Logo />
          <span>Carbon</span>
        </a>
        <nav aria-label="Sections">
          <a href="#features">Features</a>
          <a href="#screens">Screenshots</a>
          <a href="#ai">AI</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="button button-primary button-small" href={DOWNLOAD}>
          Download
        </a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Windows · Markdown · local-first</p>
            <h1>Notes that stay as files.</h1>
            <p className="lede">
              Carbon edits a folder of Markdown notes on your computer. Links, full-text search, a note graph,
              daily notes and export are built in. AI is optional — the app is complete without it.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={DOWNLOAD}>
                Download for Windows
              </a>
              <a className="button button-quiet" href="#screens">
                See the app
              </a>
            </div>
            <p className="fine-print">Installer and portable build · Free · MIT · No account</p>
          </div>

          <div className="hero-shot">
            <img
              src="./screenshots/workspace-light.png"
              alt="Carbon with the Field Notes vault open: file list on the left, the Launch plan note in the centre, and its outline on the right."
              width="1440"
              height="900"
            />
          </div>
        </section>

        <section className="strip" aria-label="At a glance">
          <dl>
            <div>
              <dt>Storage</dt>
              <dd>Plain .md files in a folder you choose</dd>
            </div>
            <div>
              <dt>Offline</dt>
              <dd>Every feature except remote AI works without a network</dd>
            </div>
            <div>
              <dt>AI</dt>
              <dd>Off by default; add Ollama, an endpoint or a key when you want it</dd>
            </div>
          </dl>
        </section>

        <section className="features" id="features">
          <header className="section-head">
            <p className="eyebrow">What is inside</p>
            <h2>Built for finding what you wrote.</h2>
            <p>
              Carbon keeps the Obsidian-style layout — files, tabs, editor, side panel — and removes the clutter
              around it.
            </p>
          </header>
          <div className="feature-list">
            {FEATURES.map((feature) => (
              <div className="feature" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="screens" id="screens">
          <header className="section-head">
            <p className="eyebrow">Screenshots</p>
            <h2>The actual app, not a mockup.</h2>
            <p>Captured on Windows from the same build you download.</p>
          </header>

          <div className="screen-pair">
            <Figure
              src="./screenshots/search-light.png"
              alt="Full-text search over the vault, with tag and folder filters and matching lines."
              caption="Full-text search, filtered by tag or folder."
            />
            <Figure
              src="./screenshots/graph-light.png"
              alt="Graph view showing six notes connected by seven links, with the current note highlighted."
              caption="Graph view: six notes, seven links, one unlinked note."
            />
          </div>

          <div className="screen-pair screen-pair-wide">
            <Figure
              src="./screenshots/quick-switcher-light.png"
              alt="Quick switcher open over the editor, showing one fuzzy match for the typed query."
              caption="Ctrl+O: jump to a note without leaving the keyboard."
            />
            <Figure
              src="./screenshots/settings-ai-light.png"
              alt="Settings on the AI section, showing local, OpenAI-compatible, OpenAI and Anthropic providers."
              caption="Settings → AI: local model, any compatible endpoint, or your own key."
            />
          </div>
        </section>

        <section className="ai-band" id="ai">
          <div className="ai-copy">
            <p className="eyebrow">Optional, in the literal sense</p>
            <h2>Continue without AI.</h2>
            <p>
              The setup wizard has two equal choices: set up a provider, or continue without one. Skipping leaves
              the app fully usable. Assistant panels and shortcut actions show a short “Add an AI provider in
              Settings” note rather than an error, and the wizard does not come back.
            </p>
            <p>
              When you do add one, only the text an action needs is sent: the current note, or the selection if
              you made one. A local Ollama model keeps everything on the machine.
            </p>
            <a className="button button-onDark" href={DOWNLOAD}>
              Download Carbon
            </a>
          </div>
          <div className="ai-shot">
            <img
              src="./screenshots/workspace-dark.png"
              alt="Carbon in the dark burgundy theme, showing the same Launch plan note and outline."
              width="1440"
              height="900"
              loading="lazy"
            />
          </div>
        </section>

        <section className="faq" id="faq">
          <header className="section-head">
            <p className="eyebrow">Questions</p>
            <h2>Short answers.</h2>
          </header>
          <div className="faq-list">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing">
          <div>
            <Logo />
            <h2>Your notes are already files. Keep them that way.</h2>
            <p>Installer, portable build and source are on GitHub.</p>
          </div>
          <div className="closing-actions">
            <a className="button button-primary" href={DOWNLOAD}>
              Download for Windows
            </a>
            <a className="button button-quiet" href={REPO}>
              Source
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Carbon · MIT licensed</span>
        <div>
          <a href={`${REPO}/blob/main/LICENSE`}>License</a>
          <a href={`${REPO}/blob/main/README.md`}>README</a>
          <a href={`${REPO}/issues`}>Report a bug</a>
        </div>
      </footer>
    </>
  );
}
