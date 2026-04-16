# OpenTradex

Lightweight AI trading harness for prediction markets, stocks, and crypto. Zero dependencies, paper-first design, runs anywhere Node 18+ or Bun works.

## Features

- **Multi-Market Support**: Kalshi, Polymarket, Alpaca (stocks), crypto via CoinGecko/Kraken
- **Paper-First**: Default to paper trading, easily switchable to live
- **Risk Engine**: Hard-coded caps, daily loss limits, kill switches
- **Local Gateway**: HTTP API for AI agents to call
- **Mode Lock**: `paper-only` / `paper-default` / `live-allowed` - choose your safety level

## Install

```bash
npm install -g opentradex
# or
bun add -g opentradex
# or use npx
npx opentradex
```

## Quick Start

### 1. Onboard (first time setup)

```bash
# Safe mode - paper trading only, can never switch to live
opentradex onboard --paper-only

# Or interactive setup with more options
opentradex onboard
```

The wizard walks you through:
1. Trading mode selection
2. Network bind mode (local/lan/tunnel)
3. Rail credentials (Kalshi, Polymarket, Alpaca)
4. Risk profile configuration
5. AI model selection

### 2. Run the Gateway

```bash
opentradex run
```

This starts the HTTP gateway at `http://localhost:3210` (configurable).

### 3. Query Markets

```bash
# Scan all markets
opentradex scan

# Scan specific exchange
opentradex scan kalshi 20

# Search across all exchanges
opentradex search "bitcoin"

# Get quote with orderbook
opentradex quote crypto BTC
```

### 4. Emergency Stop

```bash
opentradex panic
```

Flattens all positions and halts trading.

## Trading Modes

| Mode | Behavior | Live Flip |
|------|----------|-----------|
| `paper-only` | All trades go to paper endpoints. Cannot switch to live. | None - must re-onboard |
| `paper-default` | Starts paper, can flip to live after 24h demo | CLI + email code |
| `live-allowed` | Can trade live immediately (power user) | Direct |

The mode is locked in `~/.opentradex/mode.lock` and enforced by both the Execute loop and rail clients.

## Gateway API

Start with `opentradex run`, then:

| Endpoint | Params | Description |
|----------|--------|-------------|
| `GET /` | - | Health check, list exchanges |
| `GET /scan` | `exchange?`, `limit?` | Scan markets |
| `GET /search` | `q`, `exchange?` | Search markets |
| `GET /quote` | `exchange`, `symbol` | Get quote + orderbook |
| `GET /orderbook` | `exchange`, `symbol` | Raw orderbook |

### Example

```bash
curl http://localhost:3210/scan?exchange=kalshi&limit=10
curl http://localhost:3210/search?q=bitcoin
curl http://localhost:3210/quote?exchange=crypto&symbol=BTC
```

## Library Usage

```typescript
import { createHarness } from 'opentradex';

const harness = createHarness({
  kalshi: { demo: true },
  alpaca: { paper: true },
});

// Scan all markets
const markets = await harness.scanAll(10);

// Search
const results = await harness.searchAll('tariffs');

// Get specific exchange
const kalshi = harness.exchange('kalshi');
const quote = await kalshi.quote('TICKER-123');
```

## Supported Exchanges

| Exchange | Type | Features |
|----------|------|----------|
| `kalshi` | Prediction Market | Events, elections, orderbook |
| `polymarket` | Prediction Market | Crypto-native, CLOB |
| `alpaca` | Stocks/ETFs | Paper + live, US markets |
| `tradingview` | Stocks | Yahoo Finance data |
| `crypto` | Cryptocurrency | CoinGecko + Kraken orderbook |

## Risk Engine

Hard-coded safety rails that never consult the LLM:

- **Max Position Size**: Configurable USD cap per position
- **Max Daily Loss**: Halt trading when limit reached
- **Max Open Positions**: Limit concurrent positions
- **Daily Drawdown Kill**: Emergency halt at X% drawdown
- **Kelly Sizing**: Built-in position sizing with quarter-Kelly default

```bash
# Check risk state
opentradex risk
```

## Configuration

Config stored in `~/.opentradex/`:

```
~/.opentradex/
├── config.json     # Main configuration
├── mode.lock       # Trading mode (paper-only/paper-default/live-allowed)
├── auth.json       # Hashed auth token for remote access
├── audit/          # Trade audit logs (YYYY-MM-DD.jsonl)
└── skills/         # Custom trading skills (*.md)
```

### Commands

```bash
opentradex config path    # Show config directory
opentradex config show    # Dump full config
opentradex config mode    # Show trading mode
opentradex status         # Formatted status view
```

## Architecture

```
opentradex/
├── src/
│   ├── index.ts          # Main harness class
│   ├── types.ts          # TypeScript types
│   ├── config.ts         # Config management + mode lock
│   ├── risk.ts           # Risk engine + Kelly sizing
│   ├── onboard.ts        # Interactive setup wizard
│   ├── markets/
│   │   ├── base.ts       # HTTP utilities
│   │   ├── kalshi.ts     # Kalshi connector
│   │   ├── polymarket.ts # Polymarket connector
│   │   ├── alpaca.ts     # Alpaca connector
│   │   ├── tradingview.ts # Stocks via Yahoo
│   │   └── crypto.ts     # CoinGecko + Kraken
│   ├── gateway/
│   │   └── index.ts      # HTTP gateway server
│   └── bin/
│       └── cli.ts        # CLI entry point
```

## For AI Agents

This harness is designed to be called by AI agents:

1. **Start gateway**: `opentradex run`
2. **Agent makes HTTP calls** to `localhost:3210`
3. **All responses are JSON** for easy parsing

The LLM is the **strategist** (decides what to trade), but the harness is the **executor** (enforces risk, routes to paper/live).

## Roadmap

- [ ] WebSocket streaming for real-time data
- [ ] Think loop integration with pi-agent-core
- [ ] Feed layer (X, Reddit, RSS)
- [ ] Dashboard UI
- [ ] Slack/Discord alerts (opentradex-mouth)
- [ ] Cloudflare Tunnel integration

## License

MIT
