#!/usr/bin/env node
/**
 * Dev launcher: starts Vite for the renderer, watches the Electron main/preload
 * bundles with esbuild, then boots Electron and restarts it when main changes.
 */
import { createServer } from 'vite';
import { context } from 'esbuild';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let child = null;
let restarting = false;

function startElectron(url) {
  child = spawn(electronBinary, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: 'development' },
  });
  child.on('exit', (code) => {
    if (!restarting && code !== 0) {
      process.exitCode = code ?? 0;
      process.exit();
    }
  });
}

function restartElectron(url) {
  if (!child) return;
  restarting = true;
  child.once('exit', () => {
    restarting = false;
    startElectron(url);
  });
  child.kill();
}

const server = await createServer({ configFile: path.join(root, 'vite.config.ts') });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}/`;
server.printUrls();

const plugin = {
  name: 'restart-electron',
  setup(build) {
    let initial = true;
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      if (initial) {
        initial = false;
        return;
      }
      process.stdout.write('[dev] main bundle changed — restarting Electron\n');
      restartElectron(url);
    });
  },
};

const base = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: 'inline',
  external: ['electron'],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  plugins: [plugin],
  logLevel: 'warning',
};

const contexts = await Promise.all([
  context({ ...base, entryPoints: [path.join(root, 'src/main/index.ts')], outfile: path.join(root, 'dist/main/index.js') }),
  context({
    ...base,
    entryPoints: [path.join(root, 'src/preload/index.ts')],
    outfile: path.join(root, 'dist/preload/index.js'),
  }),
]);

await Promise.all(contexts.map((c) => c.rebuild()));
await Promise.all(contexts.map((c) => c.watch()));
startElectron(url);

const shutdown = async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
  await server.close();
  if (child) child.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
