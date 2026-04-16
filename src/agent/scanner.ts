/**
 * Market Scanner - Monitors multiple exchanges for trading opportunities
 */

import { EventEmitter } from 'events';

export interface ScanResult {
  id: string;
  symbol: string;
  exchange: string;
  signal: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-1
  price: number;
  targetPrice?: number;
  stopLoss?: number;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  timestamp: Date;
  indicators: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    volume?: number;
    volatility?: number;
    trend?: 'bullish' | 'bearish' | 'neutral';
  };
}

interface MarketData {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export class MarketScanner extends EventEmitter {
  private watchlist: string[] = [];
  private exchanges: string[] = ['stocks', 'crypto', 'commodities'];
  private lastPrices: Map<string, number> = new Map();

  constructor() {
    super();
    this.loadDefaultWatchlist();
  }

  private loadDefaultWatchlist(): void {
    this.watchlist = [
      'SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
      'BTC', 'ETH', 'SOL',
      'GOLD', 'OIL',
    ];
  }

  async scan(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const symbol of this.watchlist) {
      try {
        const data = await this.fetchMarketData(symbol);
        const analysis = this.analyzeMarket(data);

        if (analysis.signal !== 'hold' && analysis.confidence >= 0.6) {
          results.push(analysis);
          this.emit('opportunity', analysis);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.emit('error', new Error(`Failed to scan ${symbol}: ${reason}`));
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async fetchMarketData(symbol: string): Promise<MarketData> {
    // In production, this would fetch real market data
    // For now, generate realistic mock data
    const exchange = this.getExchange(symbol);
    const basePrice = this.getBasePrice(symbol);
    const lastPrice = this.lastPrices.get(symbol) || basePrice;

    // Simulate price movement
    const change = (Math.random() - 0.48) * 0.05; // Slight upward bias
    const newPrice = lastPrice * (1 + change);
    this.lastPrices.set(symbol, newPrice);

    return {
      symbol,
      exchange,
      price: newPrice,
      change24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 1000000000,
      high24h: newPrice * (1 + Math.random() * 0.03),
      low24h: newPrice * (1 - Math.random() * 0.03),
    };
  }

  private getExchange(symbol: string): string {
    if (['BTC', 'ETH', 'SOL', 'DOGE', 'XRP'].includes(symbol)) return 'crypto';
    if (['GOLD', 'OIL', 'SILVER'].includes(symbol)) return 'commodities';
    return 'stocks';
  }

  private getBasePrice(symbol: string): number {
    const prices: Record<string, number> = {
      SPY: 600, QQQ: 520, AAPL: 265, NVDA: 200, MSFT: 420, GOOGL: 340,
      AMZN: 248, TSLA: 400, BTC: 75000, ETH: 2400, SOL: 180,
      GOLD: 4800, OIL: 75,
    };
    return prices[symbol] || 100;
  }

  private analyzeMarket(data: MarketData): ScanResult {
    // Technical analysis simulation
    const rsi = 30 + Math.random() * 40; // 30-70 range mostly
    const trend = data.change24h > 2 ? 'bullish' : data.change24h < -2 ? 'bearish' : 'neutral';
    const volatility = Math.abs(data.high24h - data.low24h) / data.price;

    // Generate signal based on indicators
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0.5;
    let reasoning = '';

    if (rsi < 35 && trend !== 'bearish') {
      signal = 'buy';
      confidence = 0.6 + (35 - rsi) / 100;
      reasoning = `RSI oversold at ${rsi.toFixed(1)}, potential reversal`;
    } else if (rsi > 65 && trend !== 'bullish') {
      signal = 'sell';
      confidence = 0.6 + (rsi - 65) / 100;
      reasoning = `RSI overbought at ${rsi.toFixed(1)}, potential pullback`;
    } else if (trend === 'bullish' && data.change24h > 3) {
      signal = 'buy';
      confidence = 0.55 + data.change24h / 100;
      reasoning = `Strong bullish momentum: +${data.change24h.toFixed(2)}%`;
    } else if (trend === 'bearish' && data.change24h < -3) {
      signal = 'sell';
      confidence = 0.55 + Math.abs(data.change24h) / 100;
      reasoning = `Strong bearish momentum: ${data.change24h.toFixed(2)}%`;
    } else {
      reasoning = 'No clear signal, holding';
    }

    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (confidence > 0.8 || volatility > 0.05) urgency = 'high';
    else if (confidence > 0.65) urgency = 'medium';

    return {
      id: `${data.symbol}-${Date.now()}`,
      symbol: data.symbol,
      exchange: data.exchange,
      signal,
      confidence: Math.min(confidence, 0.95),
      price: data.price,
      targetPrice: signal === 'buy' ? data.price * 1.03 : signal === 'sell' ? data.price * 0.97 : undefined,
      stopLoss: signal === 'buy' ? data.price * 0.98 : signal === 'sell' ? data.price * 1.02 : undefined,
      urgency,
      reasoning,
      timestamp: new Date(),
      indicators: {
        rsi,
        volume: data.volume24h,
        volatility,
        trend,
      },
    };
  }

  // Public API

  setWatchlist(symbols: string[]): void {
    this.watchlist = symbols;
  }

  addToWatchlist(symbol: string): void {
    if (!this.watchlist.includes(symbol)) {
      this.watchlist.push(symbol);
    }
  }

  removeFromWatchlist(symbol: string): void {
    this.watchlist = this.watchlist.filter((s) => s !== symbol);
  }

  getWatchlist(): string[] {
    return [...this.watchlist];
  }

  async getQuote(symbol: string): Promise<MarketData> {
    return this.fetchMarketData(symbol);
  }
}
