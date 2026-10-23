# GrandTable: A SpellTable Equivalent for Grand Archive TCG
## System Concept & Lightweight MVP Architecture

This document outlines the theoretical requirements and a practical, low-cost Minimum Viable Product (MVP) architecture for building a dedicated remote webcam play platform tailored to **Grand Archive TCG**.

---

## Part 1: Core Theoretical Pillars (The "What" and "Why")

While Magic: The Gathering's SpellTable is essentially a 4-way webcam splitter with an optical scanner bolted on, Grand Archive has specific mechanical nuances (the Memory zone, Material deck, Champion leveling, and damage counting up) that a dedicated platform must solve.

### 1. Computer Vision & Card Recognition Engine
* **The "What":** A visual recognition pipeline that detects a rectangular card on a playmat, flattens its perspective, and matches its artwork against a database of known cards in milliseconds.
* **The "Why":** Webcams are blurry, room lighting is inconsistent, and matte sleeves create heavy glare. Optical Character Recognition (OCR) fails on video feeds. Instead, the system must rely on **perceptual hashing (pHash/dHash)** or **feature/vector matching** of the artwork box.
* **GA-Specific Hurdle:** Grand Archive features full-art Collector Rares (CRs), Curio cards, and heavy foil treatments (CSRs). The database must map multiple visual variants back to the same canonical mechanical card entry.

### 2. Official Index API Integration
* **The "What":** A backend/client sync with Weebs of the Shore’s official **Grand Archive Index API** (`api.gatcg.com`).
* **The "Why":** Avoid manually maintaining card databases. The official Index API is free, public, and serves high-resolution card images, exact rules text, cost stats, and errata.
* **The "Pre-Fetch" Optimization:** If players import their decklists before the match (via Silvie, Shout, or Omnidex), the recognition engine narrows its search pool from thousands of cards down to just the ~75 unique cards in the two players' Main and Material decks. Even a 480p webcam can distinguish between 75 known images with near-100% accuracy.

### 3. Low-Latency Video & Mobile-as-Camera Bridging
* **The "What":** A WebRTC video infrastructure paired with a seamless "Use Phone as Camera" QR code handoff.
* **The "Why":** Most players do not own boom-arm USB webcams. Allowing players to scan a QR code on their PC monitor, mount their smartphone overhead, and automatically link the phone's camera to their desktop browser session removes the biggest hardware barrier to entry.
* **Layout Advantage:** Because Grand Archive is almost exclusively 1v1, the UI can use a clean horizontal or vertical split-screen for the two boards, leaving wide sidebars for the card inspector, combat math, and spectator overlays.

### 4. Grand Archive-Specific Digital HUD & State Tracking
* **The "What":** An interactive overlay built around GA's unique resource and damage mechanics.
* **The "Why":** Physical dice glare on camera and get bumped easily. A tailored UI should track:
  * **Damage Counters vs. Life:** Tracking damage counters *up* toward the Champion's current life threshold as they level from $0$ to $3$.
  * **The Memory Zone Tracker & Randomizer (Anti-Cheat & Clarity):** In GA, cards placed face-down into Memory pay for costs and get banished at random during the Recollection phase to pay for Materializations. On webcam, face-down cards at the bottom of a playmat often slip out of frame. A digital counter showing *"Cards in Memory: X"* alongside a built-in **"Random Memory Roll"** button (e.g., rolling a digital die to pick cards $1$ through $X$ from left to right) keeps both players honest.
  * **Champion Level & Buff Counters:** Quick badges for Champion Level, enabled elements, Influence/Floating Memory count, Enlightenment counters, or Prep counters.

### 5. Spectator & Streamer Broadcast Mode
* **The "What":** A dedicated read-only view or OBS browser-source overlay that tracks hovered/clicked cards and game state.
* **The "Why":** Spectators on Twitch or Discord cannot click the video feed themselves. Having a **"Last Played / Active Stack"** sidebar that automatically pins high-res scans of the last 2–3 recognized cards allows viewers to follow fast-speed reactions and combat chains effortlessly.

### 6. Matchmaking & Ecosystem Hooks
* **The "What":** Discord OAuth login, public/private lobby creation, and decklist import hooks.
* **The "Why":** Replaces awkward Discord text-channel matchmaking with a centralized lobby browser where players can tag rooms as *"Casual Testing"* or *"Ascent Prep"*.

---

## Part 2: Lightweight MVP Architecture

To build a working prototype over a weekend with near-zero server costs, **push 95% of the compute to the client browser** and **constrain the recognition problem** using pre-loaded decklists.

### 1. High-Level Tech Stack

The server should **never** process video frames or run computer vision. It only introduces peers and syncs lightweight JSON state payloads.

| Layer | Recommended MVP Tech | Role & Responsibility |
| :--- | :--- | :--- |
| **Frontend Client** | Vue 3 / Nuxt or React (deployed on Vercel/Cloudflare) | Renders video feeds, runs the HUD overlay, and executes client-side image cropping and card matching. |
| **Video & Audio Transport** | **PeerJS** (WebRTC Mesh) or **LiveKit** (Free Tier) | Streams video/audio directly peer-to-peer between Player A, Player B, and connected mobile cameras. |
| **Signaling & Game State** | **Supabase Realtime** or Node.js + `Socket.io` | Syncs room codes, WebRTC handshakes, Damage/Memory counters, and the "Currently Inspected Card" ID. |
| **Card Data & Hashes** | Static JSON on CDN + **Index API** (`api.gatcg.com`) | Serves official card metadata, high-res images, and pre-computed perceptual hashes. |

