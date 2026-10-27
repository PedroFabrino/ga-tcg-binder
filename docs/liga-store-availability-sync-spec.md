## Problem Statement

The Collector wants to be told when a Grand Archive card they need (a Shortage or Personal Want) is in stock at the Liga-platform stores they follow, starting with TabletopSorocaba and later Brandão TCG. Today the LigaStore sync is unreliable: Cloudflare returns HTTP 403 and 429 for the site, and the current flow (a stateless FlareSolverr request per page, retried repeatedly) fails from about page 6 of 25. The catalog is only partially synced, so availability data is wrong or missing. LigaStore crawling was also retired by ADR 0025, so there is no maintained path for it.

TabletopSorocaba's "only in stock" filter is broken, so the whole catalog (about 2,900 listings at 120 per page, roughly 25 pages) has to be walked even though about 80% of cards are out of stock. Prices and exact quantities on list pages are obfuscated with CSS sprites and are not needed at this stage.

## Solution

A Liga availability sync that, per store, walks every catalog page through a browser-fingerprint-compatible HTTP client using a Collector-supplied Cloudflare session (cookie plus User-Agent), keeps only in-stock listings, resolves each to a canonical Card (printing, finish and variant collapse to the base card, set is optional metadata), and stores "Card X is available at Store Y". A listing counts as in stock when its list-page card block shows a price block; out-of-stock cards show none.

Exact quantity and price are out of the list-page path. When a Collector is waiting on a card, a later step opens that card's detail page to read price and amount.

If the session expires or Cloudflare challenges the run, the sync stops, writes nothing, and logs a typed, observable failure. Notifications of that failure (Discord) come later. The sync runs inside the existing market-sync Docker container, so it works without an open terminal and stops with `docker stop`.

## User Stories

1. As a Collector, I want TabletopSorocaba's whole catalog crawled, so that availability is not silently truncated at page 5.
2. As a Collector, I want only in-stock cards kept, so that the stored data reflects what I can actually buy.
3. As a Collector, I want a card that appears in several printings, finishes or variants (for example Curio Foil) treated as the same card, so that I am notified whatever the print.
4. As a Collector, I want the set recorded when it can be determined, so that I can see which printing is available even though it is not required.
5. As a Collector, I want the sync to use my own Cloudflare session cookie and User-Agent, so that I can solve the challenge once in my real browser.
6. As a Collector, I want the cookie and User-Agent stored outside git and never logged, so that my session is not leaked.
7. As a Collector, I want the sync to read the session file at the start of every run, so that I can refresh the cookie without rebuilding or restarting the container.
8. As a Collector, I want the sync to abort cleanly when Cloudflare returns 403, 429 or a challenge page, so that I get no partial or corrupted data.
9. As a Collector, I want an expired session to produce a typed "session expired" failure with a clear warning, so that I know exactly what to refresh.
10. As a Collector, I want a failed run to leave previously stored availability untouched, so that a bad run never wipes good data.
11. As a Collector, I want a polite delay with jitter between pages, so that I do not get rate limited.
12. As a Collector, I want the HTTP client's TLS and HTTP/2 fingerprint to match a real Chrome whose version is close to my User-Agent, so that Cloudflare accepts my session cookie.
13. As a Collector, I want the sync to run inside Docker, so that I do not need a terminal open or my Windows host involved.
14. As a Collector, I want to stop the sync at any time with a normal container stop, so that I stay in control.
15. As a Collector, I want a full sync four times a day, matching the existing market-sync schedule, so that Liga stores refresh like MyP Cards and Lootcards.
16. As a Collector, I want a lightweight check every five minutes, so that availability changes are noticed between full syncs when that is technically possible for the store.
17. As a Collector, I want the lightweight check to be skipped, not faked, for any store where no cheap change signal exists, so that I never get false "nothing changed" results.
18. As a Collector, I want the engine to treat a Liga store as an adapter behind the existing Market Crawl engine, so that fetch, pacing and failure handling are not duplicated.
19. As a Collector, I want Brandão TCG supported by the same adapter with its own session, so that adding the second store is configuration, not new code.
20. As a Collector, I want the Brandão in-stock filter used when it works, so that fewer pages are fetched.
21. As a Collector, I want each store's page size, ordering and filter behavior declared per store, so that a broken filter at one store does not affect another.
22. As a Collector, I want the sync to read total page count from the first page, so that it adapts as the catalog grows or shrinks.
23. As a Collector, I want a sanity check that the number of parsed listings matches the store's reported total, so that silent parse breakage is detected.
24. As a Collector, I want cards that cannot be resolved to a canonical Card counted and reported, so that name-matching gaps are visible.
25. As a Collector, I want stock for a listing to be discarded when quantity is zero, so that out-of-stock rows never reach notification matching.
26. As a Collector, I want listings that disappear between runs to be reconciled as no longer available, so that I am not notified about sold-out cards.
27. As a Collector, I want a later step to open a card's detail page for exact price and quantity, so that price lookups only happen for cards someone wants.
28. As a Collector, I want the new adapter to reuse the existing Listing Resolver, so that card matching is consistent across stores.
29. As a Collector, I want the CSS sprite price decoder not to be relied on, so that obfuscation changes on the store never break availability.
30. As a Collector, I want an ADR recording the re-introduction of Liga crawling and the new HTTP client dependency, so that the architecture history stays consistent.
31. As a developer, I want the failure to be observable in logs with a reason, so that I can diagnose Cloudflare changes quickly.
32. As a developer, I want a lifecycle test that walks the full sync (cookie valid, pages, resolve, store, reconcile) including the expiry abort, so that regressions are caught.

