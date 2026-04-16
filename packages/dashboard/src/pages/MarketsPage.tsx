import { useMemo, useState } from 'react';
import type { Market, Connector, ConnectorCategory } from '../lib/types';
import { connectorCatalog, categoryLabels } from '../lib/connectors';
import ConnectorLogo from '../components/ConnectorLogo';

interface MarketsPageProps {
  markets: Market[];
  onBack: () => void;
  onSelectMarket?: (market: Market) => void;
  onConnectorAction?: (connector: Connector) => void;
}

type Tab = 'connectors' | 'markets';
type SortKey = 'volume' | 'mid' | 'symbol';

function parseVolume(v: string): number {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  if (/K/i.test(v)) return n * 1_000;
  if (/M/i.test(v)) return n * 1_000_000;
  if (/B/i.test(v)) return n * 1_000_000_000;
  return n;
}

const statusStyles: Record<Connector['status'], { label: string; className: string; dot: string }> = {
  connected:    { label: 'Connected',    className: 'text-accent bg-accent/10 border-accent/30',   dot: 'bg-accent' },
  available:    { label: 'Available',    className: 'text-text-dim bg-surface-2 border-border',    dot: 'bg-text-dim' },
  beta:         { label: 'Beta',         className: 'text-warning bg-warning/10 border-warning/30', dot: 'bg-warning' },
  disconnected: { label: 'Disconnected', className: 'text-danger bg-danger/10 border-danger/30',   dot: 'bg-danger' },
};

const categoryOrder: (ConnectorCategory | 'all')[] = ['all', 'prediction', 'equities', 'crypto', 'forex', 'charts', 'sportsbook'];

export default function MarketsPage({ markets, onBack, onSelectMarket, onConnectorAction }: MarketsPageProps) {
  const [tab, setTab] = useState<Tab>('connectors');
  const [category, setCategory] = useState<ConnectorCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [exchange, setExchange] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('volume');

  const exchanges = useMemo(() => {
    const set = new Set(markets.map((m) => m.exchange));
    return ['all', ...Array.from(set).sort()];
  }, [markets]);

  const filteredConnectors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connectorCatalog.filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.capabilities.some((cap) => cap.toLowerCase().includes(q))
      );
    });
  }, [category, search]);

  const connectedCount = useMemo(() => connectorCatalog.filter((c) => c.status === 'connected').length, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = markets.filter((m) => {
      if (exchange !== 'all' && m.exchange !== exchange) return false;
      if (!q) return true;
      return (
        m.symbol.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.exchange.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => {
      if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol);
      if (sortKey === 'mid') return b.mid - a.mid;
      return parseVolume(b.volume) - parseVolume(a.volume);
    });
    return list;
  }, [markets, search, exchange, sortKey]);

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="h-14 md:h-16 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg md:text-xl font-bold text-text">Markets</h1>
          <div className="flex items-center gap-1 ml-2 p-0.5 rounded-lg bg-surface-2 border border-border">
            <button
              onClick={() => setTab('connectors')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                tab === 'connectors' ? 'bg-bg text-text shadow-sm' : 'text-text-dim hover:text-text'
              }`}
            >
              Connectors
              <span className="ml-1.5 text-2xs text-text-dim">{connectorCatalog.length}</span>
            </button>
            <button
              onClick={() => setTab('markets')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                tab === 'markets' ? 'bg-bg text-text shadow-sm' : 'text-text-dim hover:text-text'
              }`}
            >
              Live markets
              <span className="ml-1.5 text-2xs text-text-dim">{markets.length}</span>
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-accent">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            {connectedCount} connected
          </span>
        </div>
      </div>

      {tab === 'connectors' ? (
        <>
          {/* Connector filters */}
          <div className="border-b border-border bg-surface/60 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {categoryOrder.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === cat
                      ? 'bg-accent text-bg'
                      : 'bg-surface-2 text-text-dim hover:text-text border border-border'
                  }`}
                >
                  {cat === 'all' ? 'All' : categoryLabels[cat]}
                </button>
              ))}
            </div>
            <div className="md:ml-auto">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connectors..."
                className="w-full md:w-72 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Connector grid */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {filteredConnectors.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-dim text-sm">
                No connectors match this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {filteredConnectors.map((c) => {
                  const s = statusStyles[c.status];
                  return (
                    <article
                      key={c.id}
                      className="group relative flex flex-col gap-3 p-4 rounded-xl bg-surface border border-border hover:border-accent/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <ConnectorLogo id={c.id} size={44} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-text truncate">{c.name}</h3>
                            <span className={`inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border ${s.className}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {s.label}
                            </span>
                          </div>
                          <p className="text-2xs uppercase tracking-wide text-text-dim mt-0.5">
                            {categoryLabels[c.category]}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-text-dim leading-relaxed line-clamp-2">{c.tagline}</p>

                      <div className="flex flex-wrap gap-1.5">
                        {c.capabilities.map((cap) => (
                          <span key={cap} className="text-2xs px-1.5 py-0.5 rounded bg-surface-2 text-text-dim border border-border">
                            {cap}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-border mt-auto">
                        <button
                          onClick={() => onConnectorAction?.(c)}
                          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                            c.status === 'connected'
                              ? 'bg-surface-2 text-text hover:bg-card-hover'
                              : 'bg-accent/90 text-bg hover:bg-accent'
                          }`}
                        >
                          {c.status === 'connected' ? 'Manage' : 'Connect'}
                        </button>
                        {c.docsUrl && (
                          <a
                            href={c.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2.5 py-1.5 rounded-md bg-surface-2 text-text-dim hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            Docs
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Market filters */}
          <div className="border-b border-border bg-surface/60 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {exchanges.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setExchange(ex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    exchange === ex
                      ? 'bg-accent text-bg'
                      : 'bg-surface-2 text-text-dim hover:text-text border border-border'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 md:ml-auto">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent"
              >
                <option value="volume">Sort: Volume</option>
                <option value="mid">Sort: Price</option>
                <option value="symbol">Sort: Symbol</option>
              </select>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets..."
                className="w-48 md:w-72 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-dim text-sm">
                No markets match this filter.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface border-b border-border z-10">
                  <tr className="text-left text-2xs uppercase tracking-wide text-text-dim">
                    <th className="px-4 md:px-6 py-3">Exchange</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3 text-right">Bid / Ask</th>
                    <th className="px-4 py-3 text-right">Mid</th>
                    <th className="px-4 md:px-6 py-3 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => onSelectMarket?.(m)}
                      className="border-b border-border hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <td className="px-4 md:px-6 py-3 text-text capitalize">
                        <span className="inline-flex items-center gap-2">
                          <ConnectorLogo id={m.exchange} size={22} />
                          {m.exchange}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text">{m.symbol}</td>
                      <td className="px-4 py-3 text-text-dim max-w-md truncate">{m.title}</td>
                      <td className="px-4 py-3 text-right text-text font-mono">{m.bidAsk}</td>
                      <td className="px-4 py-3 text-right text-accent font-semibold">{m.mid}¢</td>
                      <td className="px-4 md:px-6 py-3 text-right text-text">{m.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
