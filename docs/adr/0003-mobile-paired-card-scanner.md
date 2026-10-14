# 0003: Client-Side Frame OCR with QR-Paired Mobile Scanner Session

## Context
Collectors want to scan cards using their phone cameras or uploaded video frames without having to log in on their mobile device or hit Vercel serverless execution timeout limits (10-15s).

## Decision
We implement a two-part scanning architecture:
1. **QR-Based Mobile Pairing**: The desktop application generates a short-lived, signed pairing token rendered as a QR code. Scanning this QR code opens a lightweight mobile scanner page that streams detected card events back to the active desktop session.
2. **Client-Side Frame OCR & Catalog Matching**: Video frames or camera snapshots are sampled in the browser canvas and processed against the pre-seeded Card Catalog (matching set prefix and collector numbers) before dispatching the identified card payload.

## Consequences
- Bypasses Vercel serverless video processing timeouts and large upload payloads.
- Delivers a zero-friction mobile camera scanning experience without requiring mobile credentials.
- Relies on client-side canvas and WebRTC/media APIs, requiring camera permissions in the mobile browser.
