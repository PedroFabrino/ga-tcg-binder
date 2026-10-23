# GrandTable — MVP v1 Specification

**Status:** ready to build. Supersedes the MVP scope in `grandtable_initial_mvp_technical_architecture.md` and `grand_archive_webcam_platform_architecture.md`; both remain useful as background on intent, but their technical sections contain factual errors listed in §11.

**Vocabulary:** see `CONTEXT.md`. Terms used here (`Table`, `Seat`, `Feed`, `Capture Device`, `Pin`, `HUD`, `Whiteboard`, `Turn`) are defined there.

---

## 1. What v1 is

A standalone web app where two people play a physical game of Grand Archive over video, with a shared, mirrored board state.

**The one job:** replace "Discord call + dice on camera" for two friends, without falling back to another video tool.

**Acceptance test for v1:** ten real matches played to completion, at least one using a phone as the board camera, every match resumed successfully after at least one deliberate refresh or network drop, and no match abandoned because of the tool.

**Who it is for:** the author's playgroup. Distribution ladder after v1: local-community online tournaments → content creators (the overlay is the acquisition surface) → public → league.

---

## 2. Out of scope for v1

Every item here has a named trigger in §10. Nothing in this list is a "maybe later" without a condition.

| Not in v1 | Because |
| --- | --- |
| Card recognition (CV) | Highest risk, zero matches depend on it. Pins and search cover the need. |
| Audio in the app | Removes device selection, echo, and phone-cam-sends-audio. Root voice channels carry the call. |
| Match recording | The action log is the artifact worth keeping; OBS captures the rest better. |
| Accounts, profiles, lobby browser | Two people, one link. |
| Persistence beyond a Table's lifetime | Nothing to store that a screenshot doesn't cover. |
| Referees, spectators, second Feed per Seat | No such role exists yet. The model leaves room (§6.1). |
| LAN / offline mode, Tauri | Every venue in scope has internet. |
| Deck import by URL | Paste is the contract; URL fetching scrapes a site we don't control. |

---

## 3. Architecture

```
                 ┌──────────────────────────────┐
                 │  apps/table  (Vercel)        │
                 │  Next.js, static + client    │
                 │  card data ← api.gatcg.com   │
                 └──────────────┬───────────────┘
                                │ WSS (state + signaling)
                                ▼
                 ┌──────────────────────────────┐
                 │  services/ws-gateway         │
                 │  Cloudflare Worker           │
                 │  + TableDO (one per Table)   │
                 │  + GET /turn (ICE servers)   │
                 └──────┬───────────────┬───────┘
                        │               │
             ┌──────────▼────┐   ┌──────▼─────────┐
             │  P1 desktop   │   │  P2 desktop    │
             │  seat + HUD   │   │  seat + HUD    │
             └──────▲────────┘   └──────▲─────────┘
                    │  WebRTC video     │
                    │  (1 stream each)  │
             ┌──────┴───────┐    ┌──────┴─────────┐
             │  P1 capture  │    │  P2 capture    │
             │  phone or PC │    │  phone or PC   │
             └──────────────┘    └────────────────┘
```

- **Media never touches a server.** Two peer connections per Table: each Seat's Capture Device sends one stream to the opponent's desktop.
- **State never flows peer-to-peer.** All state goes through the TableDO, which is the single authority for seat ownership and write permissions.
- **Card data is fetched directly from `api.gatcg.com`** by the browser. Keyless, CORS-open, no proxy, no database.

Deployment: `apps/table` → Vercel. `services/ws-gateway` → Cloudflare Workers (Durable Objects, free plan, SQLite backend).

---

## 4. Routes

| Route | Purpose | Auth |
| --- | --- | --- |
| `/` | Create a Table, or join by Room Code | — |
| `/t/[code]` | The Table: opponent Feed, HUD, Pins, controls | seat token |
| `/t/[code]/cam` | Capture Device: camera preview, publish | seat token, `role: capture` |
| `/t/[code]/stage` | Same as Table, no controls, 16:9 | seat token |
| `/t/[code]/overlay` | Transparent chrome for OBS, no video | viewer token |

