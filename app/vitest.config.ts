import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/main/vault.ts', 'src/main/settings.ts', 'src/shared/**/*.ts'],
      exclude: ['src/shared/types.ts', 'src/shared/ipc.ts'],
    },
  },
});
