# apps/table lives in the ga-tcg-binder monorepo

GrandTable is a separate, independently deployable Next.js application, but its code lives in `apps/table` inside the `ga-tcg-binder` pnpm monorepo rather than its own repository. The table shares `@ga/contracts` (room message types and the i18n catalog), the `services/ws-gateway` signaling layer, and the collection app's `Card`/`Printing`/`Deck` vocabulary, and it reuses the deck-list parser through the shared `@ga/deck-import` package. A shared monorepo keeps each of those a single source of truth; the cost is that binder deployments now also carry a realtime app, which is acceptable because the two apps share nothing at runtime and deploy independently (Vercel root = `apps/table`, gateway to Cloudflare Workers).

**Consequences:** `@ga/contracts` is the single source of truth for shapes used by both apps, so a change there rebuilds both; each app keeps its own `package.json`, `tsconfig.json`, and `docs/`.