Seat tokens live in `localStorage` keyed by Room Code. The invite link carries the second Seat's token; the first client to use it claims that Seat. Refresh or reconnect reclaims a Seat from `localStorage` — no re-typing, no re-joining.

---

## 5. State model

Held by the TableDO, broadcast as a snapshot on join and deltas thereafter.

```ts
type SeatId = 'p1' | 'p2';

interface SeatState {
  displayName: string;
  championSlug: string | null; // canonical Card slug; level and life are read from the card
  damage: number;              // counts up; Seat is defeated when damage >= printed life
  memory: number;              // count of face-down cards in Memory
  hand: number;                // cards in hand; influence = hand + memory, never stored
}

interface Pin {
  seat: SeatId;
  cardSlug: string;            // canonical Card
  printingSlug?: string;       // chosen art, when the player picks one
  at: number;
}

interface TableState {
  code: string;
  seats: Partial<Record<SeatId, SeatState>>;
  active: SeatId | null;       // Turn holder; never a phase
  pins: Partial<Record<SeatId, Pin>>;
  recent: Pin[];               // last 3, newest first
  ripples: Ripple[];           // ephemeral pointer markers, ~4s
  log: LogEntry[];             // last 50, append-only
}
```

**Write permissions, enforced in the DO, not the client:**

- A Seat may mutate only `seats[self]`, `pins[self]`.
- `active` is claimed by either Seat when `null`; once set, only the active Seat may clear it (End Turn). This makes turn handoff deterministic and conflict-free.
- `recent`, `ripples`, `log` are appended by the server only.
- Role allowlist: `capture` connections may send `signal` and read state; they may not write HUD fields. `viewer` connections read only.

**Decklists are never in `TableState`.** A Seat's imported deck lives in its own browser (§6.6). When recognition lands, lists move to the DO for server-side matching and are never rebroadcast (ADR-0002).

**Messages** extend `@ga/contracts`:

```
client → server:  hello{token, role} · seat.update{patch} · turn.start · turn.end
                  pin.set{cardSlug, printingSlug?} · pin.clear · ripple{x,y}
                  signal{to:{seat, role}, data}
server → client:  state{snapshot} · state.patch{...} · signal{from, data} · presence{...}
```

Signaling addresses peers by `{seat, role}` rather than connection ID, so a Capture Device that reconnects is addressed identically and the negotiation survives.

---

## 6. Subsystems

### 6.1 Rooms and seats

One Durable Object per Room Code, SQLite-backed, WebSocket Hibernation API enabled. Idle sockets may be dropped by the platform; the client reconnects with backoff and the object rehydrates from storage. A Table remains addressable for 24h after the last disconnect, then is deleted.

Joining: `/` creates a Table and lands on `/t/[code]` as `p1`, showing a QR + link for the opponent. A third connection is refused with a clear message rather than a silent failure.

**Seat takeover:** the same Seat token may be opened in a second tab, which is normal during development and happens by accident to players. The newest connection wins; the older socket receives `displaced`, stops sending writes, and shows a passive notice with a "take over" action. Without this rule, two tabs silently fight over one Seat and the HUD appears to change by itself.

The model deliberately allows a third role (`viewer`) with no schema change — that is how referees and watchers arrive later.

### 6.2 Media

- **One Capture Device per Seat.** A Seat's Feed comes from either the desktop webcam or a paired phone; never both at once. Switching devices renegotiates.
- The Capture Device publishes to **the opponent's desktop only**. Its own local preview is how the player frames the shot; the player's desktop does not render their own Feed.
- **The receiving desktop offers**, because the desktop is the stable peer. The Capture Device answers. ICE restart is initiated by the receiver.
- Constraints: `1280×720@30` ideal, `contentHint: 'detail'`, bitrate cap ≈2.5 Mbps. `detail` matters: without it the encoder smooths fine card text.
- ICE servers come from `GET /turn` on the gateway, which mints short-lived Cloudflare Realtime TURN credentials. STUN is public. Assume ~15% of pairs need TURN.
- iOS: a locked screen mutes (not ends) the camera track, so the viewer sees a frozen frame. Show a "camera asleep" badge over a stale Feed rather than pretending it is live. Screen Wake Lock is requested on the `/cam` page.
- No camera available anywhere: the Table still works — opponent Feed area shows an empty state, and the HUD, Pins, and search remain fully usable.

