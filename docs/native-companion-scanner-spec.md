# Native Mobile Companion Scanner Specification

## Problem Statement

Collectors managing physical Grand Archive TCG collections encounter severe friction when inventorying binders and booster boxes. The existing mobile web-based scanner suffers from mobile browser limitations: thermal throttling, high canvas frame readback latency, lack of native hardware camera control (continuous autofocus and torch toggle), and slow single-threaded JavaScript OCR. Furthermore, collectors want to keep their eyes on their cards in physical rapid-fire succession while their desktop collection dashboard updates in real time without manual sync buttons or page refreshes.

## Solution

A high-performance native companion mobile application (iOS/Android) paired to the desktop collector site via a QR code handshake. The phone camera operates in continuous Rapid-Fire Mode using native frame processors to detect card boundaries, reject blur and glare, perspective-warp cards to standard dimensions, and run on-device native OCR. The extracted visual perceptual hash and alphanumeric text are streamed over an ephemeral, room-isolated WebSocket gateway to a matching engine against the Turso catalog database. High-certainty matches are automatically confirmed after a 1.2-second grace period (or 1-tap manual confirmation) with haptic feedback, while the desktop dashboard displays a hero view of the latest scanned card alongside a real-time chronological collection feed.

## User Stories

1. As a Collector, I want to scan a QR code displayed on my desktop screen using my phone camera, so that my mobile companion app instantly pairs with my active desktop session without typing credentials.
2. As a Collector, I want my mobile companion app to maintain a persistent, low-latency WebSocket connection to my desktop session, so that card recognitions stream to my screen in under 350ms.
3. As a Collector, I want the camera viewfinder to feature a centered card aspect-ratio target guide (2.5 : 3.5), so that I know exactly where to position physical cards.
4. As a Collector, I want dynamic corner anchors on the mobile screen that visually snap to the card edges when detected, so that I have instant visual confirmation that the card boundary is locked.
5. As a Collector, I want the native camera pipeline to automatically reject blurry frames using sharpness analysis, so that unreadable images do not trigger bad database lookups.
6. As a Collector, I want the camera pipeline to detect and reject specular glare clusters from penny sleeves and foils, so that card art and collector text are not washed out.
7. As a Collector, I want the camera to require positional stability across consecutive frames before triggering recognition, so that motion blur during card placement is ignored.
8. As a Collector, I want on-device perspective warping to map skewed card captures into a clean, top-down rectangular buffer, so that OCR and perceptual hashing are normalized.
9. As a Collector, I want on-device native OCR to extract the card title from the top header strip, so that character recognition is executed natively in under 50ms.
10. As a Collector, I want on-device native OCR to extract the collector number and set code from the bottom footer strip using regex patterns, so that exact edition identity can be resolved.
11. As a Collector, I want the mobile scanner to compute a 64-bit perceptual hash (dHash/pHash) on the card art, so that visual matching against the card catalog is fast and robust.
12. As a Collector, I want the system to combine visual hash similarity and OCR similarity into a composite confidence score, with an extra certainty boost for matching collector numbers.
13. As a Collector, I want rapid-fire automatic confirmation when confidence is 90% or higher, so that I can rapidly scan an entire binder without tapping the screen.
14. As a Collector, I want a crisp haptic feedback pulse when a card locks with high confidence, so that I can flip to the next physical card without looking at the phone screen.
15. As a Collector, I want a non-intrusive 1.2-second bottom countdown pill showing the detected card name, set code, and finish, so that I have a brief window to cancel or toggle finishes.
16. As a Collector, I want a one-tap finish toggle between Normal and Foil during the 1.2-second countdown, so that I can accurately capture foil cards.
17. As a Collector, I want smart default finishing based on catalog population metadata (defaulting to Foil only if the printing is exclusive to foil), so that I minimize manual taps.
18. As a Collector, I want a fallback bottom sheet displaying the top alternative candidate cards when confidence is below 90%, so that I can manually select the correct card.
19. As a Collector, I want the mobile camera to remain continuously active in the background during card confirmations, so that there is zero lag between consecutive scans.
20. As a Collector, I want a floating flashlight/torch toggle on the mobile camera screen, so that I can illuminate dark rooms or tilt cards away from glare.
21. As a Collector, I want automatic exponential backoff reconnection if my mobile Wi-Fi or cellular network drops, so that my scanning session resumes seamlessly.
22. As a Collector, I want a dedicated "Scanning" screen on my desktop web browser showing high-resolution official artwork of the latest scanned card in the center, so that I can clearly see each recognized card.
23. As a Collector, I want a real-time chronological list on the right side of the desktop screen displaying cards added during the active session, so that I can track my scanning progress.
24. As a Collector, I want to edit card finishes (Normal/Foil) directly from the desktop session feed, so that I can correct any mistakes while sitting at my computer.
25. As a Collector, I want to tap "Disconnect / Pair New" on either device at any time, so that the session cleanly terminates and returns to the initial state.

## Implementation Decisions

### Architectural Topology & Monorepo Structure
- The repository is organized as a pnpm monorepo consisting of:
  - `apps/web`: The Next.js web application (Desktop Collection Dashboard & Web Receiver).
  - `apps/mobile`: The React Native / Expo companion application using native Vision Camera.
  - `packages/contracts`: Shared TypeScript types, WebSocket message schemas, error codes, and validation helpers.
  - `packages/scanner-core`: Shared perceptual hashing algorithms, trigram string similarity, and composite scoring formulas.

