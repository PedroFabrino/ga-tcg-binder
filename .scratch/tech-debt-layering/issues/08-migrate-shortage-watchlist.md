# 08 - Migrate shortage and watchlist to Repositories and split under 400 lines

**GitHub:** #47 (parent #39)

**What to build:** Shortage calculation and watchlist persistence use Repositories; shortage.ts and watchlist.ts are split by responsibility. Hard Shortage and Shared Shortage results are unchanged.

**Blocked by:** #40

**Status:** ready-for-agent

- [ ] No direct db access in shortage or watchlist modules
- [ ] All resulting files under 400 lines
- [ ] Migrated files removed from the allowlist
- [ ] Shortage and watchlist tests pass

