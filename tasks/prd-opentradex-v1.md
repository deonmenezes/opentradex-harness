# PRD: OpenTradex v1.0 — Gateway Hardening, Mobile Completion, Desktop Security & Frictionless Onboarding

## Introduction

OpenTradex is an open-source AI trading harness that lets users run AI agents against prediction markets, equities, crypto, and forex through a single local-first cockpit. Today the repo ships a working gateway, React dashboard, Electron desktop shell, Expo mobile app, CLI onboarding wizard, 7 market connectors, and an agent runtime — but the surfaces are uneven: the gateway still has rough edges, the mobile app has tab stubs (`index`, `markets`, `portfolio`, `command`, `settings`) with incomplete button behaviour, the desktop app isn't hardened for distribution, and onboarding (especially CLI) has too many prompts for a first-time user.

This PRD defines v1.0: a **rock-solid gateway**, a **mobile app where every button works start-to-finish**, a **secure desktop app with frictionless AI key management**, and **onboarding that gets a new user from zero to paper-trading in under 90 seconds** (CLI and GUI).

## Goals

- Gateway passes a defined reliability bar: zero unhandled promise rejections, all 15+ API routes covered by tests, WebSocket reconnection works, auth never bypassable.
- Every interactive control in the mobile app is wired to a real backend call and returns a visible result or error — no dead buttons.
- Desktop app ships as a code-signed installer (Win/Mac), runs with `contextIsolation: true` + `nodeIntegration: false`, and stores API keys in OS keychain.
- Onboarding (CLI + GUI) finishes in ≤ 5 user inputs and ≤ 90 seconds for the default paper-mode path.
- AI provider setup is one-click for any installed local CLI (Claude Code, opencode, Gemini CLI) and ≤ 2 fields for cloud providers.

## User Stories

### US-001: Gateway — graceful error handling on all routes
**Description:** As a client developer, I want the gateway to return a consistent JSON error on any failure so my clients don't hang or get HTML error pages.

**Acceptance Criteria:**
- [ ] Every route in `src/gateway/index.ts` is wrapped so thrown errors return `{ error: string, code: string }` with correct HTTP status
- [ ] No route can crash the process — an uncaught rejection in a handler is logged and responded to
- [ ] Timeout guard: any route taking > 30s returns 504 with `{ error: 'Gateway timeout', code: 'TIMEOUT' }`
- [ ] Add `tests/gateway.test.ts` covering: 404, 401, 400 (bad body), 500 (handler throw), 504 (slow handler)
- [ ] Typecheck and `npm test` pass

### US-002: Gateway — auth is unbypassable in non-local bind modes
**Description:** As a remote user, I need confidence that no route leaks data when auth is required.

**Acceptance Criteria:**
- [ ] Audit every path in `createGateway` — no route skips `checkAuth` when `requireAuth` is true, except `/api/health` and static assets
- [ ] WebSocket upgrade rejects missing/invalid token with 401 before allocating client state
- [ ] Constant-time token comparison in `verifyAuthToken` (no early-return timing leak)
- [ ] Add test: `GET /api/scan` without token → 401; with wrong token → 401; with valid token → 200
- [ ] Typecheck and tests pass

### US-003: Gateway — WebSocket auto-reconnect + backpressure
**Description:** As a dashboard user, I want my live feed to keep working if the gateway restarts or my laptop sleeps.

**Acceptance Criteria:**
- [ ] Client (`packages/dashboard/src/hooks/useHarness.ts`) reconnects with exponential backoff (1s → 30s cap)
- [ ] Reconnected client re-subscribes to the same event stream and shows a "reconnected" banner for 2s
- [ ] Gateway drops slow WebSocket clients (send buffer > 1 MB) with a close-code and log line
- [ ] Heartbeat: clients missing 2 consecutive pings get evicted (already 30s interval — verify eviction actually happens)
- [ ] Verify in browser using dev-browser skill (kill gateway, see reconnect)

### US-004: Gateway — `npm test` actually runs and passes
**Description:** As a maintainer, I need the test command to exercise real behaviour, not no-op.

