import type { AIAction, ChatMessage } from '../types';
import { truncate } from './errors';

const BASE_SYSTEM_PROMPT = [
  'You are the writing assistant inside Carbon, a local-first Markdown notes app.',
  'Return only the requested content as GitHub-flavoured Markdown. Do not wrap the whole answer in a code fence.',
  'Do not add a preamble, an apology, or a closing offer of further help.',
  'Preserve the author’s voice, terminology and formatting unless asked to change them.',
  'Never invent facts, names, dates or links.',
].join(' ');

export const ACTION_LABELS: Record<AIAction, string> = {
  chat: 'Ask about this note',
  continue: 'Continue writing',
  rewrite: 'Rewrite',
  summarize: 'Summarize',
  bullets: 'Make bullets',
  table: 'Make a table',
  'action-items': 'Extract action items',
  meeting: 'Summarize a transcript',
  custom: 'Custom instruction',
};

export const ACTION_HINTS: Record<AIAction, string> = {
  chat: 'Ask a question; the note is shared as context.',
  continue: 'Writes the next few paragraphs in your voice.',
  rewrite: 'Improves clarity and flow of the selection.',
  summarize: 'A tight summary you can paste at the top of the note.',
  bullets: 'Turns prose into a scannable list.',
  table: 'Turns structured prose into a Markdown table.',
  'action-items': 'Pulls out owners, tasks and follow-ups.',
  meeting: 'Turns a meeting transcript into a summary and next steps.',
  custom: 'Describe what you want, e.g. “tighten the intro”.',
};

export interface ActionContext {
  action: AIAction;
  noteTitle?: string;
  selection?: string;
  noteContent?: string;
  extraNotes?: Array<{ title: string; content: string }>;
  instruction?: string;
  /** Max characters of note content per note; keep prompts bounded. */
  maxNoteChars?: number;
}

const ACTION_INSTRUCTIONS: Record<Exclude<AIAction, 'chat' | 'custom' | 'meeting'>, string> = {
  continue:
    'Continue the note from exactly where the author stopped. Write 2–4 sentences or a short paragraph that follows naturally. Do not repeat the last sentence, do not summarise, and do not add headings.',
  rewrite:
    'Rewrite the supplied text so it is clearer and tighter while keeping the same meaning and point of view. Keep Markdown formatting. Return only the rewritten text.',
  summarize:
    'Summarise the supplied note in 3–6 bullet points (or a short paragraph if it is very short). Start with the single most important point.',
  bullets:
    'Convert the supplied text into a tight Markdown bullet list. Keep concrete details, group related points, and use at most two levels of nesting. Return only the list.',
  table:
    'Convert the supplied text into a single Markdown table. Choose at most four meaningful columns, add a header row, and do not invent data that is not present.',
  'action-items':
    'Extract the action items from the supplied text as a Markdown checklist ("- [ ] …"). Add an owner or due date in bold when the text states one. If there are none, write "No action items found."',
};

const ACTION_USER_PROMPTS: Record<Exclude<AIAction, 'chat' | 'custom' | 'meeting'>, string> = {
  continue: 'Continue this note:',
  rewrite: 'Rewrite this text:',
  summarize: 'Summarise this note:',
  bullets: 'Turn this into bullets:',
  table: 'Turn this into a table:',
  'action-items': 'Extract the action items from this note:',
};

export function buildSystemPrompt(customPrompt?: string): string {
  const extra = (customPrompt ?? '').trim();
  return extra ? `${BASE_SYSTEM_PROMPT}\n\nAdditional standing instructions from the author:\n${extra}` : BASE_SYSTEM_PROMPT;
}

/** Builds the chat messages for an AI action. Pure and unit tested. */
export function buildMessages(context: ActionContext, systemPrompt?: string): ChatMessage[] {
  const maxChars = context.maxNoteChars ?? 12_000;
  const messages: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(systemPrompt) }];

  const noteSections: string[] = [];
  if (context.noteContent) {
    const title = context.noteTitle ?? 'Untitled note';
    noteSections.push(`<note title="${escapeAttribute(title)}">\n${truncate(context.noteContent, maxChars)}\n</note>`);
  }
  for (const note of context.extraNotes ?? []) {
    noteSections.push(
      `<note title="${escapeAttribute(note.title)}">\n${truncate(note.content, Math.min(maxChars, 6000))}\n</note>`,
    );
  }

  if (context.action === 'chat') {
    const parts = [context.instruction?.trim() || 'What are the key ideas in this note?'];
    if (noteSections.length > 0) parts.push('', 'Notes:', ...noteSections);
    messages.push({ role: 'user', content: parts.join('\n') });
    return messages;
  }

  if (context.action === 'meeting') {
    const transcript = context.selection?.trim() || context.noteContent || '';
    messages.push({
      role: 'user',
      content: [
        'Turn this meeting transcript into durable notes. Return exactly two Markdown sections:',
        '',
        '## Summary',
        '4–6 bullets covering only what was actually said.',
        '',
        '## Action items',
        'A checklist (`- [ ]`) with an owner in bold where one is named. If nothing was agreed, write “No action items found.”',
        '',
        'Do not invent attendees, decisions or dates.',
        '',
        'Transcript:',
        truncate(transcript, maxChars),
      ].join('\n'),
    });
    return messages;
  }

  if (context.action === 'custom') {
    const instruction = context.instruction?.trim();
    const parts = [
      instruction ? `Task: ${instruction}` : 'Improve this note.',
      'Work on the text supplied below and return only the result.',
    ];
    const target = context.selection?.trim() || context.noteContent;
    if (target) parts.push('', 'Text:', truncate(target, maxChars));
    if (context.selection && noteSections.length > 0) parts.push('', 'Full note for context:', ...noteSections);
    messages.push({ role: 'user', content: parts.join('\n') });
    return messages;
  }

  const instruction = ACTION_INSTRUCTIONS[context.action];
  const userParts = [instruction, ''];

  if (context.action === 'continue') {
    userParts.push(ACTION_USER_PROMPTS.continue);
    userParts.push('', truncate(context.selection?.trim() || context.noteContent || '', maxChars));
  } else if (context.selection?.trim()) {
    userParts.push(ACTION_USER_PROMPTS[context.action]);
    userParts.push('', truncate(context.selection.trim(), maxChars));
    if (context.extraNotes?.length) {
      userParts.push('', 'Related notes for context:', ...noteSections);
    }
  } else {
    userParts.push(ACTION_USER_PROMPTS[context.action]);
    userParts.push('', noteSections.join('\n\n') || '(empty note)');
  }

  messages.push({ role: 'user', content: userParts.join('\n') });
  return messages;
}

/** A short human readable summary of the request, shown in the AI panel. */
export function describeRequest(context: ActionContext): string {
  const notes = 1 + (context.extraNotes?.length ?? 0);
  const scope = context.selection?.trim()
    ? 'selection'
    : notes > 1
      ? `${notes} notes`
      : 'current note';
  if (context.action === 'custom' && context.instruction?.trim()) {
    return `${truncate(context.instruction.trim(), 80)} · ${scope}`;
  }
  return `${ACTION_LABELS[context.action]} · ${scope}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;');
}
