## Parent

#56

## What to build

Create a dedicated `/settings` page (and link it from the application Navbar) backed by per-user configuration columns on `users` (`superfrete_api_key_encrypted`, `slightly_overpriced_multiplier`, `heavily_overpriced_multiplier`). Collectors can manage their MyP Username, securely store/replace their Superfrete Production API Key (AES-256-GCM encrypted at rest using `AUTH_SECRET`, never exposed in plaintext after save), and configure their custom Slightly Overpriced (default 1.2x) and Heavily Overpriced (default 2.0x) multipliers. These custom multipliers immediately govern `evaluatePriceFairness` across both Marketplace listings and Deck Shortages.

## Acceptance criteria

- [ ] New columns on `users` table: `superfrete_api_key_encrypted`, `slightly_overpriced_multiplier` (default `1.2`), `heavily_overpriced_multiplier` (default `2.0`).
- [ ] Dedicated `/settings` route (and Navbar navigation link/modal replacement) allowing Collectors to update `mypUsername`, `superfreteApiKey`, and both Overpriced multipliers.
- [ ] Superfrete API Key is encrypted at rest via AES-256-GCM (`src/lib/crypto.ts`) and never returned in plaintext in API responses (only a `hasSuperfreteApiKey: boolean` indicator is returned).
- [ ] `evaluatePriceFairness` accepts user-configured multipliers (falling back to 1.2x and 2.0x defaults) and consistently classifies listings across Marketplace and Deck Shortages.
- [ ] All new UI strings are registered in both `en` and `pt-BR` dictionaries under `@ga/contracts` with strict parity.
- [ ] End-to-end tests verify settings persistence, crypto round-trip, and dynamic price fairness thresholds.

## Blocked by

- None — can start immediately
