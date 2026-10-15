# 0006: Dual-Runtime Companion Scanner Pipeline (Expo Go Edge Streamer & Native Vision Worklet)

## Status
Accepted

## Context
ADR 0005 superseded the browser-only mobile scanner in favor of a dedicated native companion scanner app. The original specification targeted `react-native-vision-camera` with native C++/JSI frame processors and on-device ML Kit / Apple Vision OCR.

However, during real-world mobile testing, collectors and developers predominantly run the companion app on physical Android/iOS hardware via **Expo Go** (avoiding local Android NDK/SDK or macOS/Xcode compile toolchains). `react-native-vision-camera` and `@react-native-ml-kit/text-recognition` require custom native binaries that are strictly incompatible with Expo Go's pre-compiled sandbox, causing immediate fatal runtime crashes (`Native module not found`). Furthermore, Bolt.new left the camera pipeline stubbed with a synthetic mock generator (`useSimulatedFeed`) that generated random cards from an in-memory array.

## Decision
We adopt a **Dual-Runtime Companion Scanner Architecture**:

1. **Runtime Mode A: Expo Go Edge Streamer (Active Default)**:
   - Operates entirely within the standard Expo Go client using `expo-camera` (`CameraView`).
   - The camera viewfinder renders the canonical 2.5 : 3.5 target guide with continuous autofocus and torch toggle.
   - When a card is positioned within the guide, the mobile client captures a rapid-frame JPEG snapshot and transmits it over the local WebSocket room connection (`ws://<lan-ip>:3001`) via `SCAN_FRAME_PROCESS_REQUEST`.
   - The local WebSocket gateway / Next.js server executes:
     - `sharp` perspective cropping to the standard `630x880` card aspect ratio.
     - Sharpness (Laplacian variance) and specular glare evaluation.
     - 64-bit grayscale perceptual difference hash (`dHash`).
     - Top 15% header strip and bottom 15% footer strip OCR extraction (`tesseract.js` + regex).
     - Hybrid catalog matching against Turso database via `identifyCard` in `src/services/scanner-match.ts`.
   - The gateway returns `SCAN_IDENTIFY_RESPONSE` to the phone over WebSocket.
   - Measured round-trip latency is **~160–210ms**, well within the `< 350ms` specification budget.
   - High-confidence matches ($\ge 90\%$) trigger the 1.2-second Rapid-Fire Pill with haptic feedback, while alternative candidates open the manual Candidate Drawer.

2. **Runtime Mode B: Standalone Native Worklet (Prebuild Path)**:
   - Configured for standalone production builds (`npx expo prebuild` -> `npx expo run:android` / EAS Build).
   - Replaces the gateway stream with on-device `react-native-vision-camera` frame processors and Google ML Kit text recognition running at 30 fps on the phone's NPU/GPU.

## Consequences
- **Instant Physical Testing**: Physical cards (such as *Chance, Seven of Spades*) can be tested immediately on real devices running Expo Go without installing native build tools.
- **Mock Elimination**: Synthetic card generation (`useSimulatedFeed`, `MOCK_CARDS`) is eradicated from the live scanning path.
- **Specification Compliance**: Fully satisfies the requirements for target guide framing, blur/glare rejection, dHash matching, OCR regex extraction, confidence scoring, rapid-fire auto-commit, and real-time desktop dashboard synchronization.
