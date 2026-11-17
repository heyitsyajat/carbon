#!/usr/bin/env node
/**
 * Builds a throwaway vault and settings file used for landing-page screenshots
 * and manual smoke tests. It never touches the user's real Carbon profile.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = path.join(os.tmpdir(), 'carbon-shots');
const vault = path.join(base, 'Field Notes');
const profile = path.join(base, 'profile');

rmSync(vault, { recursive: true, force: true });
mkdirSync(path.join(vault, 'Meetings'), { recursive: true });
mkdirSync(path.join(vault, 'Journal'), { recursive: true });
mkdirSync(path.join(vault, 'Templates'), { recursive: true });

const write = (rel, content) => {
  const target = path.join(vault, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
};

write(
  'Launch plan.md',
  `---
tags: [work, launch]
status: in-progress
---

# Launch plan

The desktop build ships on **Friday 21 November**. This note is the single source of truth for what is left, who owns it, and what we deliberately cut.

> Ship the smaller thing that works, then improve it in public.

## What ships

- Signed installer and a portable build
- Import from any Markdown folder
- Search across the whole vault, filtered by tag or folder
- [[Pricing notes]] reviewed by Friday

## Open questions

1. Do we keep the old welcome note for existing vaults?
2. Is the \`#launch\` tag enough, or do we need \`#launch/q4\` as well?
3. Who writes the release note? See [[2026-11-12 — Weekly sync]].

## Checklist

- [x] Installer builds on a clean machine
- [x] Import tested with an Obsidian vault
- [ ] Release note drafted
- [ ] Screenshots replaced

## Numbers

| Build | Size | Startup |
| --- | --- | --- |
| 0.9 | 84 MB | 1.4 s |
| 1.0 | 86 MB | 1.1 s |
`,
);

write(
  'Pricing notes.md',
  `---
tags: [work, pricing]
---

# Pricing notes

One plan, one price. No per-seat maths, no "contact sales" button.

## Decided

- **$29** one-time for the app
- Free updates for a year
- No account required, ever

## Why not a subscription

The app is local-first. There is no server to pay for, so a subscription would be hard to justify. Support is the only recurring cost, and it is small.

Related: [[Launch plan]].
`,
);

write(
  'Reading list.md',
  `---
tags: [reading]
---

# Reading list

## Now

- *The Craftsman* — Richard Sennett
- *Thinking in Systems* — Donella Meadows

## Next

- *A Pattern Language* — Christopher Alexander
- *Understanding Comics* — Scott McCloud

Notes on [[Launch plan]] and [[Pricing notes]] when something applies.
`,
);

write(
  'Meetings/2026-11-12 — Weekly sync.md',
  `---
type: meeting
tags: [meeting, work]
date: 2026-11-12
---

# Weekly sync — Thu 12 Nov

**Attendees:** Ana, Ben, Priya
**Context:** Release readiness

## Notes
- 09:04 Installer is signed on the CI runner.
- 09:12 Import handles nested folders and skips .obsidian.
- 09:26 Pricing page still says "coming soon".

## Decisions
- Ship without a changelog page; link the GitHub release instead.
- Keep the portable build.

## Action items
- [ ] **Ana** — draft the release note by Wednesday
- [ ] **Ben** — replace the pricing copy
- [ ] **Priya** — test import with a 2,000-note vault

## Follow-up
Next check-in Thursday. See [[Launch plan]].
`,
);

write(
  'Journal/2026-11-17.md',
  `---
tags: [daily]
date: 2026-11-17
---

# Tuesday, 17 November 2026

## Focus
- Finish the release note
- Review [[Pricing notes]]

## Notes
Search feels instant now. The graph is still the part I open for fun rather than work, which probably means it is finished.

## Wins
- Import survived a vault with emoji folder names.
`,
);

write(
  'Templates/Meeting.md',
  `---
type: meeting
tags: [meeting]
date: {{date:YYYY-MM-DD}}
---

# {{title}} — {{date:ddd D MMM}}

**Attendees:** 
**Context:** 

## Notes
- {{time}} 

## Decisions

## Action items
- [ ] 
`,
);

mkdirSync(profile, { recursive: true });
writeFileSync(
  path.join(profile, 'settings.json'),
  JSON.stringify(
    {
      theme: process.env.SHOT_THEME ?? 'light',
      onboardingComplete: true,
      tourCompleted: true,
      lastVaultPath: vault,
      lastNotePath: 'Launch plan.md',
      vaults: [{ path: vault, name: 'Field Notes', lastOpenedAt: Date.now() }],
      ai: { enabled: true, provider: 'ollama', model: 'llama3.2' },
      ui: { leftSidebarOpen: true, rightSidebarOpen: true, leftSidebarWidth: 252, rightSidebarWidth: 288 },
      editor: { defaultMode: 'preview', fontSize: 17 },
      window: { x: 80, y: 60, width: 1440, height: 900, maximized: false },
    },
    null,
    2,
  ),
  'utf8',
);

process.stdout.write(`${profile}\n${vault}\n`);
