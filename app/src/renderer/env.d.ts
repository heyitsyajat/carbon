import type { CarbonApi } from '@shared/ipc';

declare global {
  interface Window {
    carbon: CarbonApi;
  }
}

export {};