**Acceptance Criteria:**
- [ ] `package.json` test script runs all `*.test.ts` under `src/` via `node --test` with tsx/ts-node loader
- [ ] Starter tests cover: config load/save, risk `checkTrade`, gateway `/api/health` returns 200, mode-lock enforcement
- [ ] CI hook (GitHub Actions workflow in `.github/workflows/ci.yml`) runs `npm run build && npm test` on push
- [ ] All tests green

### US-005: Mobile — login/pair screen (first-run flow)
**Description:** As a new mobile user, I want to connect my phone to my running gateway in under 30 seconds.

**Acceptance Criteria:**
- [ ] First launch shows a pair screen: host URL field (default `http://<lan-ip>:3210`) + token field + "Scan QR" button
- [ ] "Scan QR" uses Expo Camera to read a QR encoding `{host, token}` (desktop generates QR on onboard)
- [ ] "Test connection" button hits `GET /api/health` — shows green check or readable error
- [ ] On success, persists host + token to `expo-secure-store` and navigates to Home tab
- [ ] Verify in iOS simulator and Android emulator — every button reachable

### US-006: Mobile — Home tab shows real harness state
**Description:** As a user, I want the Home tab to show my portfolio, P&L, and recent activity like the desktop cockpit.

**Acceptance Criteria:**
- [ ] `(tabs)/index.tsx` fetches `/api/` + `/api/risk` on mount and on pull-to-refresh
- [ ] Shows mode badge (paper/live), equity, day P&L (red/green), open-positions count
- [ ] Subscribes to `/ws` — updates stream in live without full re-fetch
- [ ] Tapping a position row opens a detail sheet with Close + Cancel buttons (Close hits `/api/command` with a "close X" instruction)
- [ ] No dead buttons — every tap produces a visible response
- [ ] Verify in simulator

### US-007: Mobile — Markets tab (scan + search + quote)
**Description:** As a user, I want to browse markets across all connectors on my phone.

**Acceptance Criteria:**
- [ ] `(tabs)/markets.tsx` shows connector filter chips (all 12) + search field + scrollable result list
- [ ] Calls `/api/scan?exchange=` and `/api/search?q=` with debounce
- [ ] Row tap opens quote sheet pulling `/api/quote` and `/api/orderbook`
- [ ] Loading, empty, and error states each have a visible UI (no blank screens)
- [ ] Verify in simulator

### US-008: Mobile — Portfolio tab with panic button
**Description:** As a user, I want to see all open positions on one screen and flatten everything in one tap if things go wrong.

**Acceptance Criteria:**
- [ ] `(tabs)/portfolio.tsx` lists positions from `/api/risk` (symbol, size, entry, current, P&L, % )
- [ ] Fixed "PANIC" button at bottom — opens confirmation sheet ("Type PANIC to confirm") before `POST /api/panic`
- [ ] Shows success toast with count of positions flattened
- [ ] Disables button for 10s after firing to prevent double-tap
- [ ] Verify in simulator

### US-009: Mobile — Command tab (AI chat)
**Description:** As a user, I want to issue AI commands to my trading harness from my phone.

**Acceptance Criteria:**
- [ ] `(tabs)/command.tsx` shows chat history (role bubbles) + input field + send button
- [ ] Send posts to `/api/command`, renders response with streaming-style typing effect
- [ ] Quick-start chips: "scan markets", "risk status", "close all longs"
- [ ] History persists to `expo-secure-store` (last 50 messages)
- [ ] Long-press on a message copies it to clipboard
- [ ] Verify in simulator

### US-010: Mobile — Settings tab (host, token, logout, about)
**Description:** As a user, I want to change my gateway host, rotate token, or disconnect.

**Acceptance Criteria:**
- [ ] `(tabs)/settings.tsx` shows current host (masked token), app version, gateway version
- [ ] "Change host" re-opens pair flow
- [ ] "Rotate token" prompts for new token + re-tests connection
- [ ] "Disconnect" clears secure store and returns to pair screen
- [ ] "About" shows version, git SHA, GitHub link (opens in browser)
- [ ] Verify in simulator

