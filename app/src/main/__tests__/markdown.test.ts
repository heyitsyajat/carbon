import { describe, expect, it } from 'vitest';
import {
  buildSnippet,
  countWords,
  extractOutline,
  extractTags,
  parseFrontmatter,
  parseWikiLinks,
  readingMinutes,
  stripCodeFences,
  titleFromPath,
} from '../../shared/markdown';

describe('parseFrontmatter', () => {
  it('returns the body untouched when there is no frontmatter', () => {
    const result = parseFrontmatter('# Hello\n\nText');
    expect(result.raw).toBe('');
    expect(result.data).toEqual({});
    expect(result.body).toBe('# Hello\n\nText');
  });

  it('parses tags and scalar values', () => {
    const result = parseFrontmatter('---\ntags: [alpha, beta]\ntitle: My note\n---\nBody');
    expect(result.data.tags).toEqual(['alpha', 'beta']);
    expect(result.data.title).toBe('My note');
    expect(result.body).toBe('Body');
  });

  it('handles an unterminated block by treating it as content', () => {
    const input = '---\ntags: [a]\n# heading';
    expect(parseFrontmatter(input).body).toBe(input);
  });
});

describe('extractTags', () => {
  it('collects inline and frontmatter tags, lowercased and unique', () => {
    const tags = extractTags('---\ntags: [Work]\n---\nA #work note with #Ideas and #ideas again');
    expect(tags).toEqual(['ideas', 'work']);
  });

  it('ignores tags inside code fences and headings', () => {
    const content = '# Heading 1\n\n```\n#not-a-tag\n```\n\n`#inline-code` and #real';
    expect(extractTags(content)).toEqual(['real']);
  });

  it('ignores numeric-only tags such as issue references', () => {
    expect(extractTags('See #123 for details and #release-notes')).toEqual(['release-notes']);
  });

  it('supports nested tags', () => {
    expect(extractTags('#projects/carbon is active')).toEqual(['projects/carbon']);
  });
});

describe('parseWikiLinks', () => {
  it('resolves aliases and headings', () => {
    const links = parseWikiLinks('[[Note A]] [[Note B|alias]] [[Note C#Heading]] [[Note A]]');
    expect(links).toEqual(['Note A', 'Note B', 'Note C']);
  });

  it('ignores links inside code fences', () => {
    expect(parseWikiLinks('```\n[[Hidden]]\n```\n[[Visible]]')).toEqual(['Visible']);
  });
});

describe('stripCodeFences', () => {
  it('blanks fenced block contents while keeping line numbers stable', () => {
    expect(stripCodeFences('a\n```\nb\n```\nc')).toBe('a\n\n\n\nc');
    expect(stripCodeFences('# heading\n\n```\n# tag\n```')).not.toContain('# tag');
  });
});

describe('extractOutline', () => {
  it('extracts headings with levels and line numbers', () => {
    const outline = extractOutline('# One\n\ntext\n\n## Two\n### Three');
    expect(outline).toEqual([
      { level: 1, text: 'One', line: 0 },
      { level: 2, text: 'Two', line: 4 },
      { level: 3, text: 'Three', line: 5 },
    ]);
  });

  it('skips headings inside fenced code', () => {
    const outline = extractOutline('```\n# not a heading\n```\n# real');
    expect(outline.map((entry) => entry.text)).toEqual(['real']);
  });

  it('cleans inline markup from heading text', () => {
    expect(extractOutline('## **Bold** and [[Link|label]]').at(0)?.text).toBe('Bold and label');
  });
});

describe('buildSnippet', () => {
  it('finds the first match and its line', () => {
    const match = buildSnippet('first line\nsecond line with needle\nthird', 'needle');
    expect(match?.line).toBe(2);
    expect(match?.snippet).toContain('needle');
  });

  it('returns null when nothing matches', () => {
    expect(buildSnippet('nothing here', 'missing')).toBeNull();
  });
});

describe('countWords', () => {
  it('ignores frontmatter, fenced code and link syntax', () => {
    const content = '---\ntags: [a]\n---\nHello world [[Some note|alias]] here';
    expect(countWords(content)).toBe(4);
  });

  it('reports at least one minute of reading time', () => {
    expect(readingMinutes('tiny')).toBe(1);
  });
});

describe('titleFromPath', () => {
  it('strips folders and the extension', () => {
    expect(titleFromPath('notes/2026/day-one.md')).toBe('day-one');
    expect(titleFromPath('root.md')).toBe('root');
  });
});