### 6.3 HUD

Per Seat, five fields: name, Pin'd Champion (level and life read from the card), damage, memory, hand. `influence` is displayed as a derived sum, never stored. Turn holder is shown as one "Active" badge.

All fields are manual and mirrored. No rules enforcement, no validation beyond non-negative integers. Every change appends to the action log with the Seat that made it.

### 6.4 Pins

Each Seat has one current Pin and contributes to a shared `recent` list of three. Pinning is: search → select → Pin. Search is scoped to the Seat's imported deck when one exists, with an escape hatch to the full catalog (tokens, sideboard swaps, unlisted cards).

The overlay and the opponent's screen render Pins at near-native size (500×700 art shown ~350px tall at 1080p) — no full-bleed upscaling.

### 6.5 Pointer ripple

Clicking the opponent's Feed drops a numbered marker at that normalized coordinate on both screens for ~4s. No recognition, no persistence, no permission needed. This is the interaction that makes the Feed feel live before CV exists.

### 6.6 Deck import

A textarea on the Table (or in a pre-match step) accepting the Omnidex/GrandArchiveStats text format. Reuses `parseOmnidexText` from `ga-tcg-binder/src/services/omnidex.ts`.

Required corrections to that parser for this use:

- **Champion** is the Material-deck card whose printed `level` is `0`, resolved through the catalog — not the first line of the Material deck. (The current parser returns `2 Assassin's Mantle`.)
- **Unresolved names must be surfaced as a warning list**, not silently dropped.
- The parsed deck is a *starting point*: pinning always allows falling back to the global catalog.

The deck is stored in `localStorage` and never sent to the server in v1. No URL import.

### 6.7 Overlay and stage

`/overlay` is transparent, video-free chrome designed at 1920×1080 with CSS scaling: top bar = both Seats (name, champion art, level, damage/life, memory, hand, Active badge); bottom strip = three-Pin log with attribution; plus a static wordmark. No QR or URL until there is a public product to point at.

`/stage` is the Table without controls, for window capture. The streamer layers `/stage` (video, captured as a window) under `/overlay` (transparent browser source). This is deliberate: WebRTC playback inside OBS's CEF browser source is unreliable, so the overlay carries no video.

Read-only viewer token, embedded in the URL.

### 6.8 Card data

- `GET /cards/all` once, cached in `localStorage` with a 7-day TTL, for name → slug resolution and accent-insensitive fuzzy search.
- `GET /cards/search?slug={slug}` on demand for stats, rules text, and art; results cached in IndexedDB. (`/cards/{slug}` returns `{"error":"Not found"}` and is not used.)
- Art URLs are `editions[].image` (500×700, `access-control-allow-origin: *`). The field is API-relative (e.g. `/cards/images/….jpg`), so the client prefixes `https://api.gatcg.com`. Alt arts are separate printings with separate images; a Pin stores the canonical card slug and optionally the chosen printing.
- If the API is unavailable, search still works from cache and uncached art shows a placeholder. An in-progress Table must not care.

---

## 7. Milestones

Each milestone ends with something two people can use, and a test that proves it.

### M1 — Rooms, seats, HUD (weekend 1)
Scaffold `apps/table` in the monorepo; `TableDO` with seat tokens, partitioned writes, reconnect; HUD with five fields, Active toggle, action log; `/overlay` skeleton.

**Done when:** two browsers in one Table mirror every HUD change in <300ms; a refresh reclaims the Seat with state intact; a third join is refused; an attempt to write the opponent's fields from a client is rejected by the server; a Table survives 24h of idleness and is gone after.

### M2 — Video (weekend 2)
`/cam` Capture Device page; QR pairing; one stream per Seat to the opponent; `GET /turn`; ICE restart; camera-asleep and no-camera states.

**Done when:** a phone pairs by QR and its board appears on the opponent's screen at 720p with readable card text; locking and unlocking the phone resumes the Feed within 5s without renegotiating manually; killing Wi-Fi and restoring it recovers the Feed without a refresh, verified at least once with the two desktops on different networks; a desktop webcam works as the Capture Device with no phone involved.

