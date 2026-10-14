# 04 — Automated Weekly Synchronization via GitHub Actions

**What to build:** An automated background synchronization workflow in GitHub Actions that triggers the protected `/api/meta/sync` endpoint every Monday at 12:00 UTC using a secure bearer `CRON_SECRET`, ensuring the application automatically reflects new weekend tournament results without manual intervention.

**Blocked by:** 03 — Meta Explorer UI Native Tiers & Manual Sync

**Status:** ready-for-agent

- [ ] `/api/meta/sync` authenticates requests using `Authorization: Bearer <CRON_SECRET>` or an active authenticated user session.
- [ ] A GitHub Actions workflow (`.github/workflows/meta-sync.yml`) is scheduled for Mondays at 12:00 UTC (`0 12 * * 1`) and supports manual workflow dispatch.
- [ ] The workflow reads the deployment URL (`APP_URL`) and `CRON_SECRET` from repository secrets, issues a POST request, and records execution status.
- [ ] A standalone script `pnpm sync:meta` is provided for manual CLI execution in local or staged environments.
- [ ] Failure in the cron job produces a clear diagnostic log in GitHub Actions while preserving existing database records safely.
