/**
 * Small fuzzy matcher used by the quick switcher and the command palette.
 * Matches in order, scoring consecutive runs, word starts and early matches.
 */

export interface FuzzyMatch {
  score: number;
  /** Indices of matched characters in the haystack, for highlighting. */
  indices: number[];
}

const WORD_BOUNDARY = /[\s\-_/.]/;

export function fuzzyMatch(haystack: string, needle: string): FuzzyMatch | null {
  const text = haystack.toLowerCase();
  const query = needle.trim().toLowerCase();
  if (!query) return { score: 1, indices: [] };
  if (query.length > text.length) return null;

  let score = 0;
  let index = 0;
  let previous = -2;
  const indices: number[] = [];

  for (const character of query) {
    if (character === ' ') continue;
    const found = text.indexOf(character, index);
    if (found === -1) return null;

    const isConsecutive = found === previous + 1;
    const isWordStart = found === 0 || WORD_BOUNDARY.test(text[found - 1] ?? '');
    score += 10;
    if (isConsecutive) score += 12;
    if (isWordStart) score += 18;
    if (found === 0) score += 8;
    score -= Math.min(found - index, 12);

    indices.push(found);
    previous = found;
    index = found + 1;
  }

  // Prefer matches that cover more of the haystack and start earlier.
  score += Math.max(0, 12 - Math.floor(text.length / 12));
  if (text.startsWith(query)) score += 40;
  return { score, indices };
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
  indices: number[];
}

/** Ranks items by a set of candidate strings (title, path, tags). */
export function fuzzyRank<T>(
  items: T[],
  query: string,
  keys: (item: T) => string[],
  limit = 50,
): FuzzyResult<T>[] {
  const results: FuzzyResult<T>[] = [];
  for (const item of items) {
    let best: FuzzyMatch | null = null;
    for (const key of keys(item)) {
      const match = fuzzyMatch(key, query);
      if (match && (!best || match.score > best.score)) best = match;
    }
    if (best) results.push({ item, score: best.score, indices: best.indices });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
