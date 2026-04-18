/**
 * OpenTradex Scraper — Real-time market data, news, and exchange scraping via Firecrawl.
 *
 * Provides three main scrapers:
 *   1. MarketPriceScraper  — live prices from CoinGecko, Yahoo Finance
 *   2. NewsScraper         — headlines + sentiment from major financial news sources
 *   3. ExchangeScraper     — Kalshi/Polymarket event data, order books
 *
 * All scrapers implement ScraperSource and feed into a unified ScraperService
 * that the gateway exposes via /api/scraper/* endpoints.
 */

export { ScraperService } from './service.js';
export type { ScraperConfig, ScrapedPrice, ScrapedNews, ScrapedExchangeEvent } from './types.js';
