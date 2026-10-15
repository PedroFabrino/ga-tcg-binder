# 05 — Native Camera Viewfinder, Quality Gate & Hardware Control (GitHub Issue #14)

**What to build:** In the mobile app, implement the high-throughput native camera viewfinder locked to continuous autofocus with floating torch/flashlight toggle. Render a centered 2.5 : 3.5 aspect ratio card guide with dynamic corner anchors that snap to detected card edges. Execute quality gate checks on native worklet threads (sharpness via Laplacian variance, specular glare cluster rejection, and 3-frame positional stability).

**Blocked by:** #13 (04 — Mobile Companion App Scaffolding & Pairing State Machine)

**Status:** ready-for-agent

- [ ] Camera initialized with wide-angle rear sensor, continuous autofocus (`focusMode: "continuous"`), and floating torch toggle.
- [ ] Viewfinder renders centered 2.5 : 3.5 target guide with dynamic corner anchors.
- [ ] Native frame processor computes Laplacian variance; blurry frames below sharpness threshold (70) are rejected with visual feedback.
- [ ] High-specular glare clusters (>250 luma, >12% card area) from sleeves/foils are rejected.
- [ ] Stability filter requires 4 corners to remain within 8px variance across 3 consecutive frames before triggering processing.