## Implementation Decisions

- **Adapter, not a revival.** Per ADR 0025, reintroducing LigaStore is a new adapter behind the Market Crawl engine, not a re-enable flag. The retired parser and sync modules stay as reference only. A new ADR supersedes the "LigaStore retired" decision for the Liga platform and records the HTTP client dependency.
- **Transport.** Requests go through `curl-impersonate` (the lexiforest fork, Chrome 152 profile) installed in the sync image, with the Collector's real User-Agent and Cloudflare cookie overridden. Spike evidence: from inside a Linux container, pages 1–8 of TabletopSorocaba returned HTTP 200 with 120 cards per page. Node's built-in HTTP client was rejected with 403 despite a valid cookie because of its TLS fingerprint. Windows `curl.exe` also passed, which is why the fingerprint, not the cookie, was the blocker. FlareSolverr becomes a fallback only when no session file exists.
- **Session input.** A per-store session file (cookie string plus User-Agent) mounted into the container and read at the start of each run. It is git-ignored, never logged, and never bundled in the image. Client hint headers are derived from the User-Agent's Chrome version so they match.
- **Stock signal.** A listing is in stock when its card block contains a price block. Exact quantity is not parsed from the list page; the item detail page provides it later. A canonical `inStock` marker, not a decoded quantity, is what the adapter emits.
- **Normalization.** Titles such as "Apostle of the Woods (#46)" and "Apostle of the Woods (Curio Foil)" are cleaned of collector number, finish and variant tags, then resolved with the existing Listing Resolver into a canonical card identifier. Set code is carried as optional metadata when present in the title.
- **Pacing and failure.** The adapter declares page delay (about 3 s plus jitter) and retry delay. `cloudflareGuard` and `failDetection` are on. A 403, 429 or challenge page aborts the run with a typed "session expired" failure. Nothing is written to the store listings table on abort. Reconciliation of disappeared listings only happens after a complete successful crawl.
- **Parity check.** The first page's reported total is compared with the number of parsed listings at the end of the crawl. A mismatch fails the run as a parse-breakage signal rather than writing partial data.
- **Per-store config.** TabletopSorocaba: page size 120, default order, stock filter disabled (broken), full catalog walk. Brandão: the stock filter is enabled and observed to work. A single test request returned 6 cards, all in stock, and needed no cookie, but it is a weak test because the store has only one page of stock.
- **Scheduling.** Full syncs stay on the existing six-hour interval, four runs a day. The five-minute Count Poll for Liga stores is only valid where the reported total tracks stock. For Brandão it does, because the filter is on and total equals stock. For TabletopSorocaba the total is the whole catalog count (about 2,919) and does not change when stock changes, so the Count Poll cannot detect changes there. A cheap change signal for TabletopSorocaba (for example a single page sorted by newest, hashed) must be investigated and, if none exists, the soft check is skipped for that store and only the four daily full syncs apply.
- **Deployment.** The adapter runs inside the existing market-sync container on the Collector's machine. No headed browser step is required.
- **No notifications yet.** Discord alerts for session expiry are deferred to a later change.

## Testing Decisions

- A good test exercises external behavior only: given recorded list-page HTML and a session, what listings are stored, and what happens on expiry. It does not assert implementation details such as regex shapes.
- **Seam:** the adapter's crawl entry point with an injected fetch function, which already exists as the pattern in the retired sync's tests. This is the highest existing seam and the only new one needed.
- Cover: parsing a captured list page to an in-stock set (price-block rule), title normalization to canonical card with variants and finishes collapsed, optional set extraction, the total-versus-parsed parity failure, abort on 403/429/challenge with no writes, reconciliation of disappeared listings, and one full-lifecycle test walking valid session, all pages, resolve, store, reconcile and the expired-session abort invariant.
- Prior art: the retired LigaStore sync tests and the MyP and Lootcards adapter tests for the Market Crawl engine.
- Header derivation (User-Agent to client hints) and session-file loading get unit tests.
- Spike evidence (fingerprint, Docker transport) is manual and documented in the ADR, not an automated test.

## Out of Scope

- Price and exact quantity from list pages (the sprite-obfuscated fields). A later step reads them from the item detail page for cards someone is waiting on.
- Discord or other notifications on session expiry.
- Notifying Collectors about matched cards (the notification pipeline consumes the stored availability separately).
- Automatic Cloudflare solving or refreshing the cookie. The Collector refreshes it manually.
- Cloud or GitHub-Actions execution of the Liga sync. It runs on the Collector's machine only.
- A Playwright or headed-browser fallback, unless curl-impersonate stops working.
- Other Liga stores beyond TabletopSorocaba and Brandão TCG.

## Further Notes

- **Cookie lifetime is unknown.** The Collector needs it to last 6–7 hours. This has not been measured. A re-test several hours after the first spike is recommended, and acceptance depends on the result.
- The `cf_clearance` cookie is bound to the Collector's IP and User-Agent. Docker Desktop egresses through the host IP, which kept the spike valid.
- The cookie pasted into the planning conversation should be rotated (log out and in) once testing is done.
- Brandão's session needs may differ; the test request succeeded without a cookie, but this should be re-checked on larger catalog pages.
- Per ADR 0025, adding this adapter changes the "two active crawlers" statement; the new ADR must update it.
