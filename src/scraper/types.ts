/** Scraper types for OpenTradex real-time data */

export interface ScraperConfig {
  /** Firecrawl API key (optional — falls back to direct HTTP for public APIs) */
  firecrawlApiKey?: string;
  /** Polling interval in ms for market prices (default: 30_000) */
  priceIntervalMs?: number;
  /** Polling interval in ms for news (default: 60_000) */
  newsIntervalMs?: number;
  /** Polling interval in ms for exchange events (default: 45_000) */
  exchangeIntervalMs?: number;
  /** Custom watchlist symbols — overrides defaults */
  watchlist?: string[];
  /** News sources to scrape */
  newsSources?: string[];
}

export interface ScrapedPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  exchange: 'stocks' | 'crypto' | 'commodities';
  timestamp: number;
}

export interface ScrapedNews {
  id: string;
  title: string;
  summary?: string;
  source: string;
  url: string;
  age: string;
  category: 'news' | 'crypto' | 'social';
  tickers: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
}

export interface ScrapedExchangeEvent {
  id: string;
  exchange: string;
  symbol: string;
  title: string;
  price: number;         // Last trade price or mid
  yesPrice?: number;
  noPrice?: number;
  volume: number;
  endDate?: string;
  category?: string;
  url?: string;
  timestamp: number;
}

/** Unified cache the scraper service maintains */
export interface ScraperCache {
  prices: Map<string, ScrapedPrice>;
  news: ScrapedNews[];
  events: ScrapedExchangeEvent[];
  lastPriceUpdate: number;
  lastNewsUpdate: number;
  lastEventUpdate: number;
}