### US-011: Desktop — Electron security hardening
**Description:** As a user installing the desktop app, I want it to follow modern Electron security defaults.

**Acceptance Criteria:**
- [ ] `BrowserWindow` uses `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- [ ] Only `preload.ts` exposes a narrow `window.opentradex` surface (no raw `ipcRenderer`)
- [ ] CSP header set on loaded HTML: `default-src 'self'; connect-src 'self' http://localhost:3210 ws://localhost:3210`
- [ ] Web security enabled; no `allowRunningInsecureContent`
- [ ] External links open in system browser via `shell.openExternal` with allowlist
- [ ] Typecheck passes

### US-012: Desktop — OS keychain for API keys
**Description:** As a user, I want my API keys encrypted at rest using my OS keychain, not plain JSON.

**Acceptance Criteria:**
- [ ] Integrate `keytar` (or Electron `safeStorage`) — store `anthropic`, `openai`, `google`, `kalshi`, `polymarket`, `alpaca` credentials there
- [ ] Migration: on first run of v1.0, if `~/.opentradex/config.json` has plain keys, move them to keychain and null out the file fields
- [ ] `loadConfig()` hydrates secrets from keychain at runtime; never logs them
- [ ] Unit test: mock keychain, verify round-trip write/read
- [ ] Typecheck and tests pass

### US-013: Desktop — Code-signed installers (Win + Mac)
**Description:** As a user, I want to install the app without SmartScreen / Gatekeeper warnings.

**Acceptance Criteria:**
- [ ] `electron-builder` config has signing settings for Windows (Authenticode) and macOS (Developer ID + notarization)
- [ ] GitHub Actions release workflow signs and notarizes on tag push
- [ ] Documented env vars: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- [ ] README install section notes the signed installer
- [ ] Local unsigned builds still work for dev (skip signing when creds absent)

### US-014: Desktop — one-click AI provider setup (detect local CLIs)
**Description:** As a user, I want the desktop app to auto-detect AI tools I've already installed.

**Acceptance Criteria:**
- [ ] Settings → AI panel probes for: `claude` (Claude Code), `opencode`, `gemini`, `ollama` binaries on PATH
- [ ] Shows detected list with "Use this" buttons — clicking wires the provider in config (no API key needed for CLI providers)
- [ ] If none detected, shows provider dropdown (Anthropic / OpenAI / Google / OpenRouter / Groq / DeepSeek / Kimi) + API key field + "Test" button
- [ ] "Test" hits `/api/ai/chat` with `"say hi"`, shows success/error inline
- [ ] Verify in Electron dev

### US-015: CLI onboarding — under 5 prompts for paper default
**Description:** As a new user running `opentradex onboard`, I want to finish in under 90 seconds with sensible defaults.

**Acceptance Criteria:**
- [ ] `--paper-only` flag skips all prompts except AI provider (1 prompt) → writes config + starts gateway
- [ ] Default interactive flow: (1) paper mode Y/n (2) AI provider or skip (3) starting capital [$10k] (4) bind mode [local] (5) done
- [ ] Each prompt has a visible default and accepts Enter to take it
- [ ] End of flow prints: gateway URL, token (if remote), pair QR (if remote), next-step command
- [ ] Works non-TTY (CI/scripted): reads env vars `OPENTRADEX_MODE`, `OPENTRADEX_AI_PROVIDER`, `OPENTRADEX_AI_KEY`

### US-016: CLI onboarding — pair QR for mobile
**Description:** As a user, I want to scan a QR with my phone at the end of onboarding.

**Acceptance Criteria:**
- [ ] When `bindMode` is `lan` or `tunnel`, onboard prints an ASCII QR encoding `{host, token}` to terminal
- [ ] Also saves SVG QR to `~/.opentradex/pair.svg` for screenshotting
- [ ] Mobile app's "Scan QR" decodes this format
- [ ] Typecheck passes

### US-017: Dashboard — connection status + reconnect UX
**Description:** As a dashboard user, I want to always know if I'm connected to the gateway.

