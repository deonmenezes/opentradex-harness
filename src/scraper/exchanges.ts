/**
 * Exchange Scraper — pulls live event/market data from Kalshi, Polymarket, and crypto exchanges.
 *
 * Sources (public APIs, no auth required for reads):
 *  - Polymarket CLOB API
 *  - Kalshi public API
 *  - Binance public ticker
 */

import { smartFetch } from './fetcher.js';
import type { ScrapedExchangeEvent } from './types.js';

// ── Polymarket ─────────────────────────────────────────────────────

interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  end_date_iso?: string;
  markets: Array<{
    id: string;
    question: string;
    outcomePrices: string;
    volume: string;
    clobTokenIds?: string;
  }>;
}

export async function scrapePolymarket(limit = 20): Promise<ScrapedExchangeEvent[]> {
  const url = `https://gamma-api.polymarket.com/events?closed=false&limit=${limit}&order=volume24hr&ascending=false`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const events = res.json<PolymarketEvent[]>();
    const results: ScrapedExchangeEvent[] = [];

    for (const event of events) {
      for (const market of event.markets) {
        let yesPrice = 0.5;
        let noPrice = 0.5;
        try {
          const prices = JSON.parse(market.outcomePrices || '[]');
          yesPrice = parseFloat(prices[0]) || 0.5;
          noPrice = parseFloat(prices[1]) || 1 - yesPrice;
        } catch { /* use defaults */ }

        results.push({
          id: `poly-${market.id}`,
          exchange: 'polymarket',
          symbol: event.slug || market.id,
          title: market.question || event.title,
          price: yesPrice,
          yesPrice,
          noPrice,
          volume: parseFloat(market.volume) || 0,
          endDate: event.end_date_iso,
          category: 'prediction',
          url: `https://polymarket.com/event/${event.slug}`,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[Scraper] Polymarket error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Kalshi ──────────────────────────────────────────────────────────

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  markets: Array<{
    ticker: string;
    title: string;
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    volume: number;
    close_time?: string;
    last_price: number;
  }>;
}

export async function scrapeKalshi(limit = 20): Promise<ScrapedExchangeEvent[]> {
  const url = `https://api.elections.kalshi.com/trade-api/v2/events?limit=${limit}&status=open&with_nested_markets=true`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const data = res.json<{ events?: KalshiEvent[] }>();
    const events = data?.events ?? [];
    const results: ScrapedExchangeEvent[] = [];

    for (const event of events) {
      for (const market of event.markets) {
        const yesPrice = (market.yes_bid + market.yes_ask) / 2 / 100;
        const noPrice = (market.no_bid + market.no_ask) / 2 / 100;
        results.push({
          id: `kalshi-${market.ticker}`,
          exchange: 'kalshi',
          symbol: market.ticker,
          title: market.title || event.title,
          price: market.last_price / 100,
          yesPrice,
          noPrice,
          volume: market.volume,
          endDate: market.close_time,
          category: event.category,
          url: `https://kalshi.com/markets/${event.event_ticker}`,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[Scraper] Kalshi error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Binance (crypto order books / extra data) ──────────────────────

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
}

export async function scrapeBinanceTickers(): Promise<ScrapedExchangeEvent[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];
  const symbolParam = JSON.stringify(symbols);
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolParam)}`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const tickers = res.json<BinanceTicker[]>();
    return tickers.map((t): ScrapedExchangeEvent => ({
      id: `binance-${t.symbol}`,
      exchange: 'binance',
      symbol: t.symbol.replace('USDT', ''),
      title: `${t.symbol} 24h Ticker`,
      price: parseFloat(t.lastPrice),
      volume: parseFloat(t.volume),
      url: `https://www.binance.com/en/trade/${t.symbol}`,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('[Scraper] Binance error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Scrape all exchange data */
export async function scrapeAllExchanges(): Promise<ScrapedExchangeEvent[]> {
  const [poly, kalshi, binance] = await Promise.allSettled([
    scrapePolymarket(),
    scrapeKalshi(),
    scrapeBinanceTickers(),
  ]);

  const all: ScrapedExchangeEvent[] = [];
  if (poly.status === 'fulfilled') all.push(...poly.value);
  if (kalshi.status === 'fulfilled') all.push(...kalshi.value);
  if (binance.status === 'fulfilled') all.push(...binance.value);

  return all;
}
