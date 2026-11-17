import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import type { FileNode, LinkGraph, NoteDoc, NoteMeta, SearchHit } from '../shared/types';

export interface SearchFilter {
  tag?: string | null;
  folder?: string | null;
  limit?: number;
}

export interface ImportResult {
  folder: string;
  imported: number;
}
import {
  buildSnippet,
  extractTags,
  normalizeLinkTarget,
  parseWikiLinks,
  titleFromPath,
} from '../shared/markdown';
import {
  InvalidPathError,
  dirnameOf,
  isIgnoredDirectory,
  isMarkdownFile,
  toNotePath,
  toRelativePath,
  resolveWithinRoot,
  sanitizeFileName,
} from '../shared/paths';

export interface WriteResult {
  path: string;
  mtime: number;
}

export interface RenameResult {
  oldPath: string;
  newPath: string;
}

export interface ScanResult {
  notes: NoteMeta[];
  tree: FileNode;
}

interface CacheEntry {
  content: string;
  mtime: number;
}

const MAX_SCAN_FILES = 20_000;
const MAX_SEARCH_RESULTS = 200;

/**
 * Owns everything that touches the user's vault folder. All paths crossing
 * this boundary are vault-relative POSIX paths; any attempt to escape the
 * vault root throws InvalidPathError.
 */
export class VaultService {
  readonly root: string;
  private readonly cache = new Map<string, CacheEntry>();
  private notesIndex: NoteMeta[] = [];

  private constructor(root: string) {
    this.root = root.replace(/\\/g, '/').replace(/\/+$/, '');
  }

  get name(): string {
    return path.basename(this.root);
  }