**Acceptance Criteria:**
- [ ] TopBar shows a dot: green (WS connected), yellow (reconnecting), red (disconnected)
- [ ] Tooltip shows latency (ms from last heartbeat) and reconnect attempt count
- [ ] On disconnect, a toast appears with "Retry" button
- [ ] Verify in browser using dev-browser skill (kill gateway, confirm UI states)

### US-018: Dashboard — empty states for new users
**Description:** As a first-time user, when I open the dashboard with no positions or trades, I want guidance not a blank screen.

**Acceptance Criteria:**
- [ ] LeftSidebar "Positions" empty state shows "No open positions — try `scan markets` in the chat"
- [ ] LeftSidebar "Market Scanner" empty state shows "Scanner idle — hit the ⚡ Cross-Market Scan mission"
- [ ] RightSidebar "Live Feed" empty state shows "Waiting for news — this uses your configured feeds"
- [ ] Verify in browser using dev-browser skill

### US-019: Docs — onboarding quickstart video script + screenshots
**Description:** As a new user, I want a 60-second quickstart walkthrough.

**Acceptance Criteria:**
- [ ] `docs/quickstart.md` with step-by-step: install → onboard → scan → first paper trade
- [ ] Screenshots for each step (regenerate from dashboard)
- [ ] Links from README top-of-page and from landing page

### US-020: Release — tag v1.0 and publish
**Description:** As a user, I want a single stable version to install.

**Acceptance Criteria:**
- [ ] Bump `package.json` to `1.0.0` across root, dashboard, desktop, mobile
- [ ] Tag `v1.0.0`, GitHub Actions builds signed installers + publishes release with notes
- [ ] `npm publish` the harness package (public access)
- [ ] Landing page `landing/` download buttons point to v1.0.0 installers
- [ ] README install instructions verified

## Functional Requirements

- FR-1: Every gateway route must return JSON-shaped errors (`{ error, code }`) with correct HTTP status, never HTML or plain text except for the `/` landing fallback.
- FR-2: Gateway must never crash from a handler exception — all thrown errors are caught at the route dispatcher level.
- FR-3: Gateway must reject WebSocket upgrade with 401 before client allocation when auth is required and token is missing/invalid.
- FR-4: Dashboard and mobile clients must reconnect WebSocket with exponential backoff (start 1s, max 30s, reset on success).
- FR-5: The mobile app must render loading, empty, error, and success states for every async screen — no blank UI is acceptable.
- FR-6: Every interactive control in the mobile app must trigger a network call or navigation — no placeholder `onPress={() => {}}` handlers.
- FR-7: The mobile "PANIC" button must require typed confirmation before firing.
- FR-8: Desktop Electron windows must run with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- FR-9: All API keys must be stored in the OS keychain (Windows Credential Manager / macOS Keychain / libsecret on Linux), never plain JSON.
- FR-10: CLI `onboard --paper-only` must complete in ≤ 1 prompt (AI provider) and write a runnable config.
- FR-11: CLI `onboard` default interactive flow must complete in ≤ 5 prompts for the paper-mode path.
- FR-12: CLI onboard must emit a pair QR (ASCII + SVG) when bind mode is non-local.
- FR-13: Desktop AI setup must detect `claude`, `opencode`, `gemini`, `ollama` binaries on PATH and offer one-click selection.
- FR-14: `npm test` must execute real tests and return non-zero on failure.
- FR-15: v1.0 installers must be code-signed on Windows and notarized on macOS; CI must fail release if signing step fails with non-empty creds.

## Non-Goals (Out of Scope)

- **Live trading polish beyond the existing 24h mode lock.** Live trading stays feature-complete at current scope; UX refinement for live mode is a post-v1.0 concern.
- **New market connectors.** The existing 7 connectors (polymarket, kalshi, alpaca, crypto, tradingview, base) are the v1.0 set. The other 5 referenced in the README (Binance, Coinbase, OANDA, MT5, Dukascopy, Robinhood, DraftKings, IBKR) remain marked "planned".
- **Backtesting engine.** Paper simulation via the existing risk engine is the scope; no historical replay.
- **Strategy marketplace / shared configs.** Each user's config stays local.
- **Multi-user / team features.** Single-user, single-machine — no auth beyond the bearer token for remote access.
- **Mobile push notifications.** Out of scope — WebSocket streaming while app is open is enough for v1.0.
- **Cloud-hosted gateway service.** OpenTradex stays local-first; no hosted offering.
- **Android Play Store / iOS App Store submission.** Expo dev builds + TestFlight/internal distribution only.

