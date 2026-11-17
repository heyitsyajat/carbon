import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyRank } from '../../shared/fuzzy';
import {
  DEFAULT_MEETING_TEMPLATE,
  dailyNotePath,
  formatDatePattern,
  meetingNotePath,
  resolveTemplate,
  templateVariablesList,
} from '../../shared/templates';
import { buildGraph, fitGraph, graphStats, nodeRadius, stepGraph } from '../../shared/graph';
import { exportFileName, markdownForExport, noteToHtmlDocument } from '../../shared/export';
import { friendlyError } from '../../shared/errors';
import {
  DEFAULT_KEYBINDINGS,
  findConflicts,
  normalizeAccelerator,
  sanitizeKeybindings,
} from '../../shared/keybindings';
import { acceleratorFromEvent, commandForEvent, matchesAccelerator } from '../../shared/accelerator';
import { buildMessages } from '../../shared/ai/actions';
import { AIService } from '../ai-service';
import { sanitizeSettings } from '../settings';
import { VaultService } from '../vault';

const DATE = new Date(2026, 10, 17, 9, 5, 0);

describe('fuzzy matcher', () => {
  it('matches characters in order and rejects out-of-order queries', () => {
    expect(fuzzyMatch('Meeting notes', 'mtg')).not.toBeNull();
    expect(fuzzyMatch('Meeting notes', 'gtm')).toBeNull();
  });

  it('scores a prefix match above a scattered match', () => {
    const prefix = fuzzyMatch('Weekly review', 'week')!;
    const scattered = fuzzyMatch('Write everything, keep examples', 'week')!;
    expect(prefix.score).toBeGreaterThan(scattered.score);
  });

  it('returns a neutral match for an empty query', () => {
    expect(fuzzyMatch('anything', '   ')).toEqual({ score: 1, indices: [] });
  });

  it('ranks notes by title, path and tags', () => {
    const notes = [
      { title: 'Quarterly plan', path: 'work/quarterly.md', tags: ['planning'] },
      { title: 'Shopping', path: 'personal/shopping.md', tags: [] },
      { title: 'Retro', path: 'work/retro.md', tags: ['planning'] },
    ];
    const ranked = fuzzyRank(notes, 'planning', (note) => [note.title, note.path, ...note.tags]);
    expect(ranked.map((entry) => entry.item.title)).toEqual(['Quarterly plan', 'Retro']);
    expect(fuzzyRank(notes, '', (note) => [note.title], 1)).toHaveLength(1);
  });
});

describe('templates', () => {
  it('formats supported date tokens', () => {
    expect(formatDatePattern('YYYY-MM-DD', DATE)).toBe('2026-11-17');
    expect(formatDatePattern('dddd D MMMM YYYY', DATE)).toBe('Tuesday 17 November 2026');
    expect(formatDatePattern('ddd D MMM HH:mm', DATE)).toBe('Tue 17 Nov 09:05');
  });

  it('resolves title, date and time variables', () => {
    const template = '# {{title}}\n\n{{date}} at {{time}}\n{{date:dddd}}';
    expect(resolveTemplate(template, { title: 'Standup', date: DATE })).toBe(
      '# Standup\n\n2026-11-17 at 09:05\nTuesday',
    );
  });

  it('keeps unknown variables untouched and lists known ones', () => {
    const template = '{{title}} {{date}} {{time}} {{weather}}';
    expect(resolveTemplate(template, { title: 'A', date: DATE })).toContain('{{weather}}');
    expect(templateVariablesList(template).sort()).toEqual(['date', 'time', 'title']);
  });

  it('builds vault-safe daily and meeting paths', () => {
    expect(dailyNotePath('Daily', 'YYYY-MM-DD', DATE)).toBe('Daily/2026-11-17.md');
    expect(dailyNotePath('', 'YYYY-MM-DD dddd', DATE)).toBe('2026-11-17 Tuesday.md');
    // Slashes are not legal in Windows file names and collapse to dashes.
    expect(dailyNotePath('/journal/', 'YYYY/MM/DD', DATE)).toBe('journal/2026-11-17.md');
    expect(meetingNotePath('Meetings', DATE, 'Q4: planning / kickoff')).toBe(
      'Meetings/2026-11-17 0905 — Q4 planning  kickoff.md',
    );
  });

  it('ships a timestamped meeting template with action items', () => {
    expect(DEFAULT_MEETING_TEMPLATE).toContain('{{time}}');
    expect(DEFAULT_MEETING_TEMPLATE).toContain('## Action items');
    expect(DEFAULT_MEETING_TEMPLATE).toContain('type: meeting');
  });
});

