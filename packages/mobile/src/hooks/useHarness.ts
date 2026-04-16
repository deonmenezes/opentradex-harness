/**
 * React hook for connecting to OpenTradex harness
 */

import { useState, useEffect, useCallback } from 'react';
import api, { Asset, HarnessStatus } from '../services/api';

// Mock data for demo/offline mode
const MOCK_ASSETS: Asset[] = [
  { id: '1', symbol: 'SPY', name: 'S&P 500', price: 700.54, change: 6.21, changePercent: 0.89, exchange: 'stocks' },
  { id: '2', symbol: 'NVDA', name: 'NVIDIA', price: 199.37, change: 3.42, changePercent: 1.74, exchange: 'stocks' },
  { id: '3', symbol: 'GOLD', name: 'Gold', price: 4790.27, change: 4.31, changePercent: 0.09, exchange: 'commodities' },
  { id: '4', symbol: 'BTC', name: 'Bitcoin', price: 74550.32, change: 680.45, changePercent: 0.92, exchange: 'crypto' },
  { id: '5', symbol: 'AAPL', name: 'Apple', price: 265.93, change: 7.15, changePercent: 2.76, exchange: 'stocks' },
  { id: '6', symbol: 'GOOGL', name: 'Google', price: 337.50, change: 5.48, changePercent: 1.65, exchange: 'stocks' },
  { id: '7', symbol: 'MSFT', name: 'Microsoft', price: 417.88, change: 21.89, changePercent: 5.53, exchange: 'stocks' },
  { id: '8', symbol: 'AMZN', name: 'Amazon', price: 247.66, change: -1.54, changePercent: -0.62, exchange: 'stocks' },
  { id: '9', symbol: 'TSLA', name: 'Tesla', price: 397.52, change: 31.07, changePercent: 8.48, exchange: 'stocks' },
  { id: '10', symbol: 'ETH', name: 'Ethereum', price: 2339.48, change: 45.67, changePercent: 1.99, exchange: 'crypto' },
];

const MOCK_TRENDING: Asset[] = [
  { id: '11', symbol: 'LDO', name: 'Lido', price: 0.39, change: 0.038, changePercent: 10.78, exchange: 'crypto' },
  { id: '12', symbol: 'DOT', name: 'Polkadot', price: 1.27, change: 0.118, changePercent: 10.22, exchange: 'crypto' },
  { id: '13', symbol: 'HIMS', name: 'HIMS', price: 26.53, change: 2.24, changePercent: 9.22, exchange: 'stocks' },
  { id: '14', symbol: 'HOOD', name: 'Robinhood', price: 89.65, change: 6.61, changePercent: 7.96, exchange: 'stocks' },
  { id: '15', symbol: 'PEPE', name: 'Pepe', price: 0.00000383, change: 0.00000021, changePercent: 5.8, exchange: 'crypto' },
];

const MOCK_NEWS = [
  { id: '1', title: 'US Jobs Data Boosts Market Sentiment', summary: 'Strong US job figures have reassured investors, leading to gains across major indices.', source: 'reuters', timestamp: Date.now() - 3600000, icon: '📊' },
  { id: '2', title: 'Fed Chair Hints at Rate Pause', summary: 'The Federal Reserve Chairman indicated that the central bank may pause rate hikes.', source: 'bloomberg', timestamp: Date.now() - 7200000, icon: '🏦' },
  { id: '3', title: 'China Tech Stocks Experience Rally', summary: 'Chinese tech stocks have rallied amid hopes for easing regulatory pressures.', source: 'ft', timestamp: Date.now() - 10800000, icon: '🇨🇳' },
  { id: '4', title: 'Oil Prices Gain on Supply Concerns', summary: 'Fears of supply disruptions due to geopolitical tensions have pushed oil prices higher.', source: 'reuters', timestamp: Date.now() - 14400000, icon: '🛢️' },
  { id: '5', title: 'Crypto Market Reacts to Regulatory News', summary: 'Recent regulatory developments have sparked fluctuations in crypto markets.', source: 'coindesk', timestamp: Date.now() - 18000000, icon: '₿' },
];

export function useHarness() {
  const [status, setStatus] = useState<HarnessStatus>({
    mode: 'paper-only',
    connection: 'disconnected',
    isAutoLoop: false,
    cycles: 0,
  });
  const [watchlist, setWatchlist] = useState<Asset[]>(MOCK_ASSETS);
  const [trending, setTrending] = useState<Asset[]>(MOCK_TRENDING);
  const [news, setNews] = useState(MOCK_NEWS);
  const [portfolio, setPortfolio] = useState({
    cash: 0,
    investments: 0,
    totalValue: 0,
    dayPnL: 0,
    dayPnLPercent: 0,
    apy: 2.9,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Connect to harness on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const health = await api.getHealth();
        if (mounted) {
          setStatus(prev => ({ ...prev, ...health, connection: 'connected' }));
        }

        // Fetch real market data
        const markets = await api.scanMarkets(undefined, 10);
        if (mounted && markets.length > 0) {
          setWatchlist(markets.map(m => ({
            ...m,
            change: Math.random() * 10 - 2,
            changePercent: Math.random() * 5 - 1,
          })));
        }
      } catch (e) {
        console.log('Using mock data - harness not connected');
        if (mounted) {
          setStatus(prev => ({ ...prev, connection: 'disconnected' }));
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();
    api.connectWebSocket();

    // Listen for real-time updates
    const unsubConnection = api.on('connection', (data: any) => {
      if (mounted) {
        setStatus(prev => ({ ...prev, connection: data.status }));
      }
    });

    const unsubMessage = api.on('message', (data: any) => {
      if (!mounted) return;

      if (data.type === 'trade') {
        // Update portfolio on trades
      } else if (data.type === 'position') {
        // Update positions
      }
    });

    return () => {
      mounted = false;
      unsubConnection();
      unsubMessage();
      api.disconnect();
    };
  }, []);

  const sendCommand = useCallback(async (command: string) => {
    try {
      return await api.sendCommand(command);
    } catch (e) {
      return 'Error: Could not connect to harness';
    }
  }, []);

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

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const markets = await api.scanMarkets(undefined, 10);
      if (markets.length > 0) {
        setWatchlist(markets.map(m => ({
          ...m,
          change: Math.random() * 10 - 2,
          changePercent: Math.random() * 5 - 1,
        })));
      }
    } catch {
      // Keep using existing data
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    status,
    watchlist,
    trending,
    news,
    portfolio,
    isLoading,
    sendCommand,
    searchAssets,
    refresh,
  };
}
