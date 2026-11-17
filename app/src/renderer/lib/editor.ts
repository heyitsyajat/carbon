import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import type { EditorHandle, EditorSelection } from './editor-bridge';

export interface CreateEditorOptions {
  parent: HTMLElement;
  doc: string;
  dark: boolean;
  fontSize: number;
  showLineNumbers: boolean;
  onChange: (doc: string) => void;
  onSelectionChange: (selection: EditorSelection) => void;
  onSave: () => void;
}

export interface EditorController extends EditorHandle {
  view: EditorView;
  setDoc(doc: string): void;
  setTheme(dark: boolean): void;
  setFontSize(size: number): void;
  setLineNumbers(show: boolean): void;
  destroy(): void;
}

/* Colours come from CSS custom properties so both themes stay in one place. */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.42em', fontWeight: '600', color: 'var(--ink)' },
  { tag: tags.heading2, fontSize: '1.24em', fontWeight: '600', color: 'var(--ink)' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '600', color: 'var(--ink)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--ink-soft)' },
  { tag: tags.strong, fontWeight: '650', color: 'var(--ink)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--ink)' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--ink-faint)' },
  { tag: tags.quote, color: 'var(--ink-muted)', fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--accent)', background: 'var(--code-bg)' },
  { tag: tags.list, color: 'var(--accent-2-hover)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--ink-faint)' },
  { tag: tags.processingInstruction, color: 'var(--ink-faint)' },
  { tag: tags.contentSeparator, color: 'var(--line-strong)' },
]);

function baseTheme(dark: boolean): ReturnType<typeof EditorView.theme> {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: 'var(--ink)',
        fontSize: 'var(--editor-font-size, 17px)',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-editor)',
        lineHeight: '1.72',
        padding: '26px 0 40vh',
      },
      '.cm-content': {
        caretColor: 'var(--accent)',
        padding: '0',
      },
      '.cm-line': { padding: '0 28px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: 'var(--ink-faint)',
        fontSize: '0.72em',
        paddingLeft: '10px',
      },
      '.cm-activeLine': {
        backgroundColor: dark ? 'rgba(244, 165, 138, 0.035)' : 'rgba(122, 31, 51, 0.028)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'transparent' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--selection)',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'var(--accent-soft)',
        color: 'inherit',
      },
      '.cm-selectionMatch': { backgroundColor: 'var(--surface-selected)' },
      '.cm-searchMatch': { backgroundColor: 'var(--accent-2-soft)' },
      '.cm-panels': { backgroundColor: 'var(--surface-panel)', color: 'inherit' },
      '.cm-textfield': {
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--line)',
        borderRadius: '5px',
        color: 'inherit',
      },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--line)',
        borderRadius: '5px',
        color: 'inherit',
      },
      '.cm-placeholder': { color: 'var(--ink-faint)' },
      '.cm-tooltip': {
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--line)',
        borderRadius: '7px',
      },
    },
    { dark },
  );
}

export function createEditor(options: CreateEditorOptions): EditorController {
  const themeCompartment = new Compartment();
  const lineNumberCompartment = new Compartment();
  const fontCompartment = new Compartment();

  const selectionOf = (state: EditorState): EditorSelection => {
    const range = state.selection.main;
    return {
      text: state.sliceDoc(range.from, range.to),
      from: range.from,
      to: range.to,
      empty: range.empty,
    };
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) options.onChange(update.state.doc.toString());
    if (update.selectionSet) options.onSelectionChange(selectionOf(update.state));
  });

  const state = EditorState.create({
    doc: options.doc,
    extensions: [
      lineNumberCompartment.of(options.showLineNumbers ? lineNumbers() : []),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      keymap.of([
        { key: 'Mod-s', preventDefault: true, run: () => (options.onSave(), true) },
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      markdown(),
      EditorView.lineWrapping,
      placeholder('Start writing… Markdown and [[wiki links]] are supported.'),
      themeCompartment.of([baseTheme(options.dark), syntaxHighlighting(markdownHighlight)]),
      fontCompartment.of(EditorView.theme({ '&': { fontSize: `${options.fontSize}px` } })),
      updateListener,
      EditorView.contentAttributes.of({ spellcheck: 'true', 'aria-label': 'Note editor' }),
    ],
  });

  const view = new EditorView({ state, parent: options.parent });

  return {
    view,
    focus() {
      view.focus();
    },
    getSelection() {
      return selectionOf(view.state);
    },
    insert(text) {
      const range = view.state.selection.main;
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: { anchor: range.from + text.length },
      });
      view.focus();
    },
    replaceSelection(text) {
      const range = view.state.selection.main;
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: { anchor: range.from + text.length },
      });
      view.focus();
    },
    insertAtLine(text, line) {
      const total = view.state.doc.lines;
      const target = view.state.doc.line(Math.min(Math.max(1, line), total));
      view.dispatch({
        changes: { from: target.to, insert: text },
        selection: { anchor: target.to + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    scrollToLine(line) {
      const target = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
      view.dispatch({
        selection: { anchor: target.from },
        effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 80 }),
      });
      view.focus();
    },
    setDoc(doc) {
      if (doc === view.state.doc.toString()) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: doc },
      });
    },
    setTheme(dark) {
      view.dispatch({
        effects: themeCompartment.reconfigure([baseTheme(dark), syntaxHighlighting(markdownHighlight)]),
      });
    },
    setFontSize(size) {
      view.dispatch({
        effects: fontCompartment.reconfigure(EditorView.theme({ '&': { fontSize: `${size}px` } })),
      });
    },
    setLineNumbers(show) {
      view.dispatch({
        effects: lineNumberCompartment.reconfigure(show ? lineNumbers() : []),
      });
    },
    destroy() {
      view.destroy();
    },
  };
}
