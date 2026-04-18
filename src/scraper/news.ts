/**
 * News Scraper — pulls headlines and sentiment from financial news RSS feeds + APIs.
 *
 * Sources (free / no-auth):
 *  - CoinDesk RSS
 *  - CoinTelegraph RSS
 *  - Yahoo Finance RSS
 *  - Google News (finance)
 *  - Reddit r/wallstreetbets, r/cryptocurrency (JSON API)
 *
 * For JS-heavy sources (Bloomberg, Reuters), Firecrawl is used when available.
 */

import { smartFetch } from './fetcher.js';
import type { ScrapedNews } from './types.js';

// ── RSS feed URLs ──────────────────────────────────────────────────
const RSS_FEEDS: { url: string; source: string; category: ScrapedNews['category'] }[] = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'coindesk', category: 'crypto' },
  { url: 'https://cointelegraph.com/rss', source: 'cointelegraph', category: 'crypto' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'yahoo', category: 'news' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', source: 'google', category: 'news' },
];

// ── Reddit endpoints ───────────────────────────────────────────────
const REDDIT_FEEDS = [
  { url: 'https://www.reddit.com/r/wallstreetbets/hot.json?limit=10', source: 'reddit', category: 'social' as const },
  { url: 'https://www.reddit.com/r/cryptocurrency/hot.json?limit=10', source: 'reddit', category: 'crypto' as const },
];

// Known ticker patterns
const TICKER_REGEX = /\$([A-Z]{1,5})\b/g;
const KNOWN_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC',
  'SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META',
  'GOLD', 'OIL', 'AMD', 'NFLX', 'DIS', 'BA', 'JPM', 'GS',
]);

/** Extract ticker symbols from text */
function extractTickers(text: string): string[] {
  const tickers = new Set<string>();
  // Explicit $TICKER mentions
  let match;
  while ((match = TICKER_REGEX.exec(text)) !== null) {
    tickers.add(match[1]);
  }
  // Implicit mentions of known tickers
  const upper = text.toUpperCase();
  for (const t of KNOWN_TICKERS) {
    if (upper.includes(t)) tickers.add(t);
  }
  return Array.from(tickers);
}

/** Simple sentiment from title keywords */
function guessSentiment(text: string): ScrapedNews['sentiment'] {
  const lower = text.toLowerCase();
  const bullish = ['surge', 'soar', 'rally', 'bull', 'gain', 'rise', 'jump', 'record', 'high', 'breakout', 'buy', 'upgrade'];
  const bearish = ['crash', 'plunge', 'bear', 'drop', 'fall', 'dump', 'sell', 'downgrade', 'risk', 'fear', 'loss', 'decline'];
  const bScore = bullish.filter((w) => lower.includes(w)).length;
  const sScore = bearish.filter((w) => lower.includes(w)).length;
  if (bScore > sScore) return 'bullish';
  if (sScore > bScore) return 'bearish';
  return 'neutral';
}

/** Convert a Date to a relative "Xm ago" string */
function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

/** Parse simple RSS XML into items (no external dep) */
function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate?: string; description?: string }> {
  const items: Array<{ title: string; link: string; pubDate?: string; description?: string }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() ?? '';
    const link = block.match(/<link[^>]*>(.*?)<\/link>/s)?.[1]?.trim() ?? '';
    const pubDate = block.match(/<pubDate[^>]*>(.*?)<\/pubDate>/s)?.[1]?.trim();
    const description = block.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]?.trim();
    if (title) items.push({ title, link, pubDate, description });
  }
  return items;
}

