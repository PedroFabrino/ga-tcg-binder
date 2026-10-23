# GrandTable — Initial MVP Technical Architecture Specification

This document provides the concrete engineering blueprint for building the **GrandTable** Minimum Viable Product (MVP). It is designed for a solo developer or small team to deploy a near-zero-cost prototype using a serverless-first, client-heavy web stack.

---

## 1. System Topology & Data Flow

To keep hosting costs at $\$0\text{/month}$ during the prototype phase, **all video streaming is peer-to-peer (WebRTC)** and **all computer vision runs locally in the client browser via Web Workers**.

```text
+-------------------------------------------------------------------------+
|                           STATIC CDN (Vercel)                           |
|  - SPA Frontend Bundle (React/Vue + OpenCV.js WASM)                     |
|  - Pre-computed Card Hash Database (ga-hashes.json, ~500 KB)            |
+------------------------------------+------------------------------------+
                                     | HTTPS (Initial Load)
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+--------------------+     WebSocket (State & Signaling)    +--------------------+
|  Player 1 Desktop  | <==================================> |  Player 2 Desktop  |
|  (Peer: R-p1-pc)   |           Supabase Realtime          |  (Peer: R-p2-pc)   |
+---------+----------+                                      +---------+----------+
          ^                                                           ^
          | WebRTC MediaStream                     WebRTC MediaStream |
          | (1080p/720p Video)                     (1080p/720p Video) |
+---------+----------+                                      +---------+----------+
|  Player 1 Mobile   |                                      |  Player 2 Mobile   |
|  (Peer: R-p1-cam)  | -----> Direct P2P Video Track -----> |  (Peer: R-p2-cam)  |
+--------------------+     (Cross-streams to P2 Desktop)    +--------------------+
```

### External Dependencies
1. **GATCG Index API (`https://api.gatcg.com`):** Queried at build time (for hash generation) and client-side (for fetching high-resolution card scans and rules text).
2. **Supabase Realtime (Free Tier):** Provides ephemeral Broadcast channels for WebRTC signaling (`SDP` offers/answers, `ICE` candidates) and synchronized game state JSON payloads.
3. **STUN/TURN Servers:** Google's public STUN (`stun:stun.l.google.com:19302`) for NAT traversal, plus Cloudflare Calls TURN or Metered.ca Free Tier for restrictive firewalls.

---

## 2. Repository & Directory Structure

A single TypeScript project using **Next.js (App Router)** or **Vite + React** is recommended:

```text
grandtable-mvp/
├── public/
│   ├── data/
│   │   └── ga-hashes.json          # Pre-computed perceptual hashes for all GA cards
│   └── wasm/
│       └── opencv_js.wasm          # Stripped-down OpenCV WebAssembly binary
├── scripts/
│   └── generate-hashes.ts          # Node CLI script to sync with api.gatcg.com
├── src/
│   ├── app/
│   │   ├── page.tsx                # Lobby creation & Decklist import screen
│   │   ├── room/[roomId]/
│   │   │   ├── page.tsx            # Main 1v1 Split-Screen Tabletop UI
│   │   │   ├── cam/page.tsx        # Lightweight Mobile Camera Transmitter UI
│   │   │   └── overlay/page.tsx    # Transparent OBS Broadcast Overlay
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── VideoBoard.tsx      # Video feed + HTML5 Canvas click-to-scan overlay
│   │   │   └── RoiSelector.tsx     # Bounding-box / click reticle component
│   │   ├── hud/
│   │   │   ├── ChampionBar.tsx     # Level (0-3), Damage counter, Element badges
│   │   │   ├── MemoryTracker.tsx   # Face-down Memory count + Random Recollect Roller
│   │   │   └── CardInspector.tsx   # Sidebar showing high-res card + active stack
│   │   └── modals/
│   │       ├── DeckImportModal.tsx # Parses Silvie / Omnidex text decklists
│   │       └── QrCameraModal.tsx   # Generates QR code for mobile camera pairing
│   ├── lib/
│   │   ├── deckParser.ts           # Extracts card slugs/names from raw text
│   │   ├── webrtc.ts               # PeerJS / RTCPeerConnection manager
│   │   └── supabaseChannel.ts      # Ephemeral state sync wrapper
│   ├── workers/
│   │   └── cv.worker.ts            # Off-main-thread OpenCV warp + dHash matcher
│   └── types/
│       └── game.ts                 # Shared TypeScript interfaces
└── package.json
```

---

## 3. Core Data Contracts (`src/types/game.ts`)

