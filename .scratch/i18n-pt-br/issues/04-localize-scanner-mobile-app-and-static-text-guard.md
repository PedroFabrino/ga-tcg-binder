## Parent

- #34

## What to build

Localize all Web Scanner surfaces (`QrScanModal`, `/scan/dashboard`, `/scan/[token]`, `src/components/scanner/*`) and the entire **Companion Scanner** React Native Mobile App (`apps/mobile/`), wire up desktop-to-mobile locale synchronization via `PairingQrPayload`, add the Mobile Settings language selector, and add the automated static-text guardrail test:

1. **Web Scanner Surfaces & QR Pairing Locale Sync**:
   - Include the active `locale` (`"en" | "pt-BR"`) in the `PairingQrPayload` generated for QR pairing.
   - Localize `QrScanModal`, `/scan/dashboard`, `/scan/[token]`, `CameraOverlay`, `CandidateList`, `RapidScanDrawer`, and `VariantSelector`.
2. **Companion Scanner Mobile App (`apps/mobile/`)**:
   - Initialize mobile locale from the device OS language (`pt*` → `pt-BR`, fallback `en`) and automatically sync to `payload.locale` when pairing with a desktop session (unless manually overridden in Mobile Settings).
   - Add a Mobile Settings modal/sheet (triggered via a Settings icon in `PairingView` and `ScannerHeader`) allowing the user to switch between `English` and `Português (Brasil)` without cluttering the camera header.
   - Localize all static strings across `PairingView`, `ManualPairModal`, `ScannerScreen`, `ScannerHeader`, `CameraViewfinder`, `QualityGateHUD`, `TargetGuideOverlay`, `CandidateDrawer`, `RapidFirePill`, `RecentScans`, `BottomTabBar`, `Badges`, `BinderPreview`, `SuitePreview`, and `SuiteScreens` while keeping `Normal` / `Foil` finishes and game terms in canonical English.
3. **Automated Static Text Policy Guardrail (`vitest`)**:
   - Add an automated test verifying that all translation keys referenced across Web (`src/`) and Mobile (`apps/mobile/src/`) exist in `@ga/contracts`, that `en` and `pt-BR` catalogs have 100% parity, and that all UI pages/components comply with the `AGENTS.md` static text policy.

## Acceptance criteria

- [ ] `QrScanModal`, `/scan/dashboard`, `/scan/[token]`, and `src/components/scanner/*` contain zero hardcoded user-facing static strings.
- [ ] `apps/mobile/` auto-detects device language (`pt*` → `pt-BR`, else `en`), adopts `locale` from `PairingQrPayload` on desktop pairing, and provides a language selector inside a Mobile Settings modal.
- [ ] Every screen and component in `apps/mobile/src/` renders all static UI copy in `en` and `pt-BR` via `@ga/contracts`.
- [ ] Automated Vitest static-text and catalog completeness tests pass alongside `tsc --noEmit` in both root and `apps/mobile`.

## Blocked by

- #35
