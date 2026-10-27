# 0027: Liga storefront availability adapter via curl-impersonate and Cloudflare session

## Status

Accepted (supersedes the LigaStore retirement clause of ADR 0025)

## Context

ADR 0025 retired LigaStore crawling on the premise that its Grand Archive catalog was dormant, noting that "Reintroducing it is a new adapter behind the engine, not a re-enable flag." Collectors actively monitor vendor storefronts on the LigaMagic platform — specifically TabletopSorocaba and Brandão TCG — for card shortages and wants.

However, attempting to crawl TabletopSorocaba revealed critical obstacles:
1. **Cloudflare TLS Fingerprinting:** Cloudflare protects the storefronts. Even when providing a valid browser `cf_clearance` cookie and matching `User-Agent`, Node.js's built-in HTTP client (OpenSSL TLS handshake) is immediately rejected with HTTP 403.
2. **FlareSolverr Escalation:** Stateless FlareSolverr invocations were getting blocked or rate-limited after ~5 pages (HTTP 403 and 429).
3. **Broken Stock Filter & Sprite Obfuscation:** TabletopSorocaba's `txt_estoque=1` filter is broken, returning all ~2,919 catalog items across 25 pages (`txt_limit=120`). Furthermore, list-page prices and quantities are obfuscated with dynamically generated CSS sprite sheets that vary per page.

Spike tests demonstrated:
- Node.js `fetch` / `https.get` fails on page 1 with HTTP 403 due to JA3/JA4 TLS fingerprint mismatch.
- Windows `curl.exe` (using OS Schannel TLS) successfully crawled 15 consecutive pages (1,800 items) in 50 seconds without blocks.
- Inside Linux Docker, `curl-impersonate` (using `curl_chrome152`) successfully crawled consecutive 120-item pages in ~300ms each with zero blocks.
- Out-of-stock items omit `<div class="price ">` markup entirely, while in-stock items include it. This provides a robust boolean in-stock signal without needing brittle CSS sprite OCR/offset reverse engineering.

## Decision

1. **Reintroduce Liga as a Market Crawl Adapter.** Implement a dedicated `LigaAvailabilityAdapter` conforming to the unified Market Crawl engine architecture, superseding ADR 0025's retirement of LigaStore.
2. **Adopt `curl-impersonate` inside Docker.** Install `curl-impersonate` (`curl_chrome152`) in `Dockerfile.sync`. This avoids the massive weight (~1.5 GB image overhead and ~500 MB RAM) of headless Playwright Chromium while accurately mimicking Chrome's TLS ClientHello and HTTP/2 settings.
3. **Collector-Supplied Session Authentication.** Load per-store Cloudflare cookies (`cf_clearance`) and `User-Agent` headers dynamically from git-ignored files or environment variables on each run. Derive `Sec-Ch-Ua` headers from the User-Agent version.
4. **Binary In-Stock Signal.** Treat cards with a price container on search result pages as available (`quantity >= 1`). Discard out-of-stock listings. Detailed price and quantity extraction are deferred to on-demand detail-page queries when matching active shortages.
5. **Fail-Fast Session Expiry.** If Cloudflare returns HTTP 403, 429, or a challenge page, abort the crawl immediately with a typed `SessionExpired` failure without touching existing stored listings.

## Consequences

- TabletopSorocaba and Brandão TCG can be reliably crawled inside Docker.
- Requires the collector to supply a valid `cf_clearance` cookie and User-Agent when Cloudflare challenges activate.
- Docker image incorporates `curl-impersonate` binary (~20MB binary vs ~1.5GB full browser).
- Database contains clean in-stock availability records without sprite-parsing fragility.
