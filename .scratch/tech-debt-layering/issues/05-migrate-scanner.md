# 05 - Migrate scanner Services and routes to Repositories

**GitHub:** #44 (parent #39)

**What to build:** Scanner pairing, session, queue, and match persistence use Repositories; scanner.ts is split under 400 lines. Pairing flow is unchanged.

**Blocked by:** #40

**Status:** ready-for-agent

- [ ] No direct db access in scanner Services or routes
- [ ] scanner Service files are each under 400 lines
- [ ] Migrated files removed from the allowlist
- [ ] Scanner tests pass

