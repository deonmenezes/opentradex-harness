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

export interface HarnessStatus {
  mode: 'paper-only' | 'paper-default' | 'live-allowed';
  connection: 'connected' | 'disconnected' | 'reconnecting';
  isAutoLoop: boolean;
  cycles: number;
}

class OpenTradexAPI {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(baseUrl = DEFAULT_API_URL) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
    this.reconnectWebSocket();
  }

  // REST API Methods
  async getHealth(): Promise<HarnessStatus> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }

  async scanMarkets(exchange?: string, limit = 20): Promise<Asset[]> {
    const params = new URLSearchParams();
    if (exchange) params.set('exchange', exchange);
    params.set('limit', String(limit));

    const res = await fetch(`${this.baseUrl}/scan?${params}`);
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

  async searchMarkets(query: string): Promise<Asset[]> {
    const res = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
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

  async sendCommand(command: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    return data.response;
  }

  async getRisk(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/risk`);
    return res.json();
  }

  async panic(): Promise<void> {
    await fetch(`${this.baseUrl}/panic`, { method: 'POST' });
  }

  // WebSocket for real-time updates
  connectWebSocket() {
    const wsUrl = this.baseUrl.replace('http', 'ws').replace('/api', '/ws');

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
