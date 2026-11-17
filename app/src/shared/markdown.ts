/**
 * Markdown helpers shared by the main process (search, link graph, tags) and
 * the renderer (preview, outline). Pure string functions — no I/O.
 */

export const WIKI_LINK_PATTERN = /\[\[([^\]\n]+?)\]\]/g;
export const INLINE_TAG_PATTERN = /(^|[\s(])#([\p{L}\p{N}_/-]+)/gu;
export const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
export const FENCE_PATTERN = /^\s*(```|~~~)/;

export interface Frontmatter {
  data: Record<string, string | string[]>;
  body: string;
  raw: string;
}

/** Splits a leading YAML-ish frontmatter block from the note body. */
export function parseFrontmatter(content: string): Frontmatter {
  const normalized = content.replace(/^\uFEFF/, '');
  if (!normalized.startsWith('---')) {
    return { data: {}, body: normalized, raw: '' };
  }
  const lines = normalized.split(/\r?\n/);
  const endIndex = lines.findIndex((line, index) => index > 0 && /^---\s*$/.test(line));
  if (endIndex === -1) {
    return { data: {}, body: normalized, raw: '' };
  }
  const raw = lines.slice(1, endIndex).join('\n');
  const data: Record<string, string | string[]> = {};
  for (const line of lines.slice(1, endIndex)) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const rawValue = match[2]!.trim().replace(/^["']|["']$/g, '');
    if (key === 'tags') {
      data[key] = rawValue
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean);
    } else {
      data[key] = rawValue;
    }
  }
  return { data, body: lines.slice(endIndex + 1).join('\n'), raw };
}

/** Removes fenced code blocks so tags/links inside code are not indexed. */
export function stripCodeFences(markdown: string): string {
  const out: string[] = [];
  let inside = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE_PATTERN.test(line)) {
      inside = !inside;
      out.push('');
      continue;
    }
    out.push(inside ? '' : line);
  }
  return out.join('\n');
}

/** Inline `#tags` plus frontmatter tags, deduplicated and lowercased. */
export function extractTags(content: string): string[] {
  const { data } = parseFrontmatter(content);
  const tags = new Set<string>();
  const front = data.tags;
  if (Array.isArray(front)) {
    for (const tag of front) tags.add(tag.toLowerCase());
  } else if (typeof front === 'string' && front.trim()) {
    for (const tag of front.split(/[,\s]+/)) {
      const clean = tag.replace(/^#/, '').trim().toLowerCase();
      if (clean) tags.add(clean);
    }
  }
  const body = stripCodeFences(parseFrontmatter(content).body);
  for (const match of body.matchAll(INLINE_TAG_PATTERN)) {
    const tag = match[2];
    if (tag && !/^\d+$/.test(tag)) tags.add(tag.toLowerCase());
  }
  return [...tags].sort();
}

/** Extracts wiki-link targets, ignoring aliases (`[[Note|alias]]`) and headings. */
export function parseWikiLinks(content: string): string[] {
  const body = stripCodeFences(parseFrontmatter(content).body);
  const targets = new Set<string>();
  for (const match of body.matchAll(WIKI_LINK_PATTERN)) {
    const raw = match[1] ?? '';
    const target = raw.split('|')[0]?.split('#')[0]?.trim();
    if (target) targets.add(target);
  }
  return [...targets];
}

/** Turns a note path into a display title (`notes/day-one.md` -> `day-one`). */
export function titleFromPath(notePath: string): string {
  const file = notePath.replace(/\\/g, '/').split('/').pop() ?? notePath;
  return file.replace(/\.md$/i, '');
}

export function notePathToLink(notePath: string): string {
  return notePath.replace(/\.md$/i, '');
}

export function normalizeLinkTarget(target: string): string {
  return target
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase();
}

export interface OutlineEntry {
  level: number;
  text: string;
  line: number;
}

export function extractOutline(content: string): OutlineEntry[] {
  const body = parseFrontmatter(content).body;
  const items: OutlineEntry[] = [];
  let insideFence = false;
  body.split(/\r?\n/).forEach((line, index) => {
    if (FENCE_PATTERN.test(line)) {
      insideFence = !insideFence;
      return;
    }
    if (insideFence) return;
    const match = HEADING_PATTERN.exec(line);
    if (!match) return;
    items.push({
      level: match[1]!.length,
      text: match[2]!.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/[*_`]/g, ''),
      line: index,
    });
  });
  return items;
}

/** A short plain-text excerpt around a search match. */
export function buildSnippet(content: string, query: string, radius = 60): { line: number; snippet: string } | null {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return null;
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + query.length + radius);
  const before = content.slice(0, index);
  const line = before.split('\n').length;
  const snippet = `${start > 0 ? '…' : ''}${content
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim()}${end < content.length ? '…' : ''}`;
  return { line, snippet };
}

export function countWords(content: string): number {
  const plain = parseFrontmatter(content)
    .body.replace(/```[\s\S]*?```/g, ' ')
    .replace(WIKI_LINK_PATTERN, (_match, target: string, alias?: string) => alias ?? target)
    .replace(/[#>*_`~[\]()-]/g, ' ');
  const words = plain.split(/\s+/).filter(Boolean);
  return words.length;
}

export function readingMinutes(content: string): number {
  return Math.max(1, Math.round(countWords(content) / 220));
}
