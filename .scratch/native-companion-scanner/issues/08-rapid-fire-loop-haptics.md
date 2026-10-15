# 08 — Rapid-Fire Auto-Commit Loop, Haptics & Candidate Bottom Sheet (GitHub Issue #17)

**What to build:** Build the mobile rapid-fire scanning UX: when candidate confidence is >= 90%, play native haptic impact, display a non-intrusive 1.2-second bottom countdown pill with Normal/Foil finish toggle, and auto-commit the card without interrupting the camera viewfinder. When confidence is < 90%, display a bottom sheet with top 3 fuzzy candidates for manual selection. Emit `CARD_COMMITTED` to the WebSocket session, triggering immediate desktop hero card and session feed updates.

**Blocked by:** #12 (03 — Desktop Real-Time Scanning Screen & QR Pairing Flow), #16 (07 — Real-Time Candidate Matching Engine Integration)

**Status:** ready-for-agent

- [ ] High certainty (>= 90%) triggers crisp native haptic pulse (`Haptics.impactAsync`).
- [ ] Non-intrusive bottom pill shows card name, set prefix, collector number, and 1.2-second auto-commit progress bar.
- [ ] Normal/Foil toggle on bottom pill defaults to Normal (or Foil if population metadata indicates foil-only).
- [ ] Low certainty (< 90%) displays bottom sheet presenting alternative candidates with one-tap selection.
- [ ] Confirmed cards emit `CARD_COMMITTED` over WebSocket, persisting to `collection_items` table and updating desktop hero display and feed in real time.
- [ ] Camera remains continuously active throughout confirmations for uninterrupted rapid-fire scanning.
