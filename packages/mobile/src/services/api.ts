/**
 * OpenTradex Mobile API Service
 * Connects to the local AI harness gateway
 */

const DEFAULT_API_URL = 'http://localhost:3210/api';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline?: number[];
  icon?: string;
  exchange: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: number;
  icon?: string;
}

export interface PortfolioSummary {
  cash: number;
  investments: number;
  totalValue: number;
  dayPnL: number;
  dayPnLPercent: number;
  apy: number;
}

export type TradingMode = 'paper-only' | 'paper-default' | 'live-allowed';

export interface HarnessStatus {
  mode: TradingMode;
  connection: 'connected' | 'disconnected' | 'reconnecting';
  isAutoLoop: boolean;
  cycles: number;
  equity: number;
  dayPnL: number;
  dayPnLPercent: number;
  openPositions: number;
  halted: boolean;
  haltReason?: string;
  badge?: string;
  exchanges: string[];
}

export interface Position {
  id: string;
  exchange: string;
  symbol: string;
  side: 'yes' | 'no' | 'long' | 'short';
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface RiskResponse {
  state: {
    dailyPnL: number;
    dailyTrades: number;
    dailyWins: number;
    winRate: number;
    openPositions: Array<Record<string, unknown>>;
    lastReset: string;
    startingCapital: number;
    equity: number;
  };
  halted: boolean;
  haltReason?: string;
  limits?: unknown;
}

export interface StatusResponse {
  status: string;
  version: string;
  mode: TradingMode;
  badge: string;
  exchanges: string[];
  risk: {
    dailyPnL: number;
    openPositions: number;
    halted: boolean;
    haltReason?: string;
  };
}

export interface QuoteResponse {
  market: {
    id: string;
    exchange: string;
    symbol: string;
    title: string;
    price: number;
    volume?: number;
    endDate?: string;
    url?: string;
    meta?: Record<string, unknown>;
  };
  orderbook?: OrderbookResponse;
  timestamp: number;
}

export interface OrderbookResponse {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
  midPrice: number;
}

class OpenTradexAPI {
  private baseUrl: string;
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(baseUrl = DEFAULT_API_URL) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
    this.reconnectWebSocket();
  }

  /** Set bearer token used for all REST + WS requests. Pass null to clear. */
  setToken(token: string | null) {
    this.token = token;
    this.reconnectWebSocket();
  }

  /** Apply host + token at boot (loaded from pair-storage) in one call. */
  configure({ host, token }: { host: string; token: string | null }) {
    const base = host.replace(/\/+$/, '');
    const apiBase = base.endsWith('/api') ? base : `${base}/api`;
    this.baseUrl = apiBase;
    this.token = token;
    this.reconnectWebSocket();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = extra ? { ...extra } : {};
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  // REST API Methods

  /** GET /api/ — root status payload (mode, exchanges, risk summary) */
  async getStatus(): Promise<StatusResponse> {
    const res = await fetch(`${this.baseUrl}/`, { headers: this.headers() });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  }

  async getHealth(): Promise<StatusResponse> {
    const res = await fetch(`${this.baseUrl}/health`, { headers: this.headers() });
    if (!res.ok) throw new Error(`health ${res.status}`);
    return res.json();
  }

  async scanMarkets(exchange?: string, limit = 20): Promise<Asset[]> {
    const params = new URLSearchParams();
    if (exchange) params.set('exchange', exchange);
    params.set('limit', String(limit));

    const res = await fetch(`${this.baseUrl}/scan?${params}`, { headers: this.headers() });
    const data = await res.json();

    return (data.markets || []).map((m: any) => ({
      id: m.id,
      symbol: m.symbol,
      name: m.title || m.symbol,
      price: m.price || 0,
      change: 0,
      changePercent: 0,
      exchange: m.exchange,
    }));
  }

  async searchMarkets(query: string, exchange?: string): Promise<Asset[]> {
    const params = new URLSearchParams({ q: query });
    if (exchange) params.set('exchange', exchange);
    const res = await fetch(`${this.baseUrl}/search?${params}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`search ${res.status}`);
    const data = await res.json();

    return (data.markets || []).map((m: any) => ({
      id: m.id,
      symbol: m.symbol,
      name: m.title || m.symbol,
      price: m.price || 0,
      change: 0,
      changePercent: 0,
      exchange: m.exchange,
    }));
  }

  /** GET /api/quote?exchange=&symbol= — returns `{ market, orderbook?, timestamp }`. */
  async getQuote(exchange: string, symbol: string): Promise<QuoteResponse> {
    const params = new URLSearchParams({ exchange, symbol });
    const res = await fetch(`${this.baseUrl}/quote?${params}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`quote ${res.status}`);
    return res.json();
  }

  /** GET /api/orderbook?exchange=&symbol= — `null` when connector has no orderbook. */
  async getOrderbook(exchange: string, symbol: string): Promise<OrderbookResponse | null> {
    const params = new URLSearchParams({ exchange, symbol });
    const res = await fetch(`${this.baseUrl}/orderbook?${params}`, { headers: this.headers() });
    if (!res.ok) return null;
    return res.json();
  }

  async sendCommand(command: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/command`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    return data.response;
  }

  async getRisk(): Promise<RiskResponse> {
    const res = await fetch(`${this.baseUrl}/risk`, { headers: this.headers() });
    if (!res.ok) throw new Error(`risk ${res.status}`);
    return res.json();
  }

  async panic(): Promise<void> {
    await fetch(`${this.baseUrl}/panic`, { method: 'POST', headers: this.headers() });
  }

  // WebSocket for real-time updates
  connectWebSocket() {
    const wsBase = this.baseUrl.replace('http', 'ws').replace('/api', '/ws');
    // Bearer tokens can't travel in WS subprotocols on React Native — use the
    // gateway's query-param shortcut which /ws also accepts.
    const wsUrl = this.token ? `${wsBase}?token=${encodeURIComponent(this.token)}` : wsBase;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected to harness');
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data.payload);
          this.emit('message', data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = () => {
        this.emit('connection', { status: 'error' });
      };

      this.ws.onclose = () => {
        this.emit('connection', { status: 'disconnected' });
        // Reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (e) {
      console.error('[WS] Connection error:', e);
    }
  }

  reconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }
    this.connectWebSocket();
  }

  on(event: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const api = new OpenTradexAPI();
export default api;

/** Convert a raw risk-state position to the UI Position shape. */
export function toPosition(raw: Record<string, unknown>, index: number): Position {
  const symbol = String(raw.symbol ?? '—');
  const exchange = String(raw.exchange ?? 'crypto');
  return {
    id: String(raw.id ?? `${exchange}:${symbol}:${index}`),
    exchange,
    symbol,
    side: (raw.side as Position['side']) ?? 'long',
    size: Number(raw.size ?? 0),
    avgPrice: Number(raw.avgPrice ?? raw.entry ?? 0),
    currentPrice: Number(raw.currentPrice ?? raw.mark ?? raw.avgPrice ?? 0),
    pnl: Number(raw.pnl ?? 0),
    pnlPercent: Number(raw.pnlPercent ?? 0),
  };
}
