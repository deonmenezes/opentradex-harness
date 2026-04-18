/**
 * HTTP fetcher — tries Firecrawl first (for JS-rendered pages), falls back to direct fetch.
 * Keeps Firecrawl optional so the scraper works without an API key for public JSON APIs.
 */

interface FetchResult {
  ok: boolean;
  text: string;
  json: <T = unknown>() => T;
  status: number;
}

let firecrawlKey: string | null = null;

export function setFirecrawlKey(key: string | null): void {
  firecrawlKey = key;
}

/** Direct HTTP fetch with timeout */
async function directFetch(url: string, timeoutMs = 10_000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OpenTradex/0.1 (market-scraper)' },
    });
    const text = await res.text();
    return {
      ok: res.ok,
      text,
      json: <T>() => JSON.parse(text) as T,
      status: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Firecrawl scrape — extracts clean markdown/text from JS-heavy pages */
async function firecrawlFetch(url: string): Promise<FetchResult> {
  if (!firecrawlKey) throw new Error('No Firecrawl API key');
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'rawHtml'],
      waitFor: 2000,
    }),
  });
  const data = await res.json() as { success: boolean; data?: { markdown?: string; rawHtml?: string } };
  const text = data?.data?.markdown || data?.data?.rawHtml || '';
  return {
    ok: res.ok && !!data.success,
    text,
    json: <T>() => JSON.parse(text) as T,
    status: res.status,
  };
}

/**
 * Smart fetch — uses direct HTTP for JSON APIs, Firecrawl for HTML pages.
 * @param url        Target URL
 * @param useFirecrawl  Force Firecrawl (for JS-rendered pages)
 */
export async function smartFetch(url: string, useFirecrawl = false): Promise<FetchResult> {
  if (useFirecrawl && firecrawlKey) {
    try {
      return await firecrawlFetch(url);
    } catch {
      // Fall back to direct
    }
  }
  return directFetch(url);
}