```typescript
export type ElementType = 
  | 'NORM' | 'FIRE' | 'WATER' | 'WIND' 
  | 'TERA' | 'LUXEM' | 'UMBRA' | 'NEOS' | 'ARCANE' | 'ASTRA' | 'CRUX' | 'EXIA';

export interface PrecomputedCardHash {
  slug: string;           // e.g., "ignite-the-soul"
  name: string;           // e.g., "Ignite the Soul"
  editionSlug: string;    // e.g., "doa-1st"
  imageUrl: string;       // High-res image URL from api.gatcg.com
  dHash: string;          // 64-bit hexadecimal perceptual hash (16 hex chars)
  dominantRgb: [number, number, number]; // Tie-breaker color average
}

export interface PlayerHudState {
  playerId: 'p1' | 'p2';
  displayName: string;
  championSlug: string;
  championLevel: 0 | 1 | 2 | 3;
  maxLife: number;        // e.g., 15 -> 20 -> 25 -> 28
  damageCounters: number; // Counts UP from 0 toward maxLife
  memoryZoneCount: number;// Number of face-down cards in Memory
  floatingMemory: number; // Temporary floating resource count
  influenceCount: number; // Cards in hand + Memory (optional helper)
  activeElements: ElementType[];
  loadedDeckSlugs: string[]; // Scopes the CV search pool (~40 unique cards per player)
}

export interface RoomSyncPayload {
  roomId: string;
  spotlightCardSlug: string | null;
  recentStackSlugs: string[]; // Last 3 inspected/played cards for spectators
  lastMemoryRoll: {
    playerId: 'p1' | 'p2';
    totalCardsInMemory: number;
    selectedIndexFromLeft: number; // 1-indexed result
    timestamp: number;
  } | null;
  players: {
    p1: PlayerHudState;
    p2: PlayerHudState;
  };
}
```

---

## 4. Subsystem 1: Offline Hash Generation Pipeline (`scripts/generate-hashes.ts`)

Instead of shipping a heavy machine learning model to the browser, run a pre-build script that indexes all official Grand Archive cards into a compact JSON lookup file.

### Pipeline Execution Steps
1. **Fetch Paginated Cards:** Query `https://api.gatcg.com/cards/search?page=1` through all pages.
2. **Download Card Images:** For each card edition (`editions[]`), fetch the official image (`https://api.gatcg.com/cards/images/{slug}.jpg`).
3. **Crop the Artwork Region:**
   * Standard Grand Archive cards have a consistent frame ratio.
   * Normalize image dimensions to $500 \times 700\text{ px}$.
   * Crop the artwork box at coordinates:
     $$x \in [45, 455], \quad y \in [65, 360]$$
     *(This strips out the card border, cost icons, and rules text box).*
4. **Compute 64-bit Difference Hash (`dHash`):**
   * Resize the cropped artwork to $9 \times 8\text{ px}$ in grayscale.
   * For each row $r \in [0, 7]$ and column $c \in [0, 7]$, compare adjacent pixel intensities $I(r, c)$ and $I(r, c+1)$:
     $$\text{bit}_{r,c} = \begin{cases} 1 & \text{if } I(r, c) > I(r, c+1) \\ 0 & \text{otherwise} \end{cases}$$
   * Pack the resulting $64\text{ bits}$ into a 16-character hexadecimal string (e.g., `"a4f19c003b8e1172"`).
5. **Export Static Index:** Write the array of `PrecomputedCardHash` objects to `public/data/ga-hashes.json`. Even with $3,000+$ printings, the resulting file is under $450\text{ KB}$ (and compresses to $\sim 90\text{ KB}$ via Brotli).

---

## 5. Subsystem 2: Client-Side Computer Vision Worker (`src/workers/cv.worker.ts`)

When a player clicks on a card on the video feed, the main UI thread grabs a snapshot around the cursor and sends it to a Web Worker so the video framerate never drops.

### Step-by-Step Recognition Flow
1. **ROI Snapshot:**
   * User clicks at normalized video coordinates $(u, v)$.
   * The `<canvas>` extracts a $400 \times 400\text{ px}$ `ImageData` buffer centered at $(u, v)$ from the underlying `<video>` element.
2. **Contour Detection & Perspective Flatten:**
   * Convert `ImageData` to grayscale (`cv.cvtColor`) and apply Gaussian blur (`$5 \times 5$` kernel) to reduce sleeve glare.
   * Run Canny edge detection (`cv.Canny(gray, 50, 150)`) followed by dilation to close gaps in the card border.
   * Find contours (`cv.findContours`) and filter for polygons where `cv.approxPolyDP` yields $4$ vertices and area $> 15\%$ of the ROI.
   * **If a 4-point contour is found:** Order vertices (top-left, top-right, bottom-right, bottom-left) and execute `cv.warpPerspective` to map the card into a flat $250 \times 350\text{ px}$ image. Also generate a $180^\circ$ rotated copy (since opponent cards are often upside-down on camera).
   * **Fallback (if contour fails due to overlapping cards):** Take a direct $200 \times 280\text{ px}$ center-crop around the click point.
3. **Scoped Hamming Distance Matching:**
   * Crop the artwork sub-region of the flattened card (both $0^\circ$ and $180^\circ$ orientations) and compute their 64-bit `dHash` values ($h_{\text{upright}}$ and $h_{\text{inverted}}$).
   * Filter `ga-hashes.json` down to **only the slugs present in `p1.loadedDeckSlugs` and `p2.loadedDeckSlugs`** ($\sim 75$ cards total).
   * Compute the Hamming Distance $D_H$ between the candidate hashes and each pre-loaded deck card hash $h_{\text{db}}$:
     $$D_H(h_1, h_2) = \sum_{i=0}^{63} \left( \text{bit}_i(h_1) \oplus \text{bit}_i(h_2) \right)$$
   * Select the card with $\min(D_H)$. If $\min(D_H) \le 18$, broadcast the matched `slug` to the room as `spotlightCardSlug`. If $\min(D_H) > 18$, show the top $3$ closest cards from the match pool in a quick-pick popover.

