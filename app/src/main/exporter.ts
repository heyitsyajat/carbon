import { BrowserWindow, dialog, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { EXPORT_EXTENSIONS, exportFileName, type ExportFormat } from '../shared/export';
import type { ExportRequest, ExportResult } from '../shared/ipc';

const FILTERS: Record<ExportFormat, Electron.FileFilter[]> = {
  markdown: [{ name: 'Markdown', extensions: ['md'] }],
  html: [{ name: 'HTML', extensions: ['html', 'htm'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
};

/**
 * Saves a note as Markdown, HTML or PDF. PDF rendering happens in an isolated,
 * invisible window so the app window is never disturbed.
 */
export async function exportNote(
  parent: BrowserWindow | null,
  request: ExportRequest,
): Promise<ExportResult | null> {
  const format: ExportFormat = ['markdown', 'html', 'pdf'].includes(request.format)
    ? request.format
    : 'markdown';
  const extension = EXPORT_EXTENSIONS[format];
  const defaultName = `${exportFileName(request.title)}.${extension}`;
  const options: Electron.SaveDialogOptions = {
    title: 'Export note',
    defaultPath: defaultName,
    filters: FILTERS[format],
    buttonLabel: 'Export',
  };
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return null;

  const target = result.filePath;
  if (format === 'markdown') {
    await fs.writeFile(target, request.markdown, 'utf8');
  } else if (format === 'html') {
    await fs.writeFile(target, request.html, 'utf8');
  } else {
    const pdf = await renderPdf(request.html);
    await fs.writeFile(target, pdf);
  }

  shell.showItemInFolder(target);
  return { path: target };
}

async function renderPdf(html: string): Promise<Buffer> {
  const printer = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
    },
  });
  try {
    await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // Give webfonts (none are remote) and layout a moment to settle.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return await printer.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.55, right: 0.55 },
    });
  } finally {
    if (!printer.isDestroyed()) printer.destroy();
  }
}

export function exportPathForFolder(folder: string, title: string, format: ExportFormat): string {
  return path.join(folder, `${exportFileName(title)}.${EXPORT_EXTENSIONS[format]}`);
}
