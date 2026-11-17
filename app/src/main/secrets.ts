import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SecretKey, SecretStatus } from '../shared/types';

const KEYS: SecretKey[] = ['openai', 'anthropic', 'custom'];
const SECRETS_VERSION = 1;

interface SecretsFile {
  version: number;
  entries: Partial<Record<SecretKey, string>>;
}

/**
 * Stores provider API keys encrypted with Electron safeStorage (DPAPI on
 * Windows). Plaintext keys only ever exist in memory, and never reach the
 * renderer or the settings file.
 */
export class SecretStore {
  private entries: Partial<Record<SecretKey, string>> = {};
  private loaded = false;

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as SecretsFile;
      if (parsed && typeof parsed === 'object' && parsed.entries) {
        this.entries = parsed.entries;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[secrets] could not read the secret store:', (error as Error).message);
      }
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: SecretsFile = { version: SECRETS_VERSION, entries: this.entries };
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempPath, this.filePath);
  }

  static isAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  async status(): Promise<SecretStatus> {
    await this.load();
    return {
      openai: Boolean(this.entries.openai),
      anthropic: Boolean(this.entries.anthropic),
      custom: Boolean(this.entries.custom),
    };
  }

  async set(key: SecretKey, value: string): Promise<SecretStatus> {
    if (!KEYS.includes(key)) throw new Error('Unknown secret slot.');
    await this.load();
    const trimmed = value.trim();
    if (!trimmed) return this.clear(key);
    if (!SecretStore.isAvailable()) {
      throw new Error(
        'Windows secure storage is unavailable, so the key was not saved. Restart Carbon and try again.',
      );
    }
    if (!app.isReady()) throw new Error('Secure storage is not ready yet. Try again in a moment.');
    const encrypted = safeStorage.encryptString(trimmed);
    this.entries[key] = encrypted.toString('base64');
    await this.persist();
    return this.status();
  }

  async clear(key: SecretKey): Promise<SecretStatus> {
    await this.load();
    delete this.entries[key];
    await this.persist();
    return this.status();
  }

  async get(key: SecretKey): Promise<string | undefined> {
    await this.load();
    const stored = this.entries[key];
    if (!stored) return undefined;
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'));
    } catch (error) {
      console.warn('[secrets] could not decrypt key; it may have been created by another Windows user.', (error as Error).message);
      return undefined;
    }
  }
}