### M3 — Deck import, Pins, ripple (weekend 3)
Parser reuse plus the champion fix; deck grid in the rail; Pin within a Seat and the shared three-Pin log; pointer ripple.

**Done when:** `omnidex_export.txt` pastes into a working grid; the champion resolves to the level-0 card; an unknown card name is reported rather than dropped; a Pin appears on both screens and on the overlay within 300ms; a click on the opponent Feed ripples identically on both.

### M4 — Overlay, stage, hardening (weekend 4)
Overlay layout at 1080p, `/stage`, wordmark, empty states, error copy, and the first real matches.

**Done when:** the overlay composites over a window capture in OBS with clean transparency and legible text at 1080p; 10 matches played per §1; no match lost to a technical failure.

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Phone thermal throttling mid-match | 720p, `detail` hint, bitrate cap; test a full 60-minute match in M2, not at the end |
| iOS mutes camera on lock | Badge + auto-resume; never show a frozen frame as live |
| Free-tier DO duration (~13,000 GB-s/day ≈ 28 Table-hours) | Fine for friends; watch it, and it's a $5/mo problem if a league ever runs concurrent Tables |
| `api.gatcg.com` outage or change | Cache-first; Table stays playable without it |
| TURN unavailable | Cloudflare Realtime free tier (1,000 GB/mo egress); surface a clear "could not connect" message rather than a spinner |
| Solo development against a two-player product | Two windows (one private, since a second normal tab reclaims p1's token) plus a real phone as a Capture Device — all on one machine. Failure states are induced directly: close a tab, toggle DevTools offline, open a third window. |
| Testing only on localhost, where ICE never has to work | At least one real-network check per milestone, against a peer on another connection |

---

## 9. Open items (non-blocking)

- Domain and app name for the public link.
- Whether the wordmark becomes a link once the product is public.
- Card-art licensing posture, which only matters at the public/league stage.

---

## 10. Deferred, with triggers

| Deferred | Pull it back in when |
| --- | --- |
| Card recognition | A content creator asks for it, or pinning friction is visibly slowing matches |
| Audio in-app | Someone wants game audio in a stream, or two windows becomes annoying |
| Recording | Someone wants VOD review |
| Accounts, persistence | A stranger joins |
| Lobby, matchmaking | A second playgroup appears |
| Referee/watcher roles | A tournament needs oversight (read-only role already modeled) |
| Second Feed per Seat | A referee needs a hand-zone view |
| Deck import by URL | Paste friction is real and the source HTML proves stable |
| LAN/Tauri | A venue has no usable internet |
| pt-BR translation | The Brazilian community is onboarded (strings already isolated in one module) |

---

## 11. Corrections to the source drafts

Recorded so these errors do not get reintroduced by anyone reading the original documents.

1. **Life is printed per champion card, not a level table.** 15/20/25/28 is false; Lorraine is 20/24/28, Rai is 19 at L1, Merlin is 22 at L2. Read `life` from the card.
2. **Level is a property of the champion card.** Levelling is materializing the next champion onto the lineage; damage carries over.
3. **Floating Memory is a keyword**, not a resource pool: banish it from the graveyard to pay 1 of a memory cost. There is nothing to track.
4. **Influence is derived**: hand + memory.
5. **Recollection returns every Memory card to hand.** The randomness lives in paying memory costs, not in the Recollection phase.
6. **Reserve costs are chosen from hand; memory costs are banished at random.** The randomizer is a cost-payment action, not a once-per-turn ritual.
7. **Card images exist only at 500×700.** No high-resolution scans.
8. **Alt arts are separate printings with separate images**, not a mapping problem: canonical Card slug for mechanics, printing for art.
9. **Omnidex is the official organized-play platform** (`omni.gatcg.com`), not a deckbuilder, and exposes no deck API. Silvie and GrandArchiveStats are the export sources, and both are undocumented — paste is the contract.
10. **The champion cannot be inferred from the first Material-deck line**; it is the level-0 card.
