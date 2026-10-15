# 03 — Desktop Real-Time Scanning Screen & QR Pairing Flow (GitHub Issue #12)

**What to build:** A dedicated desktop receiver view (`/scan/dashboard`) in the web app that initiates a scanner session, displays a sharp pairing QR code, connects to the WebSocket session room, and renders the live scanning workspace: a central hero card spotlighting the latest recognized card and a scrolling right sidebar showing the chronological session feed with inline Normal/Foil finish toggles.

**Blocked by:** #11 (02 — WebSocket Session Gateway Microservice)

**Status:** ready-for-agent

- [ ] Desktop `/scan/dashboard` generates an ephemeral pairing token and renders a pairing QR code containing session ID and WS endpoint.
- [ ] Connects to the WebSocket gateway and updates status pill from "Waiting for phone..." to "Companion Connected" upon phone handshake.
- [ ] Central hero view displays high-resolution official artwork, card title, element/type, and set code of the most recently committed card.
- [ ] Right sidebar maintains a scrolling chronological feed of scanned cards in this session with quick finish toggles (Normal/Foil).
- [ ] Includes "Disconnect / Pair New" button that cleanly resets the session.
