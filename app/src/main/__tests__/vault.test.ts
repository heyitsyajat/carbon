import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VaultService, WELCOME_NOTE } from '../vault';
import { InvalidPathError } from '../../shared/paths';

let root: string;
let vault: VaultService;

async function writeFile(rel: string, content: string): Promise<void> {
  const absolute = path.join(root, rel);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf8');
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'carbon-vault-'));
  vault = await VaultService.open(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('VaultService.scan', () => {
  it('returns an empty tree for an empty folder', async () => {
    const result = await vault.scan();
    expect(result.notes).toEqual([]);
    expect(result.tree.children).toEqual([]);
  });

  it('lists markdown notes recursively with titles, tags and sizes', async () => {
    await writeFile('Welcome.md', '# Welcome\n#start');
    await writeFile('notes/deep/idea.md', '---\ntags: [spark]\n---\nbody');
    await writeFile('notes/ignore.txt', 'not a note');

    const { notes, tree } = await vault.scan();

    // Notes are sorted by path (case-insensitive).
    expect(notes.map((note) => note.path)).toEqual(['notes/deep/idea.md', 'Welcome.md']);
    const welcome = notes.find((note) => note.path === 'Welcome.md');
    expect(welcome?.title).toBe('Welcome');
    expect(welcome?.tags).toContain('start');
    expect(notes.find((note) => note.path === 'notes/deep/idea.md')?.tags).toEqual(['spark']);
    expect(welcome?.size).toBeGreaterThan(0);

    const notesFolder = tree.children?.find((node) => node.name === 'notes');
    expect(notesFolder?.type).toBe('folder');
    expect(notesFolder?.children?.[0]?.name).toBe('deep');
  });

  it('sorts folders before files and ignores dotfiles and node_modules', async () => {
    await writeFile('b.md', 'b');
    await writeFile('a.md', 'a');
    await writeFile('zeta/z.md', 'z');
    await writeFile('.hidden/h.md', 'h');
    await writeFile('node_modules/pkg/readme.md', 'nope');

    const { notes, tree } = await vault.scan();
    expect(notes.map((note) => note.path)).toEqual(['a.md', 'b.md', 'zeta/z.md']);
    expect(tree.children?.map((node) => node.name)).toEqual(['zeta', 'a.md', 'b.md']);
  });
});

describe('VaultService.read/write', () => {
  it('reads and writes notes, normalising the extension', async () => {
    const written = await vault.write('journal/day one', 'hello');
    expect(written.path).toBe('journal/day one.md');

    const doc = await vault.read('journal/day one');
    expect(doc.content).toBe('hello');
    expect(doc.mtime).toBeGreaterThan(0);
  });

  it('creates parent folders on write', async () => {
    await vault.write('a/b/c/deep.md', 'x');
    const stat = await fs.stat(path.join(root, 'a/b/c/deep.md'));
    expect(stat.isFile()).toBe(true);
  });

  it('refuses to create a note that already exists', async () => {
    await vault.write('exists.md', 'one');
    await expect(vault.createNote('exists.md', 'two')).rejects.toThrow(/already exists/);
  });

  it('rejects path traversal outside the vault', async () => {
    await expect(vault.read('../escape.md')).rejects.toBeInstanceOf(InvalidPathError);
    await expect(vault.write('notes/../../escape.md', 'x')).rejects.toBeInstanceOf(InvalidPathError);
    await expect(vault.write('/etc/passwd', 'x')).rejects.toBeInstanceOf(InvalidPathError);
  });
});

describe('VaultService.rename/remove', () => {
  it('renames notes and folders', async () => {
    await vault.write('old.md', 'content');
    const result = await vault.rename('old.md', 'new.md');
    expect(result).toEqual({ oldPath: 'old.md', newPath: 'new.md' });
    await expect(vault.read('old.md')).rejects.toThrow();
    expect((await vault.read('new.md')).content).toBe('content');
  });

  it('refuses to rename onto an existing note', async () => {
    await vault.write('one.md', '1');
    await vault.write('two.md', '2');
    await expect(vault.rename('one.md', 'two.md')).rejects.toThrow(/already exists/);
  });

  it('removes files and directories', async () => {
    await vault.write('folder/note.md', 'x');
    await fs.writeFile(path.join(root, 'folder', 'other.txt'), 'y');
    await vault.remove('folder');
    await expect(fs.stat(path.join(root, 'folder'))).rejects.toThrow();
  });
});

describe('VaultService.search', () => {
  beforeEach(async () => {
    await writeFile('alpha.md', 'The quick brown fox jumps over the lazy dog');
    await writeFile('notes/beta.md', 'Another note about a brown bear');
    await writeFile('gamma.md', 'Nothing relevant here');
    await vault.scan();
  });

  it('finds content matches with a snippet and line number', async () => {
    const hits = vault.search('brown');
    expect(hits).toHaveLength(2);
    expect(hits[0]?.snippet.toLowerCase()).toContain('brown');
  });

  it('prioritises title matches', async () => {
    const hits = vault.search('alpha');
    expect(hits[0]?.path).toBe('alpha.md');
    expect(hits[0]?.snippet).toBe('Match in note title');
  });

  it('is case-insensitive and returns nothing for blank queries', async () => {
    expect(vault.search('BROWN')).toHaveLength(2);
    expect(vault.search('   ')).toEqual([]);
  });

  it('respects the result limit', async () => {
    expect(vault.search('e', 1).length).toBeLessThanOrEqual(1);
  });
});

describe('VaultService.links', () => {
  it('resolves wiki links, backlinks and unresolved targets', async () => {
    await writeFile('A.md', 'Links to [[B]] and [[notes/C]] and [[Missing]]');
    await writeFile('B.md', 'Links back to [[A|alpha]]');
    await writeFile('notes/C.md', 'No links');
    await vault.scan();

    const graph = vault.links();
    expect(graph.outgoing['A.md']).toEqual(['B.md', 'notes/C.md']);
    expect(graph.outgoing['B.md']).toEqual(['A.md']);
    expect(graph.backlinks['A.md']).toEqual(['B.md']);
    expect(graph.backlinks['B.md']).toEqual(['A.md']);
    expect(graph.unresolved).toEqual(['Missing']);
  });

  it('ignores self links and duplicate links', async () => {
    await writeFile('solo.md', '[[solo]] [[solo]]');
    await vault.scan();
    const graph = vault.links();
    expect(graph.outgoing['solo.md']).toBeUndefined();
    expect(graph.backlinks['solo.md']).toBeUndefined();
  });
});

describe('VaultService.create', () => {
  it('creates the folder and a welcome note', async () => {
    const target = path.join(root, 'fresh-vault');
    const created = await VaultService.create(target);
    expect(created.name).toBe('fresh-vault');
    const welcome = await fs.readFile(path.join(target, 'Welcome to Carbon.md'), 'utf8');
    expect(welcome).toBe(WELCOME_NOTE);
  });

  it('does not overwrite an existing welcome note', async () => {
    const target = path.join(root, 'existing');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'Welcome to Carbon.md'), 'mine');
    await VaultService.create(target);
    expect(await fs.readFile(path.join(target, 'Welcome to Carbon.md'), 'utf8')).toBe('mine');
  });

  it('rejects opening a folder that does not exist', async () => {
    await expect(VaultService.open(path.join(root, 'nope'))).rejects.toThrow(/not found/);
  });
});
