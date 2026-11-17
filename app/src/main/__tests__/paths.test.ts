import { describe, expect, it } from 'vitest';
import {
  InvalidPathError,
  dirnameOf,
  basenameOf,
  isIgnoredDirectory,
  isMarkdownFile,
  resolveWithinRoot,
  sanitizeFileName,
  toNotePath,
  toRelativePath,
  uniqueNoteName,
} from '../../shared/paths';
import { titleFromPath } from '../../shared/markdown';

describe('toRelativePath', () => {
  it('normalises slashes and leading prefixes', () => {
    expect(toRelativePath('notes\\day-one.md')).toBe('notes/day-one.md');
    expect(toRelativePath('./notes//day-one.md')).toBe('notes/day-one.md');
    expect(toRelativePath('  notes/day.md  ')).toBe('notes/day.md');
  });

  it('rejects traversal and absolute paths', () => {
    expect(() => toRelativePath('../secret.md')).toThrow(InvalidPathError);
    expect(() => toRelativePath('notes/../../secret.md')).toThrow(InvalidPathError);
    expect(() => toRelativePath('C:\\Windows\\system.ini')).toThrow(InvalidPathError);
    expect(() => toRelativePath('//server/share/file.md')).toThrow(InvalidPathError);
    expect(() => toRelativePath('bad\0name')).toThrow(InvalidPathError);
  });

  it('rejects empty paths', () => {
    expect(() => toRelativePath('')).toThrow(InvalidPathError);
    expect(() => toRelativePath('.')).toThrow(InvalidPathError);
  });
});

describe('toNotePath', () => {
  it('appends .md when missing', () => {
    expect(toNotePath('ideas')).toBe('ideas.md');
    expect(toNotePath('ideas.md')).toBe('ideas.md');
    expect(toNotePath('notes/ideas')).toBe('notes/ideas.md');
  });
});

describe('resolveWithinRoot', () => {
  it('builds paths inside the root', () => {
    expect(resolveWithinRoot('C:/Vault', 'notes/a.md')).toBe('C:/Vault/notes/a.md');
    expect(resolveWithinRoot('C:\\Vault\\', 'a.md')).toBe('C:/Vault/a.md');
  });

  it('blocks escapes regardless of case', () => {
    expect(() => resolveWithinRoot('C:/Vault', '../other/a.md')).toThrow(InvalidPathError);
  });
});

describe('sanitizeFileName', () => {
  it('strips reserved characters and trims dots and spaces', () => {
    expect(sanitizeFileName('My: note? ')).toBe('My note');
    expect(sanitizeFileName('..hidden')).toBe('hidden');
    expect(sanitizeFileName('trailing... ')).toBe('trailing');
  });

  it('rejects empty names and reserved device names', () => {
    expect(() => sanitizeFileName('   ')).toThrow(InvalidPathError);
    expect(() => sanitizeFileName('CON')).toThrow(/reserved/);
    expect(() => sanitizeFileName('lpt1')).toThrow(/reserved/);
  });

  it('limits name length', () => {
    expect(sanitizeFileName('a'.repeat(300))).toHaveLength(120);
  });
});

describe('path helpers', () => {
  it('splits dirnames and basenames', () => {
    expect(dirnameOf('a/b/c.md')).toBe('a/b');
    expect(dirnameOf('c.md')).toBe('');
    expect(basenameOf('a/b/c.md')).toBe('c.md');
  });

  it('ignores hidden and tool directories', () => {
    expect(isIgnoredDirectory('.git')).toBe(true);
    expect(isIgnoredDirectory('node_modules')).toBe(true);
    expect(isIgnoredDirectory('notes')).toBe(false);
  });

  it('detects markdown files case-insensitively', () => {
    expect(isMarkdownFile('note.MD')).toBe(true);
    expect(isMarkdownFile('note.txt')).toBe(false);
  });

  it('derives titles', () => {
    expect(titleFromPath('a/b/note.md')).toBe('note');
  });

  it('suggests unique names', () => {
    const existing = new Set(['untitled.md', 'untitled 2.md']);
    expect(uniqueNoteName(existing)).toBe('Untitled 3.md');
    expect(uniqueNoteName(existing, 'Meeting')).toBe('Meeting.md');
  });
});
