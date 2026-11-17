/**
 * Note templates and date-aware names. Templates use `{{variable}}` tokens:
 * `{{title}}`, `{{date}}`, `{{time}}`, `{{date:YYYY-MM-DD}}`, `{{time:HH:mm}}`.
 */

export const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-z]+)(?::([^}]+))?\s*\}\}/gi;

export const DEFAULT_DAILY_TEMPLATE = `---
tags: [daily]
date: {{date:YYYY-MM-DD}}
---

# {{date:dddd, D MMMM YYYY}}

## Focus
- 

## Notes


## Wins

`;

export const DEFAULT_MEETING_TEMPLATE = `---
type: meeting
tags: [meeting]
date: {{date:YYYY-MM-DD}}
---

# {{title}} — {{date:ddd D MMM}}

**Attendees:** 
**Context:** 

## Notes
- {{time}} 

## Decisions

## Action items
- [ ] 

## Follow-up

`;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Formats a date using the small token set supported by Carbon. */
export function formatDatePattern(pattern: string, date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const tokens: Array<[string, string]> = [
    ['YYYY', String(date.getFullYear())],
    ['YY', String(date.getFullYear()).slice(-2)],
    ['MMMM', MONTHS[date.getMonth()] ?? ''],
    ['MMM', (MONTHS[date.getMonth()] ?? '').slice(0, 3)],
    ['MM', pad(date.getMonth() + 1)],
    ['M', String(date.getMonth() + 1)],
    ['DD', pad(date.getDate())],
    ['D', String(date.getDate())],
    ['dddd', WEEKDAYS[date.getDay()] ?? ''],
    ['ddd', (WEEKDAYS[date.getDay()] ?? '').slice(0, 3)],
    ['HH', pad(date.getHours())],
    ['H', String(date.getHours())],
    ['mm', pad(date.getMinutes())],
    ['ss', pad(date.getSeconds())],
  ];
  let output = '';
  let index = 0;
  while (index < pattern.length) {
    const token = tokens.find(([key]) => pattern.startsWith(key, index));
    if (token) {
      output += token[1];
      index += token[0].length;
    } else {
      output += pattern[index];
      index += 1;
    }
  }
  return output;
}

export interface TemplateVariables {
  title: string;
  date?: Date;
}

/** Replaces every supported variable in a template. Unknown variables are kept. */
export function resolveTemplate(template: string, variables: TemplateVariables): string {
  const date = variables.date ?? new Date();
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (match, name: string, format?: string) => {
    const key = name.toLowerCase();
    if (key === 'title') return variables.title;
    if (key === 'date') return formatDatePattern(format?.trim() || 'YYYY-MM-DD', date);
    if (key === 'time') return formatDatePattern(format?.trim() || 'HH:mm', date);
    return match;
  });
}

/** Vault-relative path for the daily note of a given date. */
export function dailyNotePath(folder: string, format: string, date: Date): string {
  const safeFolder = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const name = formatDatePattern(format || 'YYYY-MM-DD', date).replace(/[<>:"/\\|?*]/g, '-');
  return safeFolder ? `${safeFolder}/${name}.md` : `${name}.md`;
}

export function meetingNotePath(folder: string, date: Date, title: string): string {
  const safeFolder = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const stamp = formatDatePattern('YYYY-MM-DD HHmm', date);
  const cleanTitle = title.trim().replace(/[<>:"/\\|?*]/g, '').slice(0, 80) || 'Meeting';
  const name = `${stamp} — ${cleanTitle}`;
  return safeFolder ? `${safeFolder}/${name}.md` : `${name}.md`;
}

export function templateVariablesList(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const name = match[1]?.toLowerCase();
    if (name === 'title' || name === 'date' || name === 'time') found.add(name);
  }
  return [...found];
}
