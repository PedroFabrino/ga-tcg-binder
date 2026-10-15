# GA TCG Companion (mobile)

Expo SDK 57 / React Native companion app for GA TCG Binder. The live card scanner and desktop pairing are the active features; Binder, Decks, Meta and Friends are "Coming Soon" previews.

## Run

```bash
cd apps/mobile
npm install
npm start          # then press a / i, or scan with a development build
npm run typecheck
```

Camera features need a development build or Expo Go on a physical device.

## UI-only placeholders

This build focuses on the interface. The stores in `src/store` only simulate transitions so every screen can be exercised:

- `sessionStore.pair()` moves CONNECTING -> ACTIVE_SCANNING after a short delay; `simulatePairing()` (dev only) jumps straight in. There is no WebSocket yet - plug the transport in here.
- `scannerStore` marks confirmed cards "sending" then "sent" locally. Replace `emit` with the real desktop send.
- `hooks/useSimulatedFeed.ts` (the flask button on the viewfinder) walks mock cards through the quality gate, rapid-fire and candidate flows. Turn it off to see the plain camera; real frame analysis should push `ScanFrameMetrics` via `pushMetrics` and ranked matches via `proposeMatches`.

## Structure

```
src/
  App.tsx                 navigation shell
  screens/ScannerScreen   pairing vs. active scanner
  components/
    pairing/              QR pairing + manual code sheet
    scanner/              viewfinder, guide, HUD, rapid-fire pill, candidate drawer
    suite/                Coming Soon previews (binder grid, decks, meta, friends)
    layout/               bottom tab bar
    shared/               card art, badges, buttons
  store/                  Zustand placeholders
  lib/                    quality gate, pairing parser, feedback, mock cards
  types/                  card + session types
```