describe('graph layout', () => {
  const notes = [
    { path: 'a.md', title: 'Alpha' },
    { path: 'b.md', title: 'Beta' },
    { path: 'c.md', title: 'Solo' },
  ];
  const outgoing = { 'a.md': ['b.md', 'missing.md'], 'b.md': ['a.md', 'b.md'] };

  it('builds nodes and resolved edges only', () => {
    const graph = buildGraph(notes, outgoing);
    expect(graph.nodes.map((node) => node.id)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(graph.edges).toEqual([
      { source: 'a.md', target: 'b.md' },
      { source: 'b.md', target: 'a.md' },
    ]);
    expect(graph.nodes.find((node) => node.id === 'a.md')?.degree).toBe(2);
    expect(graphStats(graph)).toEqual({ notes: 3, links: 2, isolated: 1 });
    expect(nodeRadius(graph.nodes[0]!)).toBeGreaterThan(nodeRadius(graph.nodes[2]!));
  });

  it('keeps positions inside the canvas and is deterministic', () => {
    const first = buildGraph(notes, outgoing, { width: 400, height: 300 });
    const second = buildGraph(notes, outgoing, { width: 400, height: 300 });
    for (let tick = 0; tick < 20; tick += 1) {
      stepGraph(first);
      stepGraph(second);
    }
    const positions = first.nodes.map((node) => [node.x, node.y]);
    expect(positions).toEqual(second.nodes.map((node) => [node.x, node.y]));
    for (const node of first.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(400);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(300);
    }
  });

  it('fits a settled layout to the canvas without distorting it', () => {
    const graph = buildGraph(notes, outgoing, { width: 800, height: 500 });
    for (const node of graph.nodes) {
      node.x = 380 + (node.x % 10);
      node.y = 240 + (node.y % 10);
    }
    fitGraph(graph, 80);
    const xs = graph.nodes.map((node) => node.x);
    const ys = graph.nodes.map((node) => node.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(70);
    expect(Math.max(...xs)).toBeLessThanOrEqual(730);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(70);
    expect(Math.max(...ys)).toBeLessThanOrEqual(430);
    expect(graph.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it('centres a single-node graph', () => {
    const graph = buildGraph([{ path: 'solo.md', title: 'Solo' }], {}, { width: 600, height: 400 });
    fitGraph(graph);
    expect(graph.nodes[0]!.x).toBeCloseTo(300, 5);
    expect(graph.nodes[0]!.y).toBeCloseTo(200, 5);
  });

  it('separates nodes that start at the same point', () => {
    const graph = buildGraph(
      [
        { path: 'x.md', title: 'X' },
        { path: 'y.md', title: 'Y' },
      ],
      {},
    );
    graph.nodes[0]!.x = 10;
    graph.nodes[0]!.y = 10;
    graph.nodes[1]!.x = 10;
    graph.nodes[1]!.y = 10;
    stepGraph(graph);
    expect(graph.nodes[0]!.x === graph.nodes[1]!.x && graph.nodes[0]!.y === graph.nodes[1]!.y).toBe(false);
  });
});

describe('export helpers', () => {
  it('builds safe file names', () => {
    expect(exportFileName('Q4: review / next steps?')).toBe('Q4 review next steps');
    expect(exportFileName('   ')).toBe('Untitled');
    expect(exportFileName('a'.repeat(140))).toHaveLength(100);
  });

  it('normalises Markdown line endings and trailing newline', () => {
    expect(markdownForExport('\uFEFF# Title\r\nbody')).toBe('# Title\nbody\n');
    expect(markdownForExport('done\n')).toBe('done\n');
  });

  it('wraps note HTML in a self-contained document', () => {
    const html = noteToHtmlDocument({
      title: 'Notes <draft>',
      bodyHtml: '<p>Hello</p>',
      content: '---\ntags: [meeting]\ndate: 2026-11-17\n---\n\nHello',
    });
    expect(html).toContain('<title>Notes &lt;draft&gt;</title>');
    expect(html).toContain('<article class="note"><p>Hello</p></article>');
    expect(html).toContain('tags: meeting');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('@media print');
  });
});

describe('friendlyError', () => {
  it('explains missing files with the context', () => {
    expect(friendlyError(new Error('ENOENT: no such file'), 'That note')).toContain('That note could not be found');
  });

  it('explains permissions, name clashes and connection failures', () => {
    expect(friendlyError(new Error('EACCES: permission denied'))).toContain('Windows blocked access');
    expect(friendlyError(new Error('EEXIST: already exists'))).toContain('already exists');
    expect(friendlyError(new Error('connect ECONNREFUSED'))).toContain('Nothing is listening');
    expect(friendlyError(new Error('fetch failed'))).toContain('did not reach its destination');
  });

  it('passes short unknown messages through and trims long ones', () => {
    expect(friendlyError(new Error('Something odd happened'))).toBe('Something odd happened');
    expect(friendlyError(new Error('x'.repeat(400)))).toContain('check the logs');
    expect(friendlyError(new Error(''))).toBe('The file could not be completed. Try again.');
  });
});

describe('keybindings', () => {
  it('normalises modifier order and key names', () => {
    expect(normalizeAccelerator('shift+ctrl+p')).toBe('Ctrl+Shift+P');
    expect(normalizeAccelerator('control + alt + arrowup')).toBe('Ctrl+Alt+ArrowUp');
    expect(normalizeAccelerator('')).toBe('');
  });

  it('sanitises stored bindings, dropping duplicates and keeping explicit blanks', () => {
    const raw = {
      'quick-open': 'ctrl+o',
      'command-palette': 'CTRL+O',
      'new-note': '',
      'not-a-command': 'Ctrl+Z',
    };
    const result = sanitizeKeybindings(raw);
    expect(result['quick-open']).toBe('Ctrl+O');
    expect(result['command-palette']).toBe('');
    expect(result['new-note']).toBe('');
    expect(result).not.toHaveProperty('not-a-command');
    expect(result['search-vault']).toBe(DEFAULT_KEYBINDINGS['search-vault']);
  });

  it('falls back to defaults for invalid stored values', () => {
    expect(sanitizeKeybindings({ 'new-note': 42 })['new-note']).toBe(DEFAULT_KEYBINDINGS['new-note']);
    expect(sanitizeKeybindings(null)['save-note']).toBe(DEFAULT_KEYBINDINGS['save-note']);
  });

  it('reports duplicate accelerators', () => {
    const conflicts = findConflicts({ a: 'Ctrl+O', b: 'Ctrl+O', c: 'Ctrl+P', d: '' });
    expect(conflicts.get('ctrl+o')).toEqual(['a', 'b']);
    expect(conflicts.has('')).toBe(false);
  });

  it('builds and matches accelerators from keyboard events', () => {
    const event = { key: 'f', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false };
    expect(acceleratorFromEvent(event)).toBe('Ctrl+Shift+F');
    expect(matchesAccelerator(event, 'Ctrl+Shift+F')).toBe(true);
    expect(matchesAccelerator(event, 'Ctrl+F')).toBe(false);
    expect(commandForEvent(event, { 'search-vault': 'Ctrl+Shift+F', 'new-note': 'Ctrl+N' })).toBe(
      'search-vault',
    );
    expect(commandForEvent(event, { 'new-note': 'Ctrl+N' })).toBeNull();
  });
});

describe('vault search, mentions and import', () => {
  let root: string;
  let vault: VaultService;

  async function write(rel: string, content: string): Promise<void> {
    const absolute = path.join(root, rel);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
  }

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'carbon-features-'));
    vault = await VaultService.open(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('searches note text and narrows by tag and folder', async () => {
    await write('work/plan.md', '# Plan\n\nThe launch date is Friday. #planning');
    await write('work/retro.md', '---\ntags: [planning]\n---\n\nWe reviewed the launch.');
    await write('personal/list.md', 'Buy milk.');

    const { notes } = await vault.scan();
    expect(notes).toHaveLength(3);

    const text = vault.search('launch');
    expect(text.map((hit) => hit.path).sort()).toEqual(['work/plan.md', 'work/retro.md']);

    const tagged = vault.search('', { tag: 'planning' });
    expect(tagged.map((hit) => hit.path).sort()).toEqual(['work/plan.md', 'work/retro.md']);

    const folded = vault.search('', { folder: 'work' });
    expect(folded.every((hit) => hit.path.startsWith('work/'))).toBe(true);

    const both = vault.search('launch', { folder: 'personal' });
    expect(both).toEqual([]);

    expect(vault.search('')).toEqual([]);
  });

  it('resolves backlinks, outgoing links and unlinked mentions', async () => {
    await write('Project Alpha.md', '# Alpha\n\nSee [[Project Beta]].');
    await write('Project Beta.md', '# Beta\n');
    await write('journal.md', 'We discussed Project Alpha at standup.');

    await vault.scan();
    const links = vault.links();

    expect(links.outgoing['Project Alpha.md']).toEqual(['Project Beta.md']);
    expect(links.backlinks['Project Beta.md']).toEqual(['Project Alpha.md']);
    expect(links.mentions['Project Alpha.md']).toEqual(['journal.md']);
    expect(links.unresolved).toEqual([]);
  });

  it('imports Markdown folders, skipping Obsidian metadata', async () => {
    const source = await fs.mkdtemp(path.join(os.tmpdir(), 'carbon-source-'));
    try {
      await fs.mkdir(path.join(source, 'notes'), { recursive: true });
      await fs.mkdir(path.join(source, '.obsidian'), { recursive: true });
      await fs.writeFile(path.join(source, 'notes', 'one.md'), '# One', 'utf8');
      await fs.writeFile(path.join(source, 'two.md'), '# Two', 'utf8');
      await fs.writeFile(path.join(source, '.obsidian', 'config.md'), 'nope', 'utf8');
      await fs.writeFile(path.join(source, 'notes', 'image.png'), 'binary', 'utf8');

      const result = await vault.importMarkdown(source);
      expect(result.imported).toBe(2);
      expect(result.folder).toBe(path.basename(source));

      const imported = path.join(root, result.folder, 'notes', 'one.md');
      expect(await fs.readFile(imported, 'utf8')).toBe('# One');
      await expect(fs.stat(path.join(root, result.folder, '.obsidian'))).rejects.toThrow();

      // A second import into the same vault gets its own folder.
      const again = await vault.importMarkdown(source);
      expect(again.folder).toBe(`${path.basename(source)} 2`);
    } finally {
      await fs.rm(source, { recursive: true, force: true });
    }
  });
});

describe('optional AI', () => {
  it('defaults to AI off and keeps an explicit choice', () => {
    expect(sanitizeSettings({}).ai.enabled).toBe(false);
    expect(sanitizeSettings({ ai: { enabled: true } }).ai.enabled).toBe(true);
    expect(sanitizeSettings({ ai: { enabled: false } }).ai.enabled).toBe(false);
  });

  it('explains that AI is off instead of failing when disabled', async () => {
    const settings = sanitizeSettings({ ai: { enabled: false } });
    const secrets = { get: async () => undefined };
    const service = new AIService(
      () => settings,
      secrets as unknown as ConstructorParameters<typeof AIService>[1],
      () => null,
    );
    const result = await service.test();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('AI is turned off');
    expect(result.message).toContain('Settings → AI');
  });
});

describe('meeting prompts', () => {
  it('asks for a summary and action items from the transcript', () => {
    const messages = buildMessages({
      action: 'meeting',
      selection: 'Ana: we ship on Friday. Ben: I will update the docs.',
    });
    const user = messages[1]!.content;
    expect(user).toContain('## Summary');
    expect(user).toContain('## Action items');
    expect(user).toContain('Ana: we ship on Friday.');
    expect(user).toContain('Do not invent attendees');
  });

  it('describes the request scope', () => {
    const messages = buildMessages({ action: 'meeting', noteContent: 'transcript text' });
    expect(messages[1]!.content).toContain('transcript text');
  });
});
