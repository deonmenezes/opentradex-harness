/**
 * Unit tests for the SecretStore (US-006).
 *
 * These tests never touch real Electron — they inject a fake `SafeCrypto`
 * implementation so we can verify encrypt/decrypt round-trips, migration from
 * plaintext, env-var construction, and the plaintext fallback path when the
 * platform has no OS keychain.
 *
 * Run: npx tsx --test packages/desktop/src/secrets.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SecretStore,
  buildGatewayEnv,
  PROVIDER_ENV,
  type SafeCrypto,
  type SecretsFile,
} from './secrets';

/**
 * Trivial reversible "crypto" — XOR with a byte mask. Good enough to verify
 * round-trips without shipping a real cipher in the test. Any bug in the store
 * that writes plaintext instead of ciphertext will flip visibly.
 */
function makeFakeCrypto(available = true): SafeCrypto {
  const MASK = 0x5a;
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plain: string) => {
      const buf = Buffer.from(plain, 'utf8');
      for (let i = 0; i < buf.length; i++) buf[i] ^= MASK;
      return buf;
    },
    decryptString: (cipher: Buffer) => {
      const copy = Buffer.from(cipher);
      for (let i = 0; i < copy.length; i++) copy[i] ^= MASK;
      return copy.toString('utf8');
    },
  };
}

function tmpFile(): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'opentradex-secrets-'));
  const file = join(dir, 'ai-keys.json');
  return {
    file,
    cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ } },
  };
}

test('set + get round-trips a secret', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    store.set('openai', 'sk-abcdef1234567890');
    assert.equal(store.get('openai'), 'sk-abcdef1234567890');
  } finally {
    cleanup();
  }
});

test('set encrypts on disk (plaintext value never appears in the file)', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    const secret = 'sk-should-never-appear-plaintext';
    store.set('openai', secret);
    const raw = readFileSync(file, 'utf8');
    assert.equal(raw.includes(secret), false, 'plaintext leaked into the file');
    // The file structure should record this entry as encrypted.
    const parsed = JSON.parse(raw) as SecretsFile;
    const entry = parsed.keys.openai;
    assert.ok(typeof entry === 'object' && entry !== null && 'enc' in entry && entry.enc === true,
      'entry should be stored as { enc: true, v: "..." }');
  } finally {
    cleanup();
  }
});

test('delete removes the entry', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    store.set('openai', 'sk-111aaa2222');
    store.set('anthropic', 'sk-ant-3334445');
    store.delete('openai');
    assert.equal(store.get('openai'), null);
    assert.equal(store.get('anthropic'), 'sk-ant-3334445');
    assert.deepEqual(store.list().sort(), ['anthropic']);
  } finally {
    cleanup();
  }
});

test('list returns names only (never plaintext)', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    store.set('openai', 'sk-aaaaaaaaaaaa');
    store.set('groq', 'gsk_bbbbbbbbbbbb');
    assert.deepEqual(store.list().sort(), ['groq', 'openai']);
  } finally {
    cleanup();
  }
});

test('set rejects short/empty values', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    assert.throws(() => store.set('openai', ''), /too short/i);
    assert.throws(() => store.set('openai', 'short'), /too short/i);
    assert.throws(() => store.set('', 'sk-long-enough-key'), /name is required/i);
  } finally {
    cleanup();
  }
});

test('plaintext fallback when crypto is unavailable', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto(false) });
    const secret = 'sk-plaintext-because-no-keychain';
    store.set('openai', secret);
    // Value should round-trip via the file even without encryption.
    assert.equal(store.get('openai'), secret);
    // Nothing encrypted.
    assert.equal(store.isFullyEncrypted(), false);
    // And the file itself contains the plain string.
    assert.ok(readFileSync(file, 'utf8').includes(secret));
  } finally {
    cleanup();
  }
});

