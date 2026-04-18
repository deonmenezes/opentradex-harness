/**
 * OS-keychain-backed secret store for the desktop app.
 *
 * Uses Electron's `safeStorage` (which wraps Keychain on macOS, DPAPI on
 * Windows, and libsecret on Linux). Falls back to a 0600 plaintext file when
 * encryption isn't available (e.g. fresh Linux install with no libsecret,
 * dev unit tests, or running outside Electron entirely).
 *
 * File format v2 at ~/.opentradex/ai-keys.json:
 * {
 *   "version": 2,
 *   "keys": {
 *     "openai": { "enc": true, "v": "<base64 ciphertext>" },
 *     "anthropic": "sk-ant-..."   // legacy/plaintext fallback
 *   },
 *   "updatedAt": "2026-04-17T..."
 * }
 *
 * The injectable `crypto` dependency keeps this testable without Electron —
 * `main.ts` wires Electron's safeStorage in, tests pass a stub.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type StoredEntry = string | { enc: true; v: string };

export interface SecretsFile {
  version: 2;
  keys: Record<string, StoredEntry>;
  updatedAt: string;
}

export interface SafeCrypto {
  /** True when encryptString / decryptString will succeed. */
  isEncryptionAvailable(): boolean;
  /** Encrypt → opaque Buffer (base64'd on disk). */
  encryptString(plain: string): Buffer;
  /** Decrypt a Buffer produced by encryptString back to the plain string. */
  decryptString(cipher: Buffer): string;
}

export interface SecretStoreOptions {
  /** File path. Defaults to ~/.opentradex/ai-keys.json. */
  file?: string;
  /** Crypto backend. Defaults to a no-op (plaintext). main.ts injects Electron safeStorage. */
  crypto?: SafeCrypto;
}

const PLAINTEXT_CRYPTO: SafeCrypto = {
  isEncryptionAvailable: () => false,
  encryptString: () => { throw new Error('Plaintext crypto cannot encrypt'); },
  decryptString: () => { throw new Error('Plaintext crypto cannot decrypt'); },
};

/**
 * Encapsulates the read/write/migrate logic. Construct one instance per process
 * (main.ts owns the singleton in production).
 */
export class SecretStore {
  private readonly file: string;
  private readonly crypto: SafeCrypto;

  constructor(opts: SecretStoreOptions = {}) {
    this.file = opts.file ?? join(homedir(), '.opentradex', 'ai-keys.json');
    this.crypto = opts.crypto ?? PLAINTEXT_CRYPTO;
  }

  /** Can we encrypt at rest on this machine? */
  canEncrypt(): boolean {
    try { return this.crypto.isEncryptionAvailable(); } catch { return false; }
  }