### Real-Time Transport: WebSocket Session Gateway
- An ephemeral room-isolated WebSocket broker handles message dispatching between the Companion Scanner and the Web Receiver.
- Target runtimes:
  - Edge target: Cloudflare Worker using the WebSocket Hibernation API for zero-cost, persistent room management keyed by `session_<uuid>`.
  - Local dev target: A lightweight Node.js/TypeScript server running `ws` on `localhost:3001` for offline development.
- Payloads are strictly validated JSON envelopes adhering to the schema:
  - `SESSION_JOIN`: Sent by both desktop and mobile to bind to a session room.
  - `SESSION_STATUS`: Sent by server to notify peers of connection status.
  - `SCAN_IDENTIFY_REQUEST`: Sent by mobile containing 64-bit phash and OCR header/footer strings.
  - `SCAN_IDENTIFY_RESPONSE`: Sent by server containing ranked candidate printings and composite confidence scores.
  - `CARD_COMMITTED`: Broadcast to the session room when a card is confirmed, containing card slug, edition ID, finish, and timestamp.
  - `HEARTBEAT_PING / HEARTBEAT_PONG`: Sent every 15 seconds to keep edge WebSocket connections alive.

### Native Camera & Vision Pipeline (Dual-Runtime Architecture - ADR 0006)
The companion camera pipeline operates across two complementary runtime environments:
- **Runtime Mode A (Expo Go Edge Streamer - Active Default)**:
  - Utilizes `expo-camera` (`CameraView`) within standard Expo Go to enable immediate physical testing on user hardware without compiling custom native binaries.
  - Viewfinder locks to rear sensor with continuous autofocus, torch toggle, and canonical 2.5 : 3.5 aspect ratio target guide.
  - Rapid-fire card frames captured within the guide viewport are streamed over the local WebSocket connection (`SCAN_FRAME_PROCESS_REQUEST`).
  - Edge/Gateway processes frames via `sharp` (Laplacian sharpness check, glare thresholding, perspective warp to 630x880, 64-bit dHash computation) and strip OCR (`tesseract.js` + regex), returning `SCAN_IDENTIFY_RESPONSE` in ~160–210ms.
- **Runtime Mode B (Standalone Native Worklet - Prebuild Path)**:
  - Built with React Native using `react-native-vision-camera` v4 and native worklets (`react-native-worklets-core`) for standalone compiled builds (`npx expo prebuild` / Gradle APK).
  - Native OCR: Apple Vision (iOS) and Google ML Kit (Android) execute natively on the warped buffer at 30 fps:
    - Header strip (top 15%): Extracted string normalized for Card Name.
    - Footer strip (bottom 15%): Extracted string parsed via regex for Collector Number (`\b\d{1,4}/\d{1,4}\b`) and Set Prefix (`\b[A-Z0-9]{2,6}\b`).

### Catalog Matching Engine & Persistence
- Server-side candidate retrieval executes against the Turso libSQL database:
  - Hamming distance calculated against pre-indexed 64-bit visual hashes in `card_hashes`.
  - Candidate pool bounded to top 20 visual matches, filtered/re-ranked using trigram string similarity on card names and exact collector number equality.
  - Confidence formula: `Confidence = (0.60 * Visual_Score) + (0.40 * OCR_Score)`, with a +15% boost for exact collector number match (capped at 99%).
- Committed cards are persisted to `collection_items` table linked to the authenticated user's ID via `addOrUpdateCollectionItem`.

### Domain Alignment: Grand Archive Finishes
- Grand Archive TCG cards strictly feature `Normal` (non-foil) and `Foil` finishes. Pokemon-specific terms (`Holo`, `Reverse Holo`) are forbidden.
- The UI and WebSocket payloads strictly use `foil: boolean` with display labels `Normal` and `Foil`.

## Testing Decisions

### Seam 1: Shared Protocol & Contract Validation (Highest Seam)
- Validates that message serialization, deserialization, type guards, and schema constraints in `packages/contracts` accept valid envelopes and reject malformed/unauthorized payloads.
- Prior art: `src/lib/scanner/contracts.ts` and schema unit tests.

### Seam 2: WebSocket Gateway Room Isolation & Message Routing
- Validates that two distinct clients joining the same `session_<uuid>` receive forwarded messages, while clients in different rooms are strictly isolated.
- Prior art: In-memory WebSocket mock server tests with multiple simulated sockets.

### Seam 3: Candidate Scoring & Matching Engine
- Validates that simulated visual hashes and OCR snippets (including noisy text and slight misspellings) produce correct candidate rankings, confidence scores, and collector number boosts.
- Prior art: `src/services/scanner-match.test.ts`.

### Seam 4: Desktop Receiver State Management
- Validates that processing incoming `CARD_COMMITTED` events updates the desktop state: displaying the latest card as hero, appending to the chronological session feed, and updating collection totals.
- Prior art: `src/services/collection.test.ts`.

## Out of Scope

- Offline on-device SQLite database synchronization (all candidate matching is performed over the active WebSocket gateway).
- Video frame streaming from phone to desktop (only lightweight metadata and hashes are transmitted).
- Mobile collection management, deck building, or friend-link trading (the companion app is focused strictly on card scanning and pairing).
- Multi-card simultaneous detection within a single camera frame (the pipeline is optimized for rapid single-card sequential scanning).

## Further Notes

- The mobile web scanner (`/scan/[token]`) remains available as a zero-install fallback, while the native companion provides the primary high-throughput rapid-fire experience.
