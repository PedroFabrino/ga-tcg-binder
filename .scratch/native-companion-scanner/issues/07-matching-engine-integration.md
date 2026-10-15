# 07 — Real-Time Candidate Matching Engine Integration (GitHub Issue #16)

**What to build:** Integrate the WebSocket gateway with the backend Turso libSQL database to process `SCAN_IDENTIFY_REQUEST` messages in real time. Execute visual candidate retrieval with 64-bit Hamming distance, evaluate OCR trigram string similarity, apply the +15% exact collector number boost, and return a ranked candidate list with composite confidence scores via `SCAN_IDENTIFY_RESPONSE` within 50ms.

**Blocked by:** #11 (02 — WebSocket Session Gateway Microservice), #15 (06 — Native Perspective Warp, OCR & 64-Bit Perceptual Hashing)

**Status:** ready-for-agent

- [ ] WebSocket gateway connects incoming identify requests to the Turso matching service.
- [ ] Evaluates visual Hamming distance across indexed card hashes (filtering pool to top 20).
- [ ] Computes composite confidence score: `(0.60 * Visual_Score) + (0.40 * OCR_Score)` with +15% collector number boost (capped at 99%).
- [ ] Returns top candidate and up to 4 alternative matches in `SCAN_IDENTIFY_RESPONSE`.
- [ ] Query latency benchmarked at < 50ms under typical local and Turso latency.