## Design Considerations

- Reuse the existing dashboard design tokens (defined in README "Design tokens" section) across mobile and desktop shells — `--bg #0B0F14`, `--accent #3FB68B`, etc.
- Mobile should mirror the dashboard's 3-pane feel as tabs (Home = center cockpit, Portfolio = left rail, Markets = markets page, Command = chat, Settings = config).
- Reuse `ConnectorLogo.tsx` SVG marks on mobile by porting to `react-native-svg`.
- Loading states: use a single `<Skeleton />` primitive on each surface rather than spinners where possible.
- Error toasts: 4s auto-dismiss, red background, clickable to copy error text.
- Desktop settings panel should group: Trading Mode · AI Providers · Exchanges · Risk Limits · Advanced (bind mode, token rotation).

## Technical Considerations

- **Gateway tests:** Use `node --test` with `tsx` loader (already on Node 18+). Spin up the server on port `0`, hit via `undici` `fetch`.
- **Reconnect hook:** Keep WebSocket logic in `packages/dashboard/src/hooks/useHarness.ts` (hot path, 18x touches) — don't fork the reconnect into per-component code.
- **Mobile secure storage:** `expo-secure-store` is already the right choice; wrap it in `packages/mobile/src/services/api.ts` (existing file).
- **Electron preload:** Keep the surface narrow: `{ getVersion, openExternal, detectCLIs, keychain: { set, get, delete } }`.
- **Keychain on Linux:** `keytar` requires `libsecret-1-dev` — document in install instructions.
- **Code signing secrets:** Store in GitHub Actions repository secrets (`publish` remote); do not commit to this repo.
- **QR encoding:** Use `qrcode-terminal` for ASCII, `qrcode` for SVG (both npm, small deps).
- **CI:** Run `npm run build && npm test` + `cd packages/dashboard && npm run build` + `cd packages/mobile && npx expo-doctor` on push.
- **Branch sync reminder:** Vercel watches `main`, local pushes go to `master` — merge `master → main` to ship landing-page changes for v1.0 download buttons.
- **Publish remote:** Push to `publish` (deonmenezes/opentradex), not `origin` (opentradex-harness) when cutting the v1.0 tag.

## Success Metrics

- **Time-to-first-paper-trade ≤ 90 seconds** from `npx opentradex onboard --paper-only` to a successful paper trade executed via chat command.
- **Zero dead mobile buttons:** 100% of controls in the 5 mobile tabs produce a visible response (success, error, or navigation) — verified by manual walkthrough on both iOS simulator and Android emulator.
- **Gateway test coverage ≥ 80%** of route handlers by line count, measured with `c8`.
- **No unhandled rejections** during a 1-hour soak test: gateway + dashboard + one mobile client + autoscan enabled.
- **Signed installer verified:** Windows installer shows publisher "OpenTradex" in UAC prompt; macOS installer passes `spctl --assess` after notarization.
- **Onboarding drop-off ≤ 10%:** in a 5-person test cohort, at least 90% reach a running gateway without asking for help.

## Open Questions

- Should mobile app support a **read-only paired mode** (view only, no trade execution from phone) as a user-selectable option, in addition to full trading? (Current design: full trading — every button works.)
- For desktop code signing: do we already have an **Authenticode certificate** procured, or do we need to buy one (EV vs OV)?
- **Apple notarization:** is a Developer ID account in place under the GitHub org, or do we use `@deonmenezes`'s personal account?
- Should the **v1.0 npm package** be published under `opentradex` (check namespace availability) or scoped `@deonmenezes/opentradex`?
- For keychain migration: after moving secrets out of `~/.opentradex/config.json`, do we want to keep the file at all, or fully migrate config to keychain + a small plaintext index?
- Should the mobile QR pair format include an **expiry timestamp** so printed/screenshotted QRs auto-expire?
