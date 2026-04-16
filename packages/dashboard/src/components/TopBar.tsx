import { useState, useEffect, memo } from 'react';
import type { HarnessStatus } from '../lib/types';

interface TopBarProps {
  status: HarnessStatus;
  onRunCycle?: () => void;
  onToggleAutoLoop?: () => void;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
}

// Memoized TopBar to prevent unnecessary re-renders
export default memo(function TopBar({
  status,
  onRunCycle,
  onToggleAutoLoop,
  onToggleLeftSidebar,
  onToggleRightSidebar
}: TopBarProps) {
  const [pnlFlash, setPnlFlash] = useState(false);
  const [prevPnL, setPrevPnL] = useState(status.dayPnL);

  // Flash animation when P&L changes
  useEffect(() => {
    if (status.dayPnL !== prevPnL) {
      setPnlFlash(true);
      setPrevPnL(status.dayPnL);
      const timer = setTimeout(() => setPnlFlash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [status.dayPnL, prevPnL]);

  const modeColors = {
    'paper-only': 'bg-accent/20 text-accent border border-accent/30',
    'paper-default': 'bg-warning/20 text-warning border border-warning/30',
    'live-allowed': 'bg-danger/20 text-danger border border-danger/30 animate-pulse',
  };

  const modeLabels = {
    'paper-only': 'PAPER',
    'paper-default': 'PAPER',
    'live-allowed': 'LIVE',
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const formatPnL = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return sign + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
  };

  return (
    <header className="h-14 md:h-16 bg-surface border-b border-border flex items-center justify-between px-3 md:px-5 shrink-0">
      {/* Left: Mobile Menu + Logo */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Menu Button - Left Sidebar */}
        <button
          onClick={onToggleLeftSidebar}
          className="lg:hidden p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-lg shadow-accent/20">
            <svg className="w-5 h-5 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-text hidden sm:block">OPENTRADEX</span>
        </div>

        {/* Connection Status - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2">
          <div className={`w-2 h-2 rounded-full ${status.connection === 'connected' ? 'bg-accent shadow-sm shadow-accent' : 'bg-danger'}`} />
          <span className="text-xs text-text-dim capitalize">{status.connection === 'connected' ? 'Live' : status.connection}</span>
        </div>

        {/* Trading Mode */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-semibold ${modeColors[status.mode]}`}>
          {modeLabels[status.mode]}
        </div>
      </div>

      {/* Center: Capital & P&L */}
      <div className="flex items-center gap-2 md:gap-6">
        {/* Capital */}
        <div className="text-center">
          <div className="text-lg md:text-2xl lg:text-3xl font-bold text-text tracking-tight">
            {formatCurrency(status.capital)}
          </div>
          <div className="text-2xs md:text-xs text-text-dim hidden sm:block">Portfolio</div>
        </div>

        {/* Day P&L */}
        <div className={`text-center px-3 md:px-4 py-1 md:py-2 rounded-lg transition-all duration-300 ${
          status.dayPnL >= 0
            ? 'bg-accent/10 border border-accent/30'
            : 'bg-danger/10 border border-danger/30'
        } ${pnlFlash ? 'scale-105' : ''}`}>
          <div className={`text-sm md:text-lg lg:text-xl font-bold ${status.dayPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {formatPnL(status.dayPnL)}
          </div>
          <div className="text-2xs text-text-dim hidden sm:block">Day P&L</div>
        </div>

        {/* Stats - Hidden on small screens */}
        <div className="hidden xl:flex items-center gap-2">
          <div className="text-center px-3 py-1 rounded-lg bg-surface-2">
            <div className="text-lg font-bold text-text">{status.trades}</div>
            <div className="text-2xs text-text-dim">Trades</div>
          </div>
          <div className="text-center px-3 py-1 rounded-lg bg-surface-2">
            <div className={`text-lg font-bold ${status.winRate >= 50 ? 'text-accent' : 'text-warning'}`}>{status.winRate}%</div>
            <div className="text-2xs text-text-dim">Win</div>
          </div>
          <div className="text-center px-3 py-1 rounded-lg bg-surface-2">
            <div className="text-lg font-bold text-text">{status.openPositions}</div>
            <div className="text-2xs text-text-dim">Open</div>
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Run Cycle - Responsive */}
        <button
          onClick={onRunCycle}
          className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg bg-accent text-bg font-semibold text-sm shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
          <span className="hidden sm:inline">Run</span>
        </button>

        {/* Auto Loop - Responsive */}
        <button
          onClick={onToggleAutoLoop}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
            status.isAutoLoop
              ? 'bg-accent text-bg shadow-lg shadow-accent/30'
              : 'bg-surface-2 text-text border border-border hover:border-accent'
          }`}
        >
          <svg className={`w-4 h-4 ${status.isAutoLoop ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden md:inline">{status.isAutoLoop ? 'Stop' : 'Loop'}</span>
        </button>

        {/* Mobile Menu Button - Right Sidebar */}
        <button
          onClick={onToggleRightSidebar}
          className="lg:hidden p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </button>
      </div>
    </header>
  );
});
