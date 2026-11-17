/** Turns technical failures into short messages with a next step. */

const FRIENDLY: Array<{ test: RegExp; message: (context: string) => string }> = [
  {
    test: /ENOENT|no such file|not found/i,
    message: (context) => `${context} could not be found. It may have been moved or renamed outside Carbon.`,
  },
  {
    test: /EACCES|EPERM|permission denied|access is denied/i,
    message: () =>
      'Windows blocked access to that file. Check that it is not open in another app, or move the vault out of a protected folder.',
  },
  {
    test: /EEXIST|already exists/i,
    message: () => 'A file with that name already exists. Choose a different name.',
  },
  {
    test: /EISDIR|is a directory/i,
    message: () => 'That is a folder, not a note. Pick a Markdown file instead.',
  },
  {
    test: /ENOSPC|disk full/i,
    message: () => 'The disk is full. Free up some space, then try again.',
  },
  {
    test: /EBUSY|locked|resource busy/i,
    message: () => 'That file is locked by another program. Close it and try again.',
  },
  {
    test: /outside the vault|escapes|Absolute paths|Invalid path|Path is empty|Path contains/i,
    message: () => 'That location is outside the vault. Only files inside your vault folder can be used.',
  },
  {
    test: /ECONNREFUSED|not accepting connections/i,
    message: () => 'Nothing is listening at that address. Start the local server, then test the connection again.',
  },
  {
    test: /ENOTFOUND|EAI_AGAIN|getaddrinfo/i,
    message: () => 'That address could not be found. Check the spelling and your internet connection.',
  },
  {
    test: /network|fetch failed|timed out|ETIMEDOUT/i,
    message: () => 'The request did not reach its destination. Check your connection and try again.',
  },
];

export function friendlyError(error: unknown, context = 'The file'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  for (const entry of FRIENDLY) {
    if (entry.test.test(raw)) return entry.message(context);
  }
  const trimmed = raw.replace(/^Error:\s*/i, '').trim();
  if (!trimmed) return `${context} could not be completed. Try again.`;
  if (trimmed.length > 240) return `${context} could not be completed. Try again, and check the logs if it keeps happening.`;
  return trimmed;
}
