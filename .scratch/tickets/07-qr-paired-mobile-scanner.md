## Parent
#1

## What to build
Build a card scanner with a zero-friction mobile pairing flow. On desktop, the collector clicks "Scan with Phone" to open a modal generating a short-lived signed QR code. Scanning the QR code with a smartphone camera opens a dedicated web viewfinder page (`/scanner/session/[token]`) with camera access, requiring no login on the phone. The mobile browser samples frames, performs client-side OCR on collector codes and card names, and matches them against the local Card Catalog. Recognized cards are streamed back to the active desktop session in real time, allowing the collector to review, confirm foil/quantity, and add them to their inventory.

## Acceptance criteria
- [ ] Pairing session schema (`scanner_sessions`) generates short-lived, cryptographically signed tokens.
- [ ] Desktop UI renders a "Scan with Phone" modal with dynamic QR code and pairing status indicator.
- [ ] Mobile web route (`/scanner/session/[token]`) validates the token and initializes the device camera with HTML5 video/canvas.
- [ ] In-browser frame sampler processes frames and extracts text crops (collector prefix/number, card title).
- [ ] OCR recognition engine matches extracted text against pre-seeded Card Catalog entries.
- [ ] Live communication bridge (SSE / WebSocket / polling) streams detected cards from mobile to desktop instantly.
- [ ] Desktop session displays real-time detection cards with one-click collection confirmation.
- [ ] Automated tests verify pairing token lifecycle, expiration, and catalog code fuzzy matching.

## Blocked by
- #3 (Collector Inventory Tracking & Smart Views)