test('migrateToEncrypted upgrades plaintext entries when crypto is available', () => {
  const { file, cleanup } = tmpFile();
  try {
    // First write with no crypto available → plaintext.
    const plain = new SecretStore({ file, crypto: makeFakeCrypto(false) });
    plain.set('openai', 'sk-originally-plaintext');
    assert.equal(plain.isFullyEncrypted(), false);

    // Now "upgrade" the platform: same file, crypto available.
    const encrypted = new SecretStore({ file, crypto: makeFakeCrypto(true) });
    const result = encrypted.migrateToEncrypted();
    assert.deepEqual(result.migrated, ['openai']);
    assert.deepEqual(result.skipped, []);
    assert.equal(encrypted.isFullyEncrypted(), true);
    // Value still round-trips.
    assert.equal(encrypted.get('openai'), 'sk-originally-plaintext');
    // And disk no longer contains the plain value.
    assert.equal(readFileSync(file, 'utf8').includes('sk-originally-plaintext'), false);
  } finally {
    cleanup();
  }
});

test('migrateToEncrypted is a no-op when crypto is unavailable', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto(false) });
    store.set('openai', 'sk-cannot-encrypt-here');
    const result = store.migrateToEncrypted();
    assert.deepEqual(result.migrated, []);
    assert.deepEqual(result.skipped, ['openai']);
  } finally {
    cleanup();
  }
});

test('decryptAll returns plaintext for injection into gateway env', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    store.set('openai', 'sk-aaaabbbbccccdddd');
    store.set('groq', 'gsk_eeeeffffgggghhhh');
    const all = store.decryptAll();
    assert.deepEqual(all, {
      openai: 'sk-aaaabbbbccccdddd',
      groq: 'gsk_eeeeffffgggghhhh',
    });
  } finally {
    cleanup();
  }
});

test('buildGatewayEnv maps provider keys to env var names', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    store.set('openai', 'sk-openai-aaaaaaaa');
    store.set('anthropic', 'sk-ant-bbbbbbbb');
    const env = buildGatewayEnv(store, {});
    assert.equal(env[PROVIDER_ENV.openai], 'sk-openai-aaaaaaaa');
    assert.equal(env[PROVIDER_ENV.anthropic], 'sk-ant-bbbbbbbb');
    // Names without a mapping should not leak in.
    assert.equal(env['BOGUS_KEY'], undefined);
  } finally {
    cleanup();
  }
});

test('buildGatewayEnv respects parent env — shell override wins', () => {
  const { file, cleanup } = tmpFile();
  try {
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    store.set('openai', 'sk-saved-in-keychain');
    // User set a different key in their shell.
    const parent = { OPENAI_API_KEY: 'sk-from-shell' };
    const env = buildGatewayEnv(store, parent);
    // Parent env should be left untouched by our patch (shell wins).
    assert.equal(env.OPENAI_API_KEY, undefined, 'parent env key should not be overridden by keychain');
  } finally {
    cleanup();
  }
});

test('get returns null for encrypted entries when crypto is unavailable on read', () => {
  const { file, cleanup } = tmpFile();
  try {
    // Write encrypted.
    const writer = new SecretStore({ file, crypto: makeFakeCrypto(true) });
    writer.set('openai', 'sk-encrypted-value');

    // Now try to read on a platform with no crypto (different SecretStore, no crypto).
    const reader = new SecretStore({ file, crypto: makeFakeCrypto(false) });
    assert.equal(reader.get('openai'), null);
  } finally {
    cleanup();
  }
});

test('corrupt file is treated as empty, not thrown', () => {
  const { file, cleanup } = tmpFile();
  try {
    // Write bogus content.
    require('node:fs').writeFileSync(file, 'not json {{{');
    const store = new SecretStore({ file, crypto: makeFakeCrypto() });
    assert.deepEqual(store.list(), []);
    // And we can still set new keys without blowing up.
    store.set('openai', 'sk-recovered-just-fine');
    assert.equal(store.get('openai'), 'sk-recovered-just-fine');
  } finally {
    cleanup();
  }
});
