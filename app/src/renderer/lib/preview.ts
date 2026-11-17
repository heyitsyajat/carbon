import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { parseFrontmatter } from '@shared/markdown';

marked.setOptions({ gfm: true, breaks: false });

export interface RenderedNote {
  html: string;
  headings: Array<{ id: string; level: number; text: string }>;
}

const WIKI_LINK = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
const TAG = /(^|[\s(])#([\p{L}\p{N}_/-]+)/gu;

/**
 * Renders Markdown to sanitized HTML, turning `[[wiki links]]` into in-app
 * links and `#tags` into clickable chips. All output is passed through
 * DOMPurify before it reaches the DOM.
 */
export function renderNote(
  content: string,
  options: { notePaths: Set<string>; noteTitles: Map<string, string> },
): RenderedNote {
  const { body } = parseFrontmatter(content);
  const rawHtml = marked.parse(body, { async: false });
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // Stable heading ids so the outline can scroll to them.
  const headings: RenderedNote['headings'] = [];
  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((element, index) => {
    const id = `heading-${index}`;
    element.id = id;
    headings.push({
      id,
      level: Number(element.tagName.slice(1)),
      text: element.textContent ?? '',
    });
  });

  const targets: Array<{ text: string; node: Text }> = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    if (text.includes('[[') || text.includes('#')) targets.push({ text, node: node as Text });
  }

  for (const { node } of targets) {
    const text = node.textContent ?? '';
    if (!text.includes('[[') && !text.includes('#')) continue;
    const html = text
      .replace(WIKI_LINK, (_match, rawTarget: string, alias?: string) => {
        const target = rawTarget.split('#')[0]?.trim() ?? '';
        const key = target.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '').toLowerCase();
        const known =
          options.notePaths.has(`${key}.md`) ||
          [...options.noteTitles.values()].some((value) => value.toLowerCase() === key);
        const label = escapeHtml((alias ?? target).trim());
        const display = target.includes('/') ? label : label;
        return `<a href="#" class="wiki-link${known ? '' : ' is-missing'}" data-target="${escapeHtml(target)}">${display}</a>`;
      })
      .replace(TAG, (_match, prefix: string, tag: string) => {
        if (/^\d+$/.test(tag)) return `${prefix}#${tag}`;
        return `${prefix}<a href="#" class="tag-chip" data-tag="${escapeHtml(tag.toLowerCase())}">#${escapeHtml(tag)}</a>`;
      });
    if (html !== text) {
      const fragment = document.createElement('span');
      fragment.innerHTML = html;
      node.replaceWith(fragment);
    }
  }

  container.querySelectorAll('a[href^="http"]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noreferrer noopener');
  });

  const html = DOMPurify.sanitize(container.innerHTML, {
    ADD_ATTR: ['data-target', 'data-tag', 'target', 'rel', 'checked', 'disabled', 'type', 'id'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'style'],
  });

  return { html, headings };
}

/** Neutralises user text before it is placed in generated HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Suggests notes while typing a wiki link inside the editor. */
export function completeWikiLink(query: string, notes: Array<{ path: string; title: string }>): string[] {
  const needle = query.toLowerCase();
  return notes
    .filter(
      (note) =>
        note.title.toLowerCase().includes(needle) ||
        note.path.toLowerCase().includes(needle),
    )
    .slice(0, 8)
    .map((note) => note.path.replace(/\.md$/i, ''));
}
