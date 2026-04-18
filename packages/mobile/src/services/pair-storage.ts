/**
 * Pair-storage: persists { host, token } issued by the desktop gateway's onboard QR.
 *
 * expo-secure-store is the primary backend (iOS Keychain / Android Keystore). On
 * web (Expo Web) and other environments where it's unavailable, we fall back to
 * a best-effort localStorage / in-memory layer so the dev experience still works.
 *
 * Matches the v1 envelope emitted by src/pair-qr.ts:
 *   { v:1, host, token, issuedAt }
 */

import * as SecureStore from 'expo-secure-store';

const HOST_KEY = 'opentradex.host';
const TOKEN_KEY = 'opentradex.token';
const ISSUED_KEY = 'opentradex.issuedAt';

export interface PairConfig {
  host: string;
  token: string;
  issuedAt?: number;
}

type WebStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
const memory: Record<string, string> = {};
const memoryStorage: WebStorage = {
  getItem: (k) => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = v; },
  removeItem: (k) => { delete memory[k]; },
};

function webStorage(): WebStorage {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as unknown as { localStorage?: WebStorage };
    if (g.localStorage) return g.localStorage;
  }
  return memoryStorage;
}

async function getItem(key: string): Promise<string | null> {
  // Native path: SecureStore is only safe on iOS/Android runtimes.
  if (SecureStore.isAvailableAsync && (await SecureStore.isAvailableAsync())) {
    return SecureStore.getItemAsync(key);
  }
  return webStorage().getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (SecureStore.isAvailableAsync && (await SecureStore.isAvailableAsync())) {
    return SecureStore.setItemAsync(key, value);
  }
  webStorage().setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (SecureStore.isAvailableAsync && (await SecureStore.isAvailableAsync())) {
    return SecureStore.deleteItemAsync(key);
  }
  webStorage().removeItem(key);
}

export async function loadPair(): Promise<PairConfig | null> {
  const [host, token, issued] = await Promise.all([
    getItem(HOST_KEY),
    getItem(TOKEN_KEY),
    getItem(ISSUED_KEY),
  ]);
  if (!host || !token) return null;
  const issuedAt = issued ? Number(issued) : undefined;
  return { host, token, issuedAt };
}

export async function savePair(cfg: PairConfig): Promise<void> {
  if (!cfg.host || !cfg.token) throw new Error('savePair: host + token required');
  await Promise.all([
    setItem(HOST_KEY, cfg.host),
    setItem(TOKEN_KEY, cfg.token),
    setItem(ISSUED_KEY, String(cfg.issuedAt ?? Date.now())),
  ]);
}

export async function clearPair(): Promise<void> {
  await Promise.all([
    removeItem(HOST_KEY),
    removeItem(TOKEN_KEY),
    removeItem(ISSUED_KEY),
  ]);
}

/**
 * Parse a scanned pair envelope. Accepts both the v1 JSON wrapper produced by
 * src/pair-qr.ts and a bare { host, token } shape for forward-compat.
 */
export function parsePairEnvelope(raw: string): PairConfig {
  let json: unknown;
  try { json = JSON.parse(raw); }
  catch { throw new Error('QR content is not valid JSON'); }
  if (!json || typeof json !== 'object') throw new Error('QR envelope must be an object');
  const obj = json as Record<string, unknown>;
  const host = typeof obj.host === 'string' ? obj.host : '';
  const token = typeof obj.token === 'string' ? obj.token : '';
  const issuedAt = typeof obj.issuedAt === 'number' ? obj.issuedAt : undefined;
  if (!host || !token) throw new Error('QR envelope missing host or token');
  return { host, token, issuedAt };
}

/** Normalise a typed host ("192.168.1.5", "192.168.1.5:3210", full URL). */
export function normaliseHost(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  if (/:\d+$/.test(trimmed)) return `http://${trimmed}`;
  return `http://${trimmed}:3210`;
}

export async function testConnection(host: string, token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = host.replace(/\/+$/, '');
  const url = `${base}/api/health`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, error: `gateway returned ${res.status}` };
    // Try to parse; don't require specific shape — any 2xx body is good.
    await res.text();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    return { ok: false, error: msg };
  }
}
