/**
 * React hook for connecting to OpenTradex harness.
 *
 * Fetches /api/ + /api/risk on mount and on refresh, subscribes to /ws for
 * live updates, and exposes a shape that mobile tabs can consume directly.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api, {
  Asset,
  HarnessStatus,
  Position,
  toPosition,
} from '../services/api';

const POLL_MS = 15_000;

// Static reference data (news is not yet wired to the gateway — this remains
// cosmetic until the news feed lands on mobile).
const MOCK_ASSETS: Asset[] = [
  { id: '1', symbol: 'SPY', name: 'S&P 500', price: 700.54, change: 6.21, changePercent: 0.89, exchange: 'stocks' },
  { id: '2', symbol: 'NVDA', name: 'NVIDIA', price: 199.37, change: 3.42, changePercent: 1.74, exchange: 'stocks' },
  { id: '3', symbol: 'GOLD', name: 'Gold', price: 4790.27, change: 4.31, changePercent: 0.09, exchange: 'commodities' },
  { id: '4', symbol: 'BTC', name: 'Bitcoin', price: 74550.32, change: 680.45, changePercent: 0.92, exchange: 'crypto' },
  { id: '5', symbol: 'AAPL', name: 'Apple', price: 265.93, change: 7.15, changePercent: 2.76, exchange: 'stocks' },
];

const MOCK_TRENDING: Asset[] = [
  { id: '11', symbol: 'LDO', name: 'Lido', price: 0.39, change: 0.038, changePercent: 10.78, exchange: 'crypto' },
  { id: '12', symbol: 'DOT', name: 'Polkadot', price: 1.27, change: 0.118, changePercent: 10.22, exchange: 'crypto' },
];

const MOCK_NEWS = [
  { id: '1', title: 'US Jobs Data Boosts Market Sentiment', summary: 'Strong US job figures have reassured investors, leading to gains across major indices.', source: 'reuters', timestamp: Date.now() - 3600000, icon: '📊' },
  { id: '2', title: 'Fed Chair Hints at Rate Pause', summary: 'The Federal Reserve Chairman indicated that the central bank may pause rate hikes.', source: 'bloomberg', timestamp: Date.now() - 7200000, icon: '🏦' },
];

const initialStatus: HarnessStatus = {
  mode: 'paper-only',
  connection: 'disconnected',
  isAutoLoop: false,
  cycles: 0,
  equity: 0,
  dayPnL: 0,
  dayPnLPercent: 0,
  openPositions: 0,
  halted: false,
  exchanges: [],
};

export function useHarness() {
  const [status, setStatus] = useState<HarnessStatus>(initialStatus);
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<Asset[]>(MOCK_ASSETS);
  const [trending] = useState<Asset[]>(MOCK_TRENDING);
  const [news] = useState(MOCK_NEWS);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const hydrate = useCallback(async () => {
    try {
      const [root, risk] = await Promise.all([api.getStatus(), api.getRisk()]);
      if (!mountedRef.current) return;

      const positionsList = (risk.state.openPositions || []).map(toPosition);
      const equity = Number(risk.state.equity ?? 0);
      const dayPnL = Number(risk.state.dailyPnL ?? 0);
      const startingCapital = Number(risk.state.startingCapital ?? 0) || equity;

      setPositions(positionsList);
      setStatus(prev => ({
        ...prev,
        mode: root.mode,
        badge: root.badge,
        connection: 'connected',
        equity,
        dayPnL,
        dayPnLPercent: startingCapital > 0 ? (dayPnL / startingCapital) * 100 : 0,
        openPositions: positionsList.length,
        halted: risk.halted,
        haltReason: risk.haltReason,
        exchanges: Array.isArray(root.exchanges) ? root.exchanges : [],
      }));

      try {
        const markets = await api.scanMarkets(undefined, 10);
        if (mountedRef.current && markets.length > 0) setWatchlist(markets);
      } catch { /* non-fatal */ }
    } catch {
      if (mountedRef.current) {
        setStatus(prev => ({ ...prev, connection: 'disconnected' }));
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    hydrate().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });
    api.connectWebSocket();

    const pollTimer = setInterval(() => { hydrate(); }, POLL_MS);

    // Live WS updates: position add/update + trade events keep the list fresh
    // without re-fetching every 15s.
    const unsubConnection = api.on('connection', (data: unknown) => {
      if (!mountedRef.current) return;
      const msg = data as { status: string };
      if (msg.status === 'connected') {
        setStatus(prev => ({ ...prev, connection: 'connected' }));
        hydrate();
      } else if (msg.status === 'disconnected' || msg.status === 'error') {
        setStatus(prev => ({ ...prev, connection: 'reconnecting' }));
      }
    });

    const unsubPosition = api.on('position', (payload: unknown) => {
      if (!mountedRef.current) return;
      const raw = payload as Record<string, unknown> | null;
      if (!raw) return;
      const pos = toPosition(raw, 0);
      setPositions(prev => {
        const idx = prev.findIndex(p => p.exchange === pos.exchange && p.symbol === pos.symbol);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = pos;
          return next;
        }
        return [pos, ...prev];
      });
    });

    const unsubTrade = api.on('trade', () => {
      if (!mountedRef.current) return;
      // Trade events can change daily P&L + open-positions count — cheap refetch.
      hydrate();
    });

    return () => {
      mountedRef.current = false;
      clearInterval(pollTimer);
      unsubConnection();
      unsubPosition();
      unsubTrade();
      api.disconnect();
    };
  }, [hydrate]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await hydrate();
    if (mountedRef.current) setIsLoading(false);
  }, [hydrate]);

  const sendCommand = useCallback(async (command: string) => {
    try {
      return await api.sendCommand(command);
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Could not reach harness'}`;
    }
  }, []);

  const closePosition = useCallback(async (position: Position) => {
    const cmd = `close ${position.exchange} ${position.symbol}`;
    const response = await sendCommand(cmd);
    // Trigger refresh so the row disappears once the gateway confirms.
    hydrate();
    return response;
  }, [sendCommand, hydrate]);

  const panic = useCallback(async () => {
    try {
      await api.panic();
    } finally {
      hydrate();
    }
  }, [hydrate]);

  const searchAssets = useCallback(async (query: string) => {
    if (!query.trim()) return watchlist;
    try {
      const results = await api.searchMarkets(query);
      return results.length > 0 ? results : watchlist.filter(a =>
        a.symbol.toLowerCase().includes(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase())
      );
    } catch {
      return watchlist.filter(a =>
        a.symbol.toLowerCase().includes(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase())
      );
    }
  }, [watchlist]);

  // Derived view for legacy consumers (portfolio tab) that still want the
  // { cash, investments, ... } shape. Investments = sum of position market value.
  const investedValue = positions.reduce(
    (sum, p) => sum + Math.abs(p.size * p.currentPrice),
    0,
  );
  const startingCapital = status.equity - status.dayPnL - positions.reduce((s, p) => s + p.pnl, 0);
  const portfolio = {
    cash: Math.max(0, status.equity - investedValue),
    investments: investedValue,
    totalValue: status.equity,
    dayPnL: status.dayPnL,
    dayPnLPercent: status.dayPnLPercent,
    apy: 2.9,
    startingCapital,
  };

  return {
    status,
    positions,
    watchlist,
    trending,
    news,
    portfolio,
    isLoading,
    sendCommand,
    closePosition,
    panic,
    searchAssets,
    refresh,
  };
}