  private readFile(): SecretsFile {
    if (!existsSync(this.file)) {
      return { version: 2, keys: {}, updatedAt: new Date().toISOString() };
    }
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf-8')) as Partial<SecretsFile> & { keys?: Record<string, StoredEntry> };
      return {
        version: 2,
        keys: (raw && typeof raw.keys === 'object' && raw.keys) ? { ...raw.keys } : {},
        updatedAt: raw?.updatedAt ?? new Date().toISOString(),
      };
    } catch {
      return { version: 2, keys: {}, updatedAt: new Date().toISOString() };
    }
  }

  private writeFile(next: SecretsFile): void {
    const dir = dirname(this.file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: SecretsFile = { version: 2, keys: next.keys, updatedAt: new Date().toISOString() };
    writeFileSync(this.file, JSON.stringify(payload, null, 2));
    try { chmodSync(this.file, 0o600); } catch { /* windows: best-effort */ }
  }

  private encryptValue(value: string): StoredEntry {
    if (!this.canEncrypt()) return value;
    try {
      const buf = this.crypto.encryptString(value);
      return { enc: true, v: buf.toString('base64') };
    } catch {
      return value;
    }
  }

  private decryptEntry(entry: StoredEntry): string | null {
    if (typeof entry === 'string') return entry;
    if (!entry || entry.enc !== true || typeof entry.v !== 'string') return null;
    if (!this.canEncrypt()) return null;
    try {
      return this.crypto.decryptString(Buffer.from(entry.v, 'base64'));
    } catch {
      return null;
    }
  }

  /** Persist a secret. Encrypts if crypto is available. Rejects empty or too-short values. */
  set(name: string, value: string): void {
    if (typeof name !== 'string' || !name) throw new Error('name is required');
    if (typeof value !== 'string' || value.trim().length < 8) {
      throw new Error('Secret looks too short — double-check what you pasted');
    }
    const store = this.readFile();
    store.keys[name] = this.encryptValue(value.trim());
    this.writeFile(store);
  }

  /** Read a secret. Returns null when missing or when an encrypted entry can't be decrypted. */
  get(name: string): string | null {
    const entry = this.readFile().keys[name];
    if (entry === undefined) return null;
    return this.decryptEntry(entry);
  }

  /** Remove a secret entirely. No-op when absent. */
  delete(name: string): void {
    const store = this.readFile();
    if (store.keys[name] === undefined) return;
    delete store.keys[name];
    this.writeFile(store);
  }

  /** Names of saved secrets. Never returns the plaintext values. */
  list(): string[] {
    return Object.keys(this.readFile().keys);
  }

  /** True when every stored entry is already encrypted. */
  isFullyEncrypted(): boolean {
    const keys = this.readFile().keys;
    if (Object.keys(keys).length === 0) return true;
    return Object.values(keys).every((e) => typeof e === 'object' && e.enc === true);
  }

  /**
   * Upgrade any plaintext entries to encrypted. Safe to call repeatedly.
   * Returns the names migrated and skipped (skipped = already encrypted or crypto unavailable).
   */
  migrateToEncrypted(): { migrated: string[]; skipped: string[] } {
    const migrated: string[] = [];
    const skipped: string[] = [];
    if (!this.canEncrypt()) {
      return { migrated, skipped: this.list() };
    }
    const store = this.readFile();
    let changed = false;
    for (const [name, entry] of Object.entries(store.keys)) {
      if (typeof entry === 'string') {
        store.keys[name] = this.encryptValue(entry);
        migrated.push(name);
        changed = true;
      } else {
        skipped.push(name);
      }
    }
    if (changed) this.writeFile(store);
    return { migrated, skipped };
  }

  /** Decrypt every entry to a plain record. Used by main.ts to build the gateway env. */
  decryptAll(): Record<string, string> {
    const out: Record<string, string> = {};
    const store = this.readFile();
    for (const [name, entry] of Object.entries(store.keys)) {
      const plain = this.decryptEntry(entry);
      if (plain !== null) out[name] = plain;
    }
    return out;
  }
}

/**
 * Map provider names (as used by the dashboard wizard) to the env vars the
 * gateway's provider registry looks up. Matches src/ai/ai-keys.ts but kept
 * here so the desktop package doesn't import from the root src.
 */
export const PROVIDER_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  kimi: 'KIMI_API_KEY',
  glm: 'GLM_API_KEY',
  together: 'TOGETHER_API_KEY',
  xai: 'XAI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
};

/**
 * Build the env patch the gateway should receive on spawn: every decrypted
 * provider key mapped to its proper env var. Existing env wins so a shell
 * override (e.g. `OPENAI_API_KEY=sk-... npm run start`) is respected.
 */
export function buildGatewayEnv(store: SecretStore, parentEnv: NodeJS.ProcessEnv): Record<string, string> {
  const decrypted = store.decryptAll();
  const env: Record<string, string> = {};
  for (const [provider, value] of Object.entries(decrypted)) {
    const envKey = PROVIDER_ENV[provider];
    if (!envKey) continue;
    if (parentEnv[envKey]) continue;
    env[envKey] = value;
  }
  return env;
}