---

### 2. The "Decklist Pre-Load" Shortcut

Skip global 5,000+ card recognition in v1:
1. **Pre-Match Lobby:** Require both players to paste their decklist export text (or an Omnidex/Silvie URL) before entering the table.
2. **Scoped Search Pool:** A standard GA match only contains around $60$ to $80$ unique cards combined between both players' Main Decks, Material Decks, and tokens.
3. **Instant Hash Caching:** When the table loads, the browser fetches card metadata from `api.gatcg.com` for *only* those ~75 cards and loads their pre-computed visual fingerprints into browser memory.
4. **Performance:** Matching a webcam crop against an array of 75 items in JavaScript takes less than $2\text{ ms}$ and achieves vastly higher accuracy than querying a massive backend database.

---

### 3. Client-Side Vision Pipeline (Click-to-Scan)

Instead of continuous full-board object detection (which drains CPU/battery and struggles with overlapping cards in Memory), use **Click-to-Scan**:

1. **User Action:** Player A clicks on a card on Player B's video feed (or drags a quick bounding box over it).
2. **Canvas Snapshot (`HTML5 Canvas`):** The browser grabs the current frame from the `<video>` element around those $(X, Y)$ coordinates.
3. **Contour & Perspective Warp (`OpenCV.js`):**
   * Run a lightweight WebAssembly build of OpenCV in a Web Worker.
   * Convert the cropped region to grayscale, apply Canny edge detection, and find the largest 4-point contour (the card sleeve).
   * Apply a perspective transform (`warpPerspective`) to flatten the angled card into a clean, upright $250 \times 350$ rectangle.
4. **Artwork Isolation & Hashing:**
   * Crop the top-center portion of the flattened rectangle (where GA card artwork sits, ignoring the text box).
   * Generate a **64-bit Perceptual Hash (dHash or pHash)** or extract a lightweight MobileNet embedding via `Transformers.js`.
5. **Hamming Distance Match:** Compare that hash against the ~75 pre-loaded decklist hashes. Display the top match in the sidebar and broadcast the `card_slug` over WebSockets so both players and spectators see the high-res scan immediately.
6. **Manual Fallback:** Include a quick-search bar (filtering the loaded decklists) right above the card viewer. If heavy glare obscures a foil card, typing three letters (`"c-r-e"` $\rightarrow$ *Cremation Ritual*) pins it to the screen.

---

### 4. The "Phone-as-Webcam" Flow

1. **Room Peer IDs:** When Player 1 creates a room (e.g., `room-482`), their PC browser joins as `room-482-p1-pc`.
2. **QR Code Pairing:** The PC screen displays a QR code pointing to `your-app.com/cam?room=482&player=1`.
3. **Mobile WebRTC Stream:** Scanning the QR code opens a mobile webpage that requests `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })` and pushes that video track directly to the room as `room-482-p1-cam`.
4. **Wake Lock API:** Call `navigator.wakeLock.request('screen')` on the mobile page so the phone screen does not dim and drop the connection mid-turn.

---

### 5. Synced GA State Payload (WebSockets)

The entire match state can live in an ephemeral JSON object broadcast via Supabase Realtime channels or `Socket.io`:

```json
{
  "roomId": "ga-match-992",
  "activeSpotlightCard": "merlin-kingslayer-csr",
  "actionLog": [
    "Player 1 inspected 'Ignite the Soul'",
    "Player 2 rolled Random Memory: Card #3 (from left)"
  ],
  "players": {
    "p1": {
      "championName": "Merlin, Memory Thief",
      "championLevel": 2,
      "damageCounters": 11,
      "floatingMemory": 2,
      "influenceCounters": 4,
      "memoryZoneCount": 5
    },
    "p2": {
      "championName": "Lorraine, Wandering Warrior",
      "championLevel": 3,
      "damageCounters": 18,
      "floatingMemory": 0,
      "influenceCounters": 1,
      "memoryZoneCount": 3
    }
  }
}
```

### Key MVP UI Widgets
* **The "Random Memory" Button:** Reads `memoryZoneCount` (e.g., $5$), generates a shared random integer between $1$ and $5$ over the WebSocket, and flashes a banner on both screens: *"Banish Card #4 from the left."*
* **OBS Spectator URL:** A route like `your-app.com/room/992/overlay` rendering *only* the `activeSpotlightCard` high-res image and the two players' Champion Level / Damage bars on a transparent background for tournament streamers.

---

## Part 3: Suggested 3-Phase Build Order

1. **Phase 1 (The Tabletop & Phone Bridge):** Build the 2-player WebRTC split-screen, the QR-code phone camera pairing, the GA-specific HUD (Damage counters, Level indicator, Random Memory roller), and the manual decklist search/pin sidebar. *(At this stage, the app is already 100% playable and superior to standard Discord calls).*
2. **Phase 2 (The Pre-Computation Script):** Write a Node.js or Python script that pulls card data from `api.gatcg.com`, crops the artwork boxes, calculates perceptual hashes, and exports a single static `ga-hashes.json` file (~500KB).
3. **Phase 3 (Click-to-Scan Computer Vision):** Wire up the HTML5 Canvas click listener and `OpenCV.js` perspective warp to match clicked regions against the `ga-hashes.json` subset for the loaded decks.