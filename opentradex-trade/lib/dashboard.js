#!/usr/bin/env node
/**
 * OpenTradex Trading Plugin — zero-dep local dashboard.
 * Serves a single HTML page at http://localhost:<port> that polls the ledger
 * every 2s. Refresh button re-scans enabled rails and marks open positions.
 */
import { createServer } from 'node:http';
import { readKeys, enabledRails } from './keys.js';
import {
  listPositions, listTrades, markToMarket, dailyPnl, getPanicCooldown,
} from './ledger.js';

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>OpenTradex — Paper Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --bg: #0b0d10; --panel: #14181d; --muted: #7a8290; --fg: #e7ecf3;
    --accent: #6ee7b7; --danger: #f87171; --warn: #fbbf24; --border: #22272e;
  }
  * { box-sizing: border-box; }
  html, body { background: var(--bg); color: var(--fg); margin: 0; font: 13px/1.4 ui-monospace, Menlo, Consolas, monospace; }
  header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--border); }
  h1 { font-size: 15px; margin: 0; letter-spacing: 0.5px; }
  h1 .paper { color: var(--warn); font-weight: normal; margin-left: 10px; }
  .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; }
  .card .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; }
  .card .value { font-size: 22px; margin-top: 4px; font-weight: 500; }
  .value.pos { color: var(--accent); }
  .value.neg { color: var(--danger); }
  .value.warn { color: var(--warn); }
  section { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 20px; }
  section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: normal; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  .empty { padding: 24px 16px; color: var(--muted); text-align: center; }
  .toolbar { display: flex; gap: 10px; align-items: center; }
  button { background: var(--panel); color: var(--fg); border: 1px solid var(--border); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
  button:hover { background: #1a1f26; border-color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #1a1f26; color: var(--muted); }
  .pill.buy { color: var(--accent); }
  .pill.sell { color: var(--danger); }
  .cooldown { color: var(--danger); font-size: 11px; }
  .muted { color: var(--muted); }
  .sym { font-size: 12px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }
</style>
</head>
<body>
<header>
  <h1>OpenTradex <span class="paper">PAPER</span></h1>
  <div class="toolbar">
    <span id="last-update" class="muted"></span>
    <button id="refresh">Refresh prices</button>
  </div>
</header>
<div class="container">
  <div class="grid">
    <div class="card"><div class="label">Open positions</div><div class="value" id="kpi-open">—</div></div>
    <div class="card"><div class="label">Exposure</div><div class="value" id="kpi-exposure">—</div></div>
    <div class="card"><div class="label">Today's P&amp;L</div><div class="value" id="kpi-pnl">—</div></div>
    <div class="card"><div class="label">Cooldown</div><div class="value" id="kpi-cooldown">—</div></div>
  </div>

  <section>
    <h2>Open positions</h2>
    <div id="positions"></div>
  </section>

  <section>
    <h2>Recent trades (last 10)</h2>
    <div id="trades"></div>
  </section>
</div>

<script>
  const fmt = (n, d=2) => (n==null||isNaN(n)) ? '—' : Number(n).toFixed(d);
  const fmtUsd = n => (n>=0?'+':'') + '$' + fmt(Math.abs(n));
  const pill = side => '<span class="pill '+(side||'')+'">'+(side||'?')+'</span>';

  async function fetchState() {
    const r = await fetch('/api/state'); return r.json();
  }
  async function refreshPrices() {
    const btn = document.getElementById('refresh');
    btn.disabled = true; btn.textContent = 'Refreshing…';
    try { await fetch('/api/refresh', {method:'POST'}); await render(); }
    finally { btn.disabled = false; btn.textContent = 'Refresh prices'; }
  }

  function renderPositions(positions) {
    const el = document.getElementById('positions');
    if (!positions.length) { el.innerHTML = '<div class="empty">No open positions. Use /opentradex-trade:buy to open one.</div>'; return; }
    const rows = positions.map(p => {
      const pnl = p.unrealizedPnl || 0;
      const pnlClass = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : 'muted';
      return '<tr>'
        + '<td>' + p.rail + '</td>'
        + '<td><span class="sym" title="' + p.symbol + '">' + p.symbol + '</span></td>'
        + '<td>' + pill(p.side) + '</td>'
        + '<td class="num">' + fmt(p.qty, 4) + '</td>'
        + '<td class="num">' + fmt(p.entry) + '</td>'
        + '<td class="num">' + fmt(p.mark) + '</td>'
        + '<td class="num ' + pnlClass + '">' + fmtUsd(pnl) + '</td>'
        + '</tr>';
    }).join('');
    el.innerHTML = '<table><thead><tr><th>Rail</th><th>Symbol</th><th>Side</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">Unrealized</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderTrades(trades) {
    const el = document.getElementById('trades');
    if (!trades.length) { el.innerHTML = '<div class="empty">No realized trades yet.</div>'; return; }
    const rows = trades.slice(-10).reverse().map(t => {
      const pnl = t.pnl || 0;
      const pnlClass = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : 'muted';
      return '<tr>'
        + '<td class="muted">' + (t.closedAt||'').slice(11,19) + '</td>'
        + '<td>' + t.rail + '</td>'
        + '<td><span class="sym" title="' + t.symbol + '">' + t.symbol + '</span></td>'
        + '<td>' + pill(t.side) + '</td>'
        + '<td class="num">' + fmt(t.qty, 4) + '</td>'
        + '<td class="num">' + fmt(t.entry) + '</td>'
        + '<td class="num">' + fmt(t.exit) + '</td>'
        + '<td class="num ' + pnlClass + '">' + fmtUsd(pnl) + '</td>'
        + '</tr>';
    }).join('');
    el.innerHTML = '<table><thead><tr><th>Closed</th><th>Rail</th><th>Symbol</th><th>Side</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Exit</th><th class="num">P&amp;L</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderKpis(state) {
    const total = state.dailyTotal || 0;
    const totalEl = document.getElementById('kpi-pnl');
    totalEl.textContent = fmtUsd(total);
    totalEl.className = 'value ' + (total > 0 ? 'pos' : total < 0 ? 'neg' : '');

    document.getElementById('kpi-open').textContent = state.openPositions || 0;
    document.getElementById('kpi-exposure').textContent = '$' + fmt(state.exposure || 0);

    const cdEl = document.getElementById('kpi-cooldown');
    if (state.panicCooldown && state.panicCooldown > Date.now()) {
      const mins = Math.ceil((state.panicCooldown - Date.now()) / 60000);
      cdEl.textContent = mins + 'm left';
      cdEl.className = 'value warn';
    } else {
      cdEl.textContent = 'none';
      cdEl.className = 'value muted';
    }
  }

  async function render() {
    try {
      const state = await fetchState();
      renderKpis(state);
      renderPositions(state.positions || []);
      renderTrades(state.trades || []);
      document.getElementById('last-update').textContent = 'updated ' + new Date().toLocaleTimeString();
    } catch (e) {
      document.getElementById('last-update').textContent = 'error: ' + e.message;
    }
  }

  document.getElementById('refresh').addEventListener('click', refreshPrices);
  render();
  setInterval(render, 2000);
</script>
</body>
</html>`;

async function refreshMarks() {
  const keys = readKeys();
  const rails = enabledRails();
  const positions = listPositions();
  if (!positions.length || !rails.length) return;

  // Map of rail -> unique symbols we need to price
  const want = new Map();
  for (const p of positions) {
    if (!want.has(p.rail)) want.set(p.rail, new Set());
    want.get(p.rail).add(p.symbol);
  }

  const rails_by_name = await loadRailMap();
  for (const [rail, symbols] of want) {
    const def = rails_by_name[rail];
    if (!def) continue;
    try {
      const rows = await def.scan({ creds: keys[rail] || {}, limit: 50 });
      for (const row of rows) {
        if (!symbols.has(row.symbol)) continue;
        const price = Number(row.last ?? row.bid ?? row.yesBid ?? row.ask ?? 0);
        if (price > 0) markToMarket(rail, row.symbol, price);
      }
    } catch {}
  }
}

async function loadRailMap() {
  const [kalshi, polymarket, alpaca, coinbase] = await Promise.all([
    import('../rails/kalshi.js'),
    import('../rails/polymarket.js'),
    import('../rails/alpaca.js'),
    import('../rails/coinbase.js'),
  ]);
  return { kalshi, polymarket, alpaca, coinbase };
}

function computeState() {
  const positions = listPositions();
  const trades = listTrades();
  const pnl = dailyPnl();
  const exposure = positions.reduce((a, p) => a + Math.abs(p.qty * (p.mark || p.entry)), 0);
  return {
    positions,
    trades: trades.slice(-20),
    openPositions: positions.length,
    exposure: Number(exposure.toFixed(2)),
    dailyRealized: Number(pnl.realized.toFixed(2)),
    dailyUnrealized: Number(pnl.unrealized.toFixed(2)),
    dailyTotal: Number(pnl.total.toFixed(2)),
    panicCooldown: getPanicCooldown(),
    serverNow: Date.now(),
  };
}

export function startDashboard({ port = 3300, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    const url = req.url || '/';
    try {
      if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(INDEX_HTML);
      }
      if (req.method === 'GET' && url === '/api/state') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(computeState()));
      }
      if (req.method === 'POST' && url === '/api/refresh') {
        await refreshMarks();
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, ...computeState() }));
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not found' }));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      process.stdout.write(`OpenTradex dashboard running at ${url}\n`);
      process.stdout.write(`Press Ctrl-C to stop.\n`);
      resolve({ url, server });
    });
  });
}
