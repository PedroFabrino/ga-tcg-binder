# 0005: Native Mobile Companion Scanner via Vision Camera & Real-Time WebSockets

## Context
ADR 0003 established a client-side web browser scanner (`/scan/[token]`) using mobile Safari/Chrome canvas extraction and Tesseract.js over HTTP polling. While zero-install, mobile web browsers face severe frame-rate bottlenecks (thermal throttling, canvas readback lag, JS single-thread OCR stalls >800ms) that prevent sub-50ms rapid-fire card cataloging. Collectors cataloging physical binders require instant autofocus control, hardware edge snapping, sub-50ms on-device native OCR, and sub-350ms end-to-end sync to the desktop collection UI.

## Decision
We supersede the web-only mobile scanner in favor of a dedicated native companion application (React Native with TypeScript, `react-native-vision-camera` frame processor worklets, and native ML Kit / Apple Vision OCR), paired with the desktop collection dashboard via QR-initiated WebSocket sessions.

1. **Native Vision Pipeline**: Execute 4-corner perspective warping, Laplacian variance blur rejection, and luminance glare gating on native frame processor threads before routing cropped header/footer buffers to native OCR engines.
2. **Real-Time Transport**: Replace HTTP polling with an ephemeral, room-isolated WebSocket gateway (`session_<uuid>`) bridging the mobile camera scanner and the desktop receiver UI with sub-50ms transport latency.
3. **Domain Alignment**: Adhere to Grand Archive TCG finishing models (`Normal` vs `Foil`) rather than generic TCG variants, integrating with the existing Turso 64-bit visual hash and OCR composite scoring engine.

## Consequences
- **Supersedes ADR 0003**: The mobile web `/scan/[token]` route remains as a low-fidelity fallback, but active rapid scanning shifts to the native companion client.
- **Infrastructure**: Requires a stateful WebSocket server (or edge WebSocket broker) decoupled from Vercel's ephemeral serverless HTTP lifecycle.
- **Developer Workflow**: Introduces mobile build pipelines (iOS/Android native toolchains) alongside the Next.js web application.
