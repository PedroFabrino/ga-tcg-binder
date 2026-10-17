# 04 - Migrate decks, friends, auth and settings routes to Repositories

**GitHub:** #43 (parent #39)

**What to build:** Deck, friend, and auth persistence go through Repositories; auth callbacks and the decks/friends routes no longer touch the database.

**Blocked by:** #40

**Status:** ready-for-agent

- [ ] No direct db access in decks, friends, or auth modules
- [ ] Routes only parse, authorize, call a Service, respond
- [ ] Migrated files removed from the allowlist
- [ ] Tests pass