/** Scrape RSS feeds */
export async function scrapeRssNews(): Promise<ScrapedNews[]> {
  const results: ScrapedNews[] = [];

  const feeds = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source, category }) => {
      const res = await smartFetch(url);
      if (!res.ok) return [];
      const items = parseRssItems(res.text);
      return items.slice(0, 15).map((item): ScrapedNews => {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        return {
          id: `${source}-${Buffer.from(item.title).toString('base64url').slice(0, 16)}`,
          title: item.title,
          summary: item.description?.replace(/<[^>]+>/g, '').slice(0, 200),
          source,
          url: item.link,
          age: timeAgo(pubDate),
          category,
          tickers: extractTickers(item.title + ' ' + (item.description ?? '')),
          sentiment: guessSentiment(item.title),
          timestamp: pubDate.getTime(),
        };
      });
    })
  );

  for (const result of feeds) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }

  return results.sort((a, b) => b.timestamp - a.timestamp);
}

/** Scrape Reddit for social sentiment */
export async function scrapeRedditNews(): Promise<ScrapedNews[]> {
  const results: ScrapedNews[] = [];

  const feeds = await Promise.allSettled(
    REDDIT_FEEDS.map(async ({ url, source, category }) => {
      const res = await smartFetch(url);
      if (!res.ok) return [];

      interface RedditPost {
        data: {
          title: string;
          permalink: string;
          created_utc: number;
          selftext?: string;
          score: number;
          link_flair_text?: string;
        };
      }
      const data = res.json<{ data?: { children?: RedditPost[] } }>();
      const posts = data?.data?.children ?? [];

      return posts.slice(0, 10).map((post): ScrapedNews => {
        const d = post.data;
        const pubDate = new Date(d.created_utc * 1000);
        return {
          id: `reddit-${Buffer.from(d.permalink).toString('base64url').slice(0, 16)}`,
          title: d.title,
          summary: d.selftext?.slice(0, 200) || d.link_flair_text || undefined,
          source,
          url: `https://reddit.com${d.permalink}`,
          age: timeAgo(pubDate),
          category,
          tickers: extractTickers(d.title + ' ' + (d.selftext ?? '')),
          sentiment: guessSentiment(d.title),
          timestamp: pubDate.getTime(),
        };
      });
    })
  );

  for (const result of feeds) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }

  return results.sort((a, b) => b.timestamp - a.timestamp);
}

/** Scrape news from premium sources via Firecrawl (Bloomberg, Reuters) */
export async function scrapeFirecrawlNews(): Promise<ScrapedNews[]> {
  const sources = [
    { url: 'https://www.reuters.com/markets/', source: 'reuters', category: 'news' as const },
    { url: 'https://www.bloomberg.com/markets', source: 'bloomberg', category: 'news' as const },
  ];

  const results: ScrapedNews[] = [];

  const feeds = await Promise.allSettled(
    sources.map(async ({ url, source, category }) => {
      const res = await smartFetch(url, true); // force Firecrawl for JS pages
      if (!res.ok) return [];

      // Extract headlines from markdown — look for ## or ### headings, or bold text
      const lines = res.text.split('\n');
      const headlines: ScrapedNews[] = [];
      for (const line of lines) {
        const heading = line.match(/^#{1,3}\s+(.+)/)?.[1]?.trim();
        if (heading && heading.length > 15 && heading.length < 200) {
          headlines.push({
            id: `${source}-${Buffer.from(heading).toString('base64url').slice(0, 16)}`,
            title: heading,
            source,
            url,
            age: '0m',
            category,
            tickers: extractTickers(heading),
            sentiment: guessSentiment(heading),
            timestamp: Date.now(),
          });
        }
      }
      return headlines.slice(0, 10);
    })
  );

  for (const result of feeds) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }

  return results;
}

/** Scrape all news sources */
export async function scrapeAllNews(): Promise<ScrapedNews[]> {
  const [rss, reddit, firecrawl] = await Promise.allSettled([
    scrapeRssNews(),
    scrapeRedditNews(),
    scrapeFirecrawlNews(),
  ]);

  const all: ScrapedNews[] = [];
  if (rss.status === 'fulfilled') all.push(...rss.value);
  if (reddit.status === 'fulfilled') all.push(...reddit.value);
  if (firecrawl.status === 'fulfilled') all.push(...firecrawl.value);

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return all
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item) => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}
