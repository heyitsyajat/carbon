import { parseFrontmatter } from './markdown';

export type ExportFormat = 'markdown' | 'html' | 'pdf';

export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  markdown: 'md',
  html: 'html',
  pdf: 'pdf',
};

/** Strips characters Windows rejects in file names. */
export function exportFileName(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return cleaned || 'Untitled';
}

/** Markdown export: keeps the note as written, minus a leading BOM. */
export function markdownForExport(content: string): string {
  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return clean.endsWith('\n') ? clean : `${clean}\n`;
}

/**
 * Wraps rendered note HTML in a self-contained document with print-friendly
 * typography. Fonts fall back to the reader's system fonts — no remote assets.
 */
export function noteToHtmlDocument(options: {
  title: string;
  bodyHtml: string;
  includeFrontmatter?: boolean;
  content: string;
}): string {
  const escapedTitle = options.title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const frontmatter = parseFrontmatter(options.content);
  const meta = Object.entries(frontmatter.data)
    .filter(([key]) => key !== 'tags')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' · ');
  const tags = Array.isArray(frontmatter.data.tags)
    ? frontmatter.data.tags.join(', ')
    : frontmatter.data.tags;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapedTitle}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    padding: 56px 28px 96px;
    max-width: 720px;
    background: #fdf7f3;
    color: #2a151a;
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
    font-size: 17px;
    line-height: 1.72;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
    font-weight: 600;
    line-height: 1.25;
    margin: 2em 0 0.6em;
  }
  h1 { font-size: 2.1em; margin-top: 0; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.2em; }
  p { margin: 0 0 1em; }
  a { color: #7a1f33; }
  hr { border: none; border-top: 1px solid #ecd9cd; margin: 2.4em 0; }
  blockquote {
    margin: 0 0 1.2em;
    padding-left: 1em;
    border-left: 3px solid #e2c8ba;
    color: #63424a;
    font-style: italic;
  }
  code {
    font-family: 'Cascadia Mono', Consolas, monospace;
    font-size: 0.85em;
    background: #f6ece4;
    padding: 0.12em 0.34em;
    border-radius: 3px;
  }
  pre {
    background: #f6ece4;
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid #ecd9cd;
  }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 1.2em; font-size: 0.94em; }
  th, td { border: 1px solid #ecd9cd; padding: 6px 10px; text-align: left; }
  th { background: #fbf0e9; }
  img { max-width: 100%; }
  .meta {
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #8a6a70;
    border-bottom: 1px solid #ecd9cd;
    padding-bottom: 14px;
    margin-bottom: 32px;
  }
  .footnote { margin-top: 56px; font-size: 12px; color: #8a6a70; font-family: 'Inter', sans-serif; }
  @media print {
    body { background: #fff; padding: 0; max-width: none; font-size: 12pt; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
${options.includeFrontmatter || meta || tags ? `<div class="meta">${[meta, tags ? `tags: ${tags}` : ''].filter(Boolean).join(' · ')}</div>` : ''}
<article class="note">${options.bodyHtml}</article>
<div class="footnote">Exported from Carbon</div>
</body>
</html>
`;
}
