/**
 * Market Price Scraper — pulls live prices from free public APIs.
 *
 * Sources:
 *  - CoinGecko (crypto: BTC, ETH, SOL, etc.)
 *  - Yahoo Finance v8 (stocks: SPY, QQQ, AAPL, etc. + commodities: GOLD, OIL)
 */

import { smartFetch } from './fetcher.js';
import type { ScrapedPrice } from './types.js';

// ── CoinGecko mapping ──────────────────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  DOT: 'polkadot',
  MATIC: 'matic-network',
};

// ── Yahoo Finance symbol mapping ───────────────────────────────────
const YAHOO_SYMBOLS: Record<string, string> = {
  SPY: 'SPY',
  QQQ: 'QQQ',
  AAPL: 'AAPL',
  NVDA: 'NVDA',
  MSFT: 'MSFT',
  GOOGL: 'GOOGL',
  AMZN: 'AMZN',
  TSLA: 'TSLA',
  META: 'META',
  GOLD: 'GC=F',
  OIL: 'CL=F',
  SILVER: 'SI=F',
};

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  market_cap: number;
}

interface YahooQuoteResult {
  symbol: string;
  shortName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  marketCap?: number;
}

/** Scrape crypto prices from CoinGecko */
export async function scrapeCryptoPrices(symbols: string[]): Promise<ScrapedPrice[]> {
  const cryptoSymbols = symbols.filter((s) => s in COINGECKO_IDS);
  if (cryptoSymbols.length === 0) return [];

  const ids = cryptoSymbols.map((s) => COINGECKO_IDS[s]).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const data = res.json<CoinGeckoMarket[]>();
    const idToSymbol = Object.fromEntries(Object.entries(COINGECKO_IDS).map(([k, v]) => [v, k]));

    return data.map((coin): ScrapedPrice => ({
      symbol: idToSymbol[coin.id] || coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_24h,
      changePercent24h: coin.price_change_percentage_24h,
      volume24h: coin.total_volume,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      marketCap: coin.market_cap,
      exchange: 'crypto',
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('[Scraper] CoinGecko error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Scrape stock/commodity prices from Yahoo Finance */
export async function scrapeStockPrices(symbols: string[]): Promise<ScrapedPrice[]> {
  const stockSymbols = symbols.filter((s) => s in YAHOO_SYMBOLS);
  if (stockSymbols.length === 0) return [];

  const yahooSyms = stockSymbols.map((s) => YAHOO_SYMBOLS[s]).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSyms}&fields=symbol,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,marketCap`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const data = res.json<{ quoteResponse?: { result?: YahooQuoteResult[] } }>();
    const quotes = data?.quoteResponse?.result ?? [];
    const yahooToSymbol = Object.fromEntries(Object.entries(YAHOO_SYMBOLS).map(([k, v]) => [v, k]));

    return quotes.map((q): ScrapedPrice => {
      const symbol = yahooToSymbol[q.symbol] || q.symbol;
      const isCommodity = ['GOLD', 'OIL', 'SILVER'].includes(symbol);
      return {
        symbol,
        name: q.shortName || symbol,
        price: q.regularMarketPrice,
        change24h: q.regularMarketChange,
        changePercent24h: q.regularMarketChangePercent,
        volume24h: q.regularMarketVolume,
        high24h: q.regularMarketDayHigh,
        low24h: q.regularMarketDayLow,
        marketCap: q.marketCap,
        exchange: isCommodity ? 'commodities' : 'stocks',
        timestamp: Date.now(),
      };
    });
  } catch (err) {
    console.error('[Scraper] Yahoo Finance error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Scrape all prices for a given watchlist */
export async function scrapeAllPrices(symbols: string[]): Promise<ScrapedPrice[]> {
  const [crypto, stocks] = await Promise.all([
    scrapeCryptoPrices(symbols),
    scrapeStockPrices(symbols),
  ]);
  return [...crypto, ...stocks];
}
