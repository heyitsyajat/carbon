#!/usr/bin/env node
/**
 * Captures real app screenshots for the landing page and README.
 *
 *   node scripts/make-demo-vault.mjs
 *   node scripts/capture-screenshots.mjs light
 *
 * Requires a built app (npm run build) and an Electron binary in
 * node_modules/electron/dist. Uses an isolated CARBON_USER_DATA profile.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, '../website/public/screenshots');
const theme = process.argv[2] === 'dark' ? 'dark' : 'light';
const quick = process.argv.includes('--quick');
const profile = path.join(os.tmpdir(), 'carbon-shots', 'profile');
const port = 9333;
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

mkdirSync(outDir, { recursive: true });

const child = spawn(electron, ['.', `--remote-debugging-port=${port}`], {
  cwd: root,
  env: { ...process.env, CARBON_USER_DATA: profile, SHOT_THEME: theme },
  stdio: 'inherit',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Electron is still starting.
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for the Electron debug target');
}

const target = await waitForTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let sequence = 0;

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve);
  socket.addEventListener('error', reject);
});

function send(method, params = {}) {
  sequence += 1;
  const id = sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return result.result?.value;
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate(`Boolean(${predicate})`)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function key(modifiers, key, code, keyCode) {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    modifiers,
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    modifiers,
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

async function capture(name) {
  process.stdout.write(`[shots] capturing ${name}…\n`);
  await sleep(450);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(outDir, `${name}-${theme}.png`);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  process.stdout.write(`[shots] ${path.relative(root, file)}\n`);
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });

  await waitFor("document.querySelector('.editor-host .cm-content')", 'the editor');
  await waitFor("document.querySelector('.explorer-tree .tree-file')", 'the file tree');
  await sleep(1200);

  await capture('workspace');
  process.stdout.write('[shots] workspace done\n');

  // Full-text search with a real query.
  await key(10, 'F', 'KeyF', 70); // Ctrl+Shift+F
  await waitFor("document.querySelector('.search-panel input')", 'the search panel');
  await send('Input.insertText', { text: 'launch' });
  await sleep(900);
  await capture('search');
  process.stdout.write('[shots] search done\n');
  await key(0, 'Escape', 'Escape', 27);
  await sleep(400);

  // Quick switcher.
  await key(2, 'o', 'KeyO', 79);
  await waitFor("document.querySelector('.palette-notes input')", 'the quick switcher');
  await evaluate("document.querySelector('.palette-notes input')?.focus()");
  await send('Input.insertText', { text: 'pri' });
  await sleep(500);
  await capture('quick-switcher');
  process.stdout.write('[shots] quick switcher done\n');
  await key(0, 'Escape', 'Escape', 27);
  await sleep(400);
  if (quick) {
    process.stdout.write('[shots] stopping after workspace and search\n');
    throw new Error('quick stop');
  }

  // Graph view.
  await key(2, 'g', 'KeyG', 71);
  await waitFor("document.querySelector('.graph-canvas svg')", 'the graph');
  await sleep(700);
  await capture('graph');
  process.stdout.write('[shots] graph done\n');
  await evaluate("document.querySelector('.graph-header .icon-button')?.click()");
  await sleep(400);

  // Settings → AI, to show that AI is optional and configurable.
  await key(2, ',', 'Comma', 188);
  await waitFor("document.querySelector('.settings-nav')", 'settings');
  await evaluate(
    "[...document.querySelectorAll('.settings-nav-item')].find((button) => button.textContent === 'AI')?.click()",
  );
  await sleep(500);
  await capture('settings-ai');
  process.stdout.write('[shots] settings done\n');
} catch (error) {
  if (error instanceof Error && error.message !== 'quick stop') throw error;
} finally {
  try {
    await send('Browser.close');
  } catch {
    // The socket may already be closing.
  }
  socket.close();
  child.kill();
  await sleep(600);
  process.exit(0);
}
