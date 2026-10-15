# 06 — Native Perspective Warp, OCR & 64-Bit Perceptual Hashing (GitHub Issue #15)

**What to build:** Perspective warp the stabilized card quad to a normalized 630x880 pixel buffer on the native thread. Run on-device native OCR (Apple Vision / ML Kit) on the top 15% header strip for Card Title and the bottom 15% footer strip for Collector Number (`\b\d{1,4}/\d{1,4}\b`) and Set Prefix. Compute a 64-bit dHash/pHash on the card artwork and emit a `SCAN_IDENTIFY_REQUEST` WebSocket payload.

**Blocked by:** #14 (05 — Native Camera Viewfinder, Quality Gate & Hardware Control)

**Status:** ready-for-agent

- [ ] 4-point perspective transform projects card quad into normalized 630x880 buffer on native thread.
- [ ] Header strip ROI crops top 15% and runs native OCR to extract card title string.
- [ ] Footer strip ROI crops bottom 15% and runs native OCR with regex parsing for collector numbers and set prefixes.
- [ ] Card artwork ROI computes 64-bit perceptual hash (16 hex chars).
- [ ] Formats and dispatches `SCAN_IDENTIFY_REQUEST` payload over the active WebSocket connection.
