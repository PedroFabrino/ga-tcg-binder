# 07 - Migrate marketplace to Repositories and split marketplace Service

**GitHub:** #46 (parent #39)

**What to build:** Marketplace persistence uses Repositories and the ~1800 line marketplace Service is split by responsibility, each module under 400 lines. Marketplace behavior is unchanged.

**Blocked by:** #40

**Status:** ready-for-agent

- [ ] No direct db access in marketplace modules or routes
- [ ] All resulting source files under 400 lines
- [ ] Migrated files removed from the allowlist
- [ ] Marketplace tests pass

