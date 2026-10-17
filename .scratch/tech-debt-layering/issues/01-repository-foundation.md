# 01 - Repository layer foundation with settings pilot

**GitHub:** #40 (parent #39)

**What to build:** A Repository convention exists and the settings aggregate is fully migrated as the reference: the settings route calls a Service, the Service calls a Repository, and no query remains outside the Repository. Behavior is unchanged for users.

**Blocked by:** None - can start immediately

**Status:** ready-for-agent

- [ ] Repositories location and conventions are documented in ADR 0012
- [ ] Settings persistence goes through a Repository only
- [ ] Service-level vitest test covers settings behavior against in-memory libSQL
- [ ] Existing tests pass

