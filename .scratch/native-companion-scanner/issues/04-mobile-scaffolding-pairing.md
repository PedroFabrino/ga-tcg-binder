# 04 — Mobile Companion App Scaffolding & Pairing State Machine (GitHub Issue #13)

**What to build:** Scaffold the React Native companion app in `apps/mobile` with TypeScript and Expo Prebuild. Build the pairing camera screen that scans the desktop QR code, decodes session parameters, initiates the WebSocket handshake, and manages the mobile session state machine (`DISCONNECTED`, `CONNECTING`, `ACTIVE_SCANNING`, `RECONNECTING`) with automatic exponential backoff.

**Blocked by:** #11 (02 — WebSocket Session Gateway Microservice)

**Status:** ready-for-agent

- [ ] React Native / Expo application initialized under `apps/mobile` importing `@ga/contracts`.
- [ ] Initial `PairingScreen` opens rear camera to detect pairing QR code format (`action: "pair_scanner"`).
- [ ] WebSocket client manager connects to the decoded endpoint, joins the session room, and responds to heartbeats.
- [ ] Network interruption state machine tested: automatically transitions to `RECONNECTING` and resumes without losing session context.
