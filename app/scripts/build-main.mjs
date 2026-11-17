#!/usr/bin/env node
/**
 * Builds the Electron main and preload bundles with esbuild.
 * Used by `npm run build`, `npm run dev` (watch mode) and the dev launcher.
 */
import { build, context } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  external: ['electron'],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  logLevel: 'info',
};

const targets = [
  { entryPoints: [path.join(root, 'src/main/index.ts')], outfile: path.join(root, 'dist/main/index.js') },
  {
    entryPoints: [path.join(root, 'src/preload/index.ts')],
    outfile: path.join(root, 'dist/preload/index.js'),
  },
];

if (watch) {
  const contexts = await Promise.all(targets.map((t) => context({ ...shared, ...t })));
  await Promise.all(contexts.map((c) => c.watch()));
  process.stdout.write('[build] watching main + preload\n');
} else {
  await Promise.all(targets.map((t) => build({ ...shared, ...t })));
  process.stdout.write('[build] main + preload built\n');
}