  static async open(root: string): Promise<VaultService> {
    const normalized = path.resolve(root);
    const stat = await fs.stat(normalized).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new Error(`Vault folder not found: ${normalized}`);
    }
    return new VaultService(normalized);
  }

  static async create(root: string): Promise<VaultService> {
    const normalized = path.resolve(root);
    await fs.mkdir(normalized, { recursive: true });
    const welcome = path.join(normalized, 'Welcome to Carbon.md');
    const exists = await fs
      .stat(welcome)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      await fs.writeFile(welcome, WELCOME_NOTE, 'utf8');
    }
    return new VaultService(normalized);
  }

  private absolute(relPath: string): string {
    return resolveWithinRoot(this.root, relPath);
  }

  async scan(): Promise<ScanResult> {
    const notes: NoteMeta[] = [];
    const nextCache = new Map<string, CacheEntry>();

    const walk = async (dirRel: string): Promise<FileNode[]> => {
      const absoluteDir = dirRel ? this.absolute(dirRel) : this.root;
      let entries: Dirent[];
      try {
        entries = await fs.readdir(absoluteDir, { withFileTypes: true });
      } catch (error) {
        console.warn(`[vault] cannot read ${absoluteDir}: ${(error as Error).message}`);
        return [];
      }
      const children: FileNode[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (isIgnoredDirectory(entry.name)) continue;
          const nested = await walk(rel);
          children.push({ name: entry.name, path: rel, type: 'folder', children: nested });
          continue;
        }
        if (!entry.isFile() || !isMarkdownFile(entry.name)) continue;
        if (notes.length >= MAX_SCAN_FILES) continue;
        const absolute = this.absolute(rel);
        const stat = await fs.stat(absolute).catch(() => null);
        if (!stat) continue;
        let content = nextCache.get(rel)?.content;
        if (content === undefined) {
          content = await fs.readFile(absolute, 'utf8').catch(() => '');
        }
        nextCache.set(rel, { content, mtime: stat.mtimeMs });
        notes.push({
          path: rel,
          title: titleFromPath(rel),
          mtime: stat.mtimeMs,
          size: stat.size,
          tags: extractTags(content),
        });
        children.push({ name: entry.name, path: rel, type: 'file' });
      }
      return sortNodes(children);
    };

    const tree: FileNode = {
      name: this.name,
      path: '',
      type: 'folder',
      children: await walk(''),
    };

    this.cache.clear();
    for (const [key, value] of nextCache) this.cache.set(key, value);
    this.notesIndex = notes.sort((a, b) => a.path.localeCompare(b.path));
    return { notes: this.notesIndex, tree };
  }

  get notes(): NoteMeta[] {
    return this.notesIndex;
  }

  async read(relPath: string): Promise<NoteDoc> {
    const rel = toNotePath(relPath);
    const absolute = this.absolute(rel);
    const [content, stat] = await Promise.all([fs.readFile(absolute, 'utf8'), fs.stat(absolute)]);
    this.cache.set(rel, { content, mtime: stat.mtimeMs });
    return { path: rel, content, mtime: stat.mtimeMs };
  }

  async write(relPath: string, content: string): Promise<WriteResult> {
    const rel = toNotePath(relPath);
    const absolute = this.absolute(rel);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    const tempPath = `${absolute}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, absolute);
    const stat = await fs.stat(absolute);
    this.cache.set(rel, { content, mtime: stat.mtimeMs });
    return { path: rel, mtime: stat.mtimeMs };
  }

  async createNote(relPath: string, content = ''): Promise<WriteResult> {
    const rel = toNotePath(relPath);
    const absolute = this.absolute(rel);
    const exists = await fs
      .stat(absolute)
      .then(() => true)
      .catch(() => false);
    if (exists) throw new Error(`"${rel}" already exists in this vault.`);
    return this.write(rel, content);
  }

  async createFolder(relPath: string): Promise<void> {
    const rel = toRelativePath(relPath);
    await fs.mkdir(this.absolute(rel), { recursive: true });
  }

  async rename(oldRelPath: string, newRelPath: string): Promise<RenameResult> {
    const oldRel = toRelativePath(oldRelPath);
    const newRel = toRelativePath(newRelPath);
    if (oldRel === newRel) return { oldPath: oldRel, newPath: newRel };
    const from = this.absolute(oldRel);
    const to = this.absolute(newRel);
    const targetExists = await fs
      .stat(to)
      .then(() => true)
      .catch(() => false);
    if (targetExists) throw new Error(`"${newRel}" already exists in this vault.`);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    this.cache.delete(oldRel);
    return { oldPath: oldRel, newPath: newRel };
  }

  async remove(relPath: string): Promise<void> {
    const rel = toRelativePath(relPath);
    const absolute = this.absolute(rel);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      await fs.rm(absolute, { recursive: true, force: false });
      for (const key of [...this.cache.keys()]) {
        if (key === rel || key.startsWith(`${rel}/`)) this.cache.delete(key);
      }
      return;
    }
    await fs.unlink(absolute);
    this.cache.delete(rel);
  }

  /**
   * Full-text search over the cached note contents, optionally narrowed to a
   * folder or a tag. A blank query with a filter lists matching notes.
   */
  search(query: string, filter: SearchFilter | number = {}): SearchHit[] {
    const options: SearchFilter = typeof filter === 'number' ? { limit: filter } : filter;
    const limit = Math.min(options.limit ?? 80, MAX_SEARCH_RESULTS);
    const needle = query.trim().toLowerCase();
    const tag = options.tag?.trim().toLowerCase() ?? '';
    const folder = options.folder?.trim().toLowerCase().replace(/\/+$/, '') ?? '';
    if (!needle && !tag && !folder) return [];

    const titleMatches: SearchHit[] = [];
    const hits: SearchHit[] = [];
    const filtered: SearchHit[] = [];

    for (const note of this.notesIndex) {
      if (titleMatches.length + hits.length + filtered.length >= limit) break;
      const path = note.path.toLowerCase();
      if (folder && path !== folder && !path.startsWith(`${folder}/`)) continue;
      if (tag && !note.tags.some((entry) => entry === tag || entry.startsWith(`${tag}/`))) continue;

      const base = { path: note.path, title: note.title, tags: note.tags } as const;
      if (!needle) {
        filtered.push({ ...base, line: 0, snippet: '' });
        continue;
      }
      if (note.title.toLowerCase().includes(needle)) {
        titleMatches.push({ ...base, line: 0, snippet: 'Match in note title' });
      }
      const entry = this.cache.get(note.path);
      if (!entry) continue;
      const match = buildSnippet(entry.content, needle);
      if (match) hits.push({ ...base, line: match.line, snippet: match.snippet });
    }

    return [...titleMatches, ...hits, ...filtered].slice(0, limit);
  }

  tags(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const note of this.notesIndex) {
      const entry = this.cache.get(note.path);
      if (!entry) continue;
      for (const tag of extractTags(entry.content)) {
        const list = map.get(tag) ?? [];
        list.push(note.path);
        map.set(tag, list);
      }
    }
    return map;
  }

  getContent(relPath: string): string | undefined {
    return this.cache.get(relPath)?.content;
  }

  /** Resolves wiki links between notes, backlinks and unlinked mentions. */
  links(): LinkGraph {
    const outgoing: Record<string, string[]> = {};
    const backlinks: Record<string, string[]> = {};
    const mentions: Record<string, string[]> = {};
    const unresolved = new Set<string>();

    const index = new Map<string, string>();
    for (const note of this.notesIndex) {
      const withoutExt = note.path.replace(/\.md$/i, '');
      index.set(normalizeLinkTarget(withoutExt), note.path);
      const base = normalizeLinkTarget(note.title);
      if (!index.has(base)) index.set(base, note.path);
    }

    for (const note of this.notesIndex) {
      const content = this.cache.get(note.path)?.content;
      if (content === undefined) continue;
      const targets = parseWikiLinks(content);
      const resolvedTargets: string[] = [];
      for (const target of targets) {
        const key = normalizeLinkTarget(target);
        const resolved = index.get(key) ?? index.get(normalizeLinkTarget(target.split('/').pop() ?? target));
        if (!resolved) {
          unresolved.add(target);
          continue;
        }
        if (resolved === note.path) continue;
        if (!resolvedTargets.includes(resolved)) resolvedTargets.push(resolved);
        const list = backlinks[resolved] ?? [];
        if (!list.includes(note.path)) list.push(note.path);
        backlinks[resolved] = list;
      }
      if (resolvedTargets.length > 0) outgoing[note.path] = resolvedTargets;
    }

    // Unlinked mentions: notes that name another note's title without linking.
    const candidates = this.notesIndex
      .filter((note) => note.title.trim().length >= 3)
      .map((note) => ({ path: note.path, title: note.title.toLowerCase() }));
    for (const note of this.notesIndex) {
      const content = this.cache.get(note.path)?.content;
      if (!content) continue;
      const haystack = content.toLowerCase();
      const linked = new Set(outgoing[note.path] ?? []);
      for (const candidate of candidates) {
        if (candidate.path === note.path || linked.has(candidate.path)) continue;
        if (!haystack.includes(candidate.title)) continue;
        const list = mentions[candidate.path] ?? [];
        if (!list.includes(note.path) && list.length < 20) list.push(note.path);
        mentions[candidate.path] = list;
      }
    }

    return { outgoing, backlinks, mentions, unresolved: [...unresolved].sort() };
  }

  /**
   * Copies Markdown files from another folder (for example an Obsidian vault)
   * into a new subfolder of this vault, preserving folder structure.
   */
  async importMarkdown(sourceRoot: string): Promise<ImportResult> {
    const source = path.resolve(sourceRoot);
    const sourceStat = await fs.stat(source).catch(() => null);
    if (!sourceStat?.isDirectory()) throw new Error(`Import folder not found: ${source}`);
    const relativeToVault = path.relative(this.root, source).replace(/\\/g, '/');
    if (relativeToVault && !relativeToVault.startsWith('..')) {
      throw new Error('Choose a folder outside this vault so notes are not copied onto themselves.');
    }

    const baseName = sanitizeFileName(path.basename(source) || 'Imported notes') || 'Imported notes';
    let folder = baseName;
    let counter = 1;
    while (
      await fs
        .stat(this.absolute(folder))
        .then(() => true)
        .catch(() => false)
    ) {
      counter += 1;
      folder = `${baseName} ${counter}`;
    }

    let imported = 0;
    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (isIgnoredDirectory(entry.name)) continue;
          await walk(absolute);
          continue;
        }
        if (!entry.isFile() || !isMarkdownFile(entry.name)) continue;
        const relative = path.relative(source, absolute).replace(/\\/g, '/');
        const destination = `${folder}/${relative}`;
        const target = this.absolute(destination);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(absolute, target);
        imported += 1;
      }
    };
    await walk(source);

    return { folder, imported };
  }

  /** Builds a flat list of every note path, used for link completion. */
  notePaths(): string[] {
    return this.notesIndex.map((note) => note.path);
  }
}

export const WELCOME_NOTE = `---
tags: [getting-started]
---

# Welcome to Carbon

Carbon stores every note as a plain Markdown file in this folder. Nothing is locked in a database, and nothing is uploaded anywhere unless you choose an AI backend that needs it.

## Try this

- Press \`Ctrl+N\` to create a note.
- Type \`[[\` and a note name to link notes together.
- Press \`Ctrl+P\` for the command palette.
- Press \`Ctrl+Shift+F\` to search every note in the vault.

## Where AI comes in

Open **Settings → AI** to point Carbon at a local model (Ollama), any OpenAI-compatible endpoint, or your own API key. Then press \`Ctrl+K\` inside a note to continue writing, rewrite a selection, summarise, or pull action items out of meeting notes.

Tags work inline: #ideas #writing
`;

export function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export { InvalidPathError, dirnameOf, sanitizeFileName, toNotePath, toRelativePath };
