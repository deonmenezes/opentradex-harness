import { useMemo, useState } from 'react';
import type { Trade } from '../lib/types';

interface TradesPageProps {
  trades: Trade[];
  onBack: () => void;
}

type Filter = 'all' | 'open' | 'closed' | 'pending';

export default function TradesPage({ trades, onBack }: TradesPageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.exchange.toLowerCase().includes(q) ||
        t.side.toLowerCase().includes(q)
      );
    });
  }, [trades, filter, search]);

  const totals = useMemo(() => {
    const closed = trades.filter((t) => t.status === 'closed');
    const realized = closed.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    return {
      total: trades.length,
      open: trades.filter((t) => t.status === 'open').length,
      closed: closed.length,
      realized,
      winRate,
    };
  }, [trades]);

  const counts: Record<Filter, number> = {
    all: totals.total,
    open: totals.open,
    closed: totals.closed,
    pending: trades.filter((t) => t.status === 'pending').length,
  };

  const formatPnL = (n: number) => `${n >= 0 ? '+' : ''}$${n.toFixed(2)}`;
  const formatTime = (ts: number) => new Date(ts).toLocaleString();

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
          <h1 className="text-lg md:text-xl font-bold text-text">Trades</h1>
        </div>

        {/* Summary stats */}
        <div className="hidden md:flex items-center gap-2">
          <div className="text-center px-3 py-1 rounded-lg bg-surface-2">
            <div className="text-sm font-bold text-text">{totals.total}</div>
            <div className="text-2xs text-text-dim">Total</div>
          </div>
          <div className="text-center px-3 py-1 rounded-lg bg-surface-2">
            <div className="text-sm font-bold text-warning">{totals.open}</div>
            <div className="text-2xs text-text-dim">Open</div>
          </div>
          <div className="text-center px-3 py-1 rounded-lg bg-surface-2">
            <div className={`text-sm font-bold ${totals.winRate >= 50 ? 'text-accent' : 'text-warning'}`}>{totals.winRate}%</div>
            <div className="text-2xs text-text-dim">Win</div>
          </div>
          <div className={`text-center px-3 py-1 rounded-lg ${totals.realized >= 0 ? 'bg-accent/10 border border-accent/30' : 'bg-danger/10 border border-danger/30'}`}>
            <div className={`text-sm font-bold ${totals.realized >= 0 ? 'text-accent' : 'text-danger'}`}>{formatPnL(totals.realized)}</div>
            <div className="text-2xs text-text-dim">Realized</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border bg-surface/60 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'open', 'closed', 'pending'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? 'bg-accent text-bg'
                  : 'bg-surface-2 text-text-dim hover:text-text border border-border'
              }`}
            >
              {f} <span className="ml-1 opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="md:ml-auto md:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol, exchange, side..."
            className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-dim text-sm">
            No trades match this filter.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border z-10">
              <tr className="text-left text-2xs uppercase tracking-wide text-text-dim">
                <th className="px-4 md:px-6 py-3">Time</th>
                <th className="px-4 py-3">Exchange</th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">P&amp;L</th>
                <th className="px-4 md:px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-surface-2 transition-colors">
                  <td className="px-4 md:px-6 py-3 text-text-dim whitespace-nowrap">{formatTime(t.timestamp)}</td>
                  <td className="px-4 py-3 text-text capitalize">{t.exchange}</td>
                  <td className="px-4 py-3 font-medium text-text">{t.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`text-2xs px-2 py-0.5 rounded font-semibold ${
                      t.side === 'yes' || t.side === 'long'
                        ? 'bg-accent/20 text-accent'
                        : 'bg-danger/20 text-danger'
                    }`}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text">{t.size}</td>
                  <td className="px-4 py-3 text-right text-text">${t.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.pnl !== undefined ? (
                      <span className={`font-semibold ${t.pnl >= 0 ? 'text-accent' : 'text-danger'}`}>
                        {formatPnL(t.pnl)}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-4 md:px-6 py-3">
                    <span className={`text-2xs px-2 py-0.5 rounded font-semibold capitalize ${
                      t.status === 'open'
                        ? 'bg-warning/20 text-warning'
                        : t.status === 'closed'
                          ? 'bg-surface-2 text-text-dim'
                          : 'bg-accent/10 text-accent'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
