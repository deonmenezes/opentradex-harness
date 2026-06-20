# OpenTradex

An open-source AI trading cockpit harness for prediction markets, equities, crypto, and forex. Paper-mode by default; live trading requires explicit opt-in. Includes a CLI harness, web dashboard, Electron desktop app, iOS SwiftUI client, and Expo mobile app.

## Tech Stack

- **Language:** TypeScript (ESM, Node >= 18)
- **Harness / CLI:** Node.js, custom AI provider adapters (Anthropic, Google, OpenAI-compatible, Claude CLI)
- **Web Dashboard:** React 18, Vite, Tailwind CSS
- **Desktop:** Electron 31
- **Mobile (iOS):** SwiftUI (native)
- **Mobile (cross-platform):** Expo React Native
- **Notable libs:** `@anthropic-ai/sdk`, `viem`, `qrcode`, `x402-fetch`
- **Monorepo:** npm workspaces

## Setup

```bash
npm install           # installs root + all workspace packages

# First-time wizard (sets paper mode, drops API keys into ~/.opentradex/config.json)
npx opentradex onboard --paper-only
```

Config lives at `~/.opentradex/config.json` — never committed to the repo.

## Build / Run / Test

```bash
# Build harness (TypeScript -> dist/)
npm run build

# Build everything (harness + dashboard)
npm run build:all

# Run the gateway (HTTP + WebSocket on :3210)
npm run gateway
# or
npx opentradex run

# Web dashboard (served by gateway at / in prod; dev HMR on :5173)
npm run dev:dashboard
npm run ui            # production web UI

# Electron desktop (dev, with live gateway)
npm run desktop

# Tests (Node built-in test runner via tsx)
npm test

# Live connector integration tests (requires real API keys)
npm run test:live

# Clean all build artifacts
npm run clean
```

## Project Structure

```
src/                         Core harness
  agent/                     Scanner, executor, risk manager, runner, logger
  ai/                        AI provider registry + adapters (Anthropic, Gemini, OpenAI-compat, CLIs)
  markets/                   Per-exchange connectors (Polymarket, Kalshi, Alpaca, Binance, etc.)
  gateway/                   HTTP + WebSocket + SSE server (:3210)
  mcp/                       MCP bridge (TradingView etc.)
  risk.ts                    Kelly sizing, daily-loss caps, kill switches
  config.ts                  Config load/save + live-mode lock
  onboard.ts                 Interactive first-run wizard
  bin/cli.ts                 `opentradex` CLI entry point
packages/
  dashboard/                 React + Vite web cockpit (TopBar, LeftSidebar, ChatCockpit, RightSidebar)
  desktop/                   Electron shell for Windows / macOS / Linux
  ios/                       Native SwiftUI client (OpenTradex.xcodeproj)
  mobile/                    Expo React Native (iOS + Android)
docs/                        Screenshots, design notes
scripts/                     Build helpers (copy-assets.js)
tsconfig.json                Root TypeScript config
```

## Architecture & Key Files

- **`src/bin/cli.ts`** — CLI entry; `opentradex run` boots the gateway, `opentradex onboard` runs setup.
- **`src/gateway/`** — single HTTP/WS server all clients connect to (`:3210`). REST + WebSocket events (`position`, `trade`, `feed`, `market`, `command`, `panic`, `heartbeat`). SSE fallback at `/api/events`.
- **`src/markets/<name>.ts`** — each connector exports `scan`, `quote`, and `send`; the harness auto-discovers files dropped here.
- **`src/ai/providers/`** — provider adapters; configured via `~/.opentradex/config.json` `ai` block.
- **`src/risk.ts`** — enforced on every outbound order; no runtime bypass.
- **`src/config.ts`** — trading mode lock; live trading requires 24h timer + explicit confirmation.
- **`packages/dashboard/`** — Vite SPA served by the gateway; design tokens in CSS vars (dark terminal palette).
- **`packages/desktop/`** — Electron shell that spawns the gateway and loads the dashboard.

## Conventions & Notes for Agents

- **Paper-first safety**: live trading is gated by `src/config.ts` on every order — never bypass this.
- Adding a new market connector: create `src/markets/<name>.ts` exporting `scan`, `quote`, `send` — harness auto-discovers it.
- AI provider config goes in `~/.opentradex/config.json`, not in env vars or the repo.
- Tests use Node's built-in test runner via `tsx --test`; no Jest/Vitest.
- The monorepo uses npm workspaces — run `npm install` from root, not inside packages individually.
- Desktop code signing is skipped when `CSC_LINK` / Apple notarization env vars are absent (safe for local dev).
- Design tokens (dark terminal palette): `--bg #0B0F14`, `--accent #3FB68B`, `--danger #E5484D`.
- Gateway API is documented in the README — treat it as the stable contract between all clients.
- `npm run test:live` requires real exchange API keys; never run in CI without secrets configured.