---

## 6. Subsystem 3: WebRTC Multi-Peer Topology (Desktop + Phone Bridge)

Each player has up to two PeerJS connections: a **Desktop Controller** (audio + UI) and an optional **Mobile Camera** (video-only).

### Peer ID Naming Convention
For a room with ID `roomId`:
* **Player 1 Desktop:** `gt-${roomId}-p1-pc`
* **Player 1 Phone Cam:** `gt-${roomId}-p1-cam`
* **Player 2 Desktop:** `gt-${roomId}-p2-pc`
* **Player 2 Phone Cam:** `gt-${roomId}-p2-cam`

### Mobile Camera Pairing Sequence (`/room/[roomId]/cam?seat=p1`)
1. **QR Code Generation:** Player 1 clicks *"Connect Phone Camera"* on their desktop. A modal renders a QR code encoding:
   `https://grandtable.app/room/abc123/cam?seat=p1`
2. **Camera Acquisition:** The mobile browser opens the link and requests the rear camera at $720\text{p}$ (ideal balance of sharpness and bandwidth):
   ```typescript
   const stream = await navigator.mediaDevices.getUserMedia({
     audio: false,
     video: {
       facingMode: { ideal: 'environment' },
       width: { ideal: 1280 },
       height: { ideal: 720 },
       frameRate: { ideal: 30 }
     }
   });
   ```
3. **Screen Wake Lock:** Prevent the phone from sleeping mid-match:
   ```typescript
   if ('wakeLock' in navigator) {
     await navigator.wakeLock.request('screen');
   }
   ```
4. **Dual Outbound Call:** The phone peer (`gt-abc123-p1-cam`) initiates two outbound unidirectional WebRTC media calls:
   * Call 1 $\rightarrow$ `gt-abc123-p1-pc` (renders in Player 1's local self-view).
   * Call 2 $\rightarrow$ `gt-abc123-p2-pc` (renders in Player 2's opponent board view).

---

## 7. Subsystem 4: Grand Archive Specific Mechanics

### 1. Decklist Parser (`src/lib/deckParser.ts`)
Before joining a seat, players paste a standard text export from **Silvie.org** or **Omnidex**:
```text
# Material Deck
1x Spirit of Fire
1x Lorraine, Wandering Warrior
...
# Main Deck
4x Cremation Ritual
4x Strike Buckler
```
* A regex parser strips quantities (`/^(\d+x?\s+)?(.+)$/i`), normalizes card names to lowercase slugs (`"Cremation Ritual"` $\rightarrow$ `"cremation-ritual"`), and populates `loadedDeckSlugs`.
* It automatically detects the Level 0 Spirit/Champion from the Material Deck to initialize `championSlug` and default `maxLife`.

### 2. Verifiable Random Memory Roller
During the **Recollection Phase**, players often need to banish cards from their face-down Memory zone at random to pay for Materialization costs.
* When Player 1 clicks **"Roll Random Memory"**:
  1. The client reads `p1.memoryZoneCount` (e.g., $N = 5$).
  2. Generates a random integer $k \in \{1, 2, \dots, N\}$ using `crypto.getRandomValues()`.
  3. Broadcasts a `lastMemoryRoll` event over the Supabase Realtime channel.
  4. Both players' screens display an animated toast notification:
     > **Memory Randomizer (P1):** Select **Card #$k$ from the left** (out of $N$).

---

## 8. Implementation Milestones (Weekend Sprint Plan)

### Milestone 1: Core Room & State Sync (Day 1 Morning)
* Scaffold Next.js + Tailwind CSS app.
* Set up Supabase Realtime broadcast channel per `roomId`.
* Build the `ChampionBar` and `MemoryTracker` HUD components and verify that clicking `+1 Damage` or `Roll Memory` updates both browser tabs in real time.

### Milestone 2: WebRTC Video & Mobile Bridge (Day 1 Afternoon)
* Integrate `peerjs` in `src/lib/webrtc.ts`.
* Build the split-screen video grid and the `/cam` mobile transmitter route with `qrcode.react`.
* Test scanning the QR code on a smartphone and streaming the phone camera to two desktop browser windows.

### Milestone 3: Decklist Parser & Manual Inspector (Day 2 Morning)
* Build `scripts/generate-hashes.ts` to pull card metadata and hashes from `api.gatcg.com`.
* Create `DeckImportModal.tsx` to parse pasted decklists and populate a fast local autocomplete search bar in `CardInspector.tsx`.

### Milestone 4: Click-to-Scan CV Worker (Day 2 Afternoon)
* Add the HTML5 `<canvas>` overlay atop the `<video>` elements.
* Wire up `cv.worker.ts` to take the clicked $400 \times 400\text{ px}$ crop, run the `dHash` comparison against `loadedDeckSlugs`, and auto-pin the winning card to `CardInspector.tsx`.