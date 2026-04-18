# Changelog

All notable changes to OpenTradex are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-04-17

First stable release. OpenTradex is out of beta and ships as a production-ready,
paper-first trading cockpit with signed installers, a hardened gateway, and first-class
mobile and desktop clients.

### Added

- **Mobile app (Expo)** — full three-tab cockpit: Portfolio (live positions, fixed PANIC dock with 10s cooldown, halted banner), Command (typing effect, 50-entry history via expo-secure-store, long-press copy-to-clipboard, quick-command chips), Settings (host + masked token, rotate-with-testing flow, disconnect, gateway version, GitHub link).
- **Desktop (Electron) signed installers** — electron-builder configured for Windows Authenticode (NSIS + APPX, RFC 3161 timestamping) and macOS Developer ID (DMG + MAS, hardened runtime, notarization). Entitlements plists included.
- **GitHub Actions release pipeline** — `.github/workflows/release.yml` triggers on `v*.*.*` tag push, matrix-builds Windows + macOS, signs + notarizes using secrets, publishes to GitHub Releases.
- **Dashboard reconnect UX** — 3-state connection chip (Live / Reconnecting / Offline), inline latency, attempt counter, disconnect toast with manual Retry button.
- **Dashboard empty states** — icon + headline + guidance copy for no-positions, no-scanner-results, and no-feed states.
- **Docs/quickstart** — `docs/quickstart.md` walks through install → onboard → gateway → scan → first paper trade in five screenshotted steps, with a troubleshooting table.
- **README + landing page** — 60-second Quickstart links, signed installer messaging, signing env-var reference table.

### Changed

- **All packages bumped to 1.0.0** — root `opentradex`, `@opentradex/dashboard`, `@opentradex/desktop`, `@opentradex/mobile`.
- **Landing download redirect** — `vercel.json` now points at `OpenTradex.Setup.1.0.0.exe` on GitHub Releases.
- **Gateway hardening** — token-gated `POST /mode`, WS backpressure eviction, auth-scoped writes.
- **Risk engine** — panicFlatten updates dailyTrades/dailyWins for accurate caps, startingCapital defaults unified.

### Fixed

- Dashboard TypeScript errors in `useHarness.ts` (feed source typing, missing timestamp on scraped feed items).
- PositionDetailSheet mobile type mismatch on close-confirm.
- Desktop build config: `forceCodeSigning: false` so unsigned local dev builds still succeed when signing creds are absent.

### Trading modes

Paper-only remains the default. Flipping to `paper-default` or `live-allowed` still
requires re-running `opentradex onboard` and honors the 24-hour mode-lock.

### Install

```bash
# CLI
npx opentradex onboard --paper-only && npx opentradex run

# Desktop
# Grab the signed installer from https://github.com/deonmenezes/opentradex/releases/tag/v1.0.0

# Mobile
cd packages/mobile && npm install && npx expo start
```

### Upgrade notes

- Users on 0.1.0 configs: `~/.opentradex/config.json` is forward-compatible — no schema changes.
- Mobile app: the paired host + token carries forward. No re-pair needed.
- Desktop: uninstall the 0.1.0 build before installing 1.0.0 on Windows (SmartScreen will now recognize the signed publisher).

---

## [0.1.0] — Earlier

Internal beta. Not tagged publicly.
