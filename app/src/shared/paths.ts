/**
 * Path helpers for vault-relative note paths. These guard every filesystem
 * access in the main process against traversal outside the vault root.
 */

export const NOTE_EXTENSION = '.md';
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.obsidian',
  '.trash',
  '$recycle.bin',
  'system volume information',
]);

export class InvalidPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPathError';
  }
}

/** Converts a user or OS supplied path to a normalised POSIX relative path. */
export function toRelativePath(input: string): string {
  if (typeof input !== 'string') throw new InvalidPathError('Path must be a string.');
  if (input.includes('\0')) throw new InvalidPathError('Path contains a null byte.');
  const posix = input.replace(/\\/g, '/').trim();
  if (/^[a-zA-Z]:\//.test(posix) || posix.startsWith('/')) {
    throw new InvalidPathError('Absolute paths are not allowed inside a vault.');
  }
  const segments = posix.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.some((segment) => segment === '..')) {
    throw new InvalidPathError('Paths cannot point outside the vault.');
  }
  if (segments.length === 0) throw new InvalidPathError('Path is empty.');
  return segments.join('/');
}

/** Ensures a path ends with `.md` and is otherwise a normalised relative path. */
export function toNotePath(input: string): string {
  const rel = toRelativePath(input);
  return /\.md$/i.test(rel) ? rel : `${rel}${NOTE_EXTENSION}`;
}

export function dirnameOf(relPath: string): string {
  const parts = toRelativePath(relPath).split('/');
  parts.pop();
  return parts.join('/');
}

export function basenameOf(relPath: string): string {
  const parts = toRelativePath(relPath).split('/');
  return parts[parts.length - 1] ?? '';
}

/** True when a directory name should be skipped while scanning a vault. */
export function isIgnoredDirectory(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRECTORIES.has(name.toLowerCase());
}

export function isMarkdownFile(name: string): boolean {
  return /\.md$/i.test(name);
}

/** Rejects characters Windows cannot store in a filename. */
export function sanitizeFileName(name: string): string {
  const withoutControlChars = [...name]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
  const cleaned = withoutControlChars
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim();
  if (!cleaned) throw new InvalidPathError('Name cannot be empty.');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    throw new InvalidPathError(`"${cleaned}" is a reserved Windows file name.`);
  }
  return cleaned.slice(0, 120);
}

/** Validates that `candidate` resolves inside `root`. Returns the absolute path. */
export function resolveWithinRoot(root: string, relPath: string): string {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const absolute = `${normalizedRoot}/${toRelativePath(relPath)}`;
  const rootLower = normalizedRoot.toLowerCase();
  const absoluteLower = absolute.toLowerCase();
  if (absoluteLower !== rootLower && !absoluteLower.startsWith(`${rootLower}/`)) {
    throw new InvalidPathError('Resolved path escapes the vault.');
  }
  return absolute;
}

/** Suggests a non-colliding filename for a new note. */
export function uniqueNoteName(existing: Set<string>, base = 'Untitled'): string {
  let candidate = `${base}.md`;
  let counter = 1;
  while (existing.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${base} ${counter}.md`;
  }
  return candidate;
}
