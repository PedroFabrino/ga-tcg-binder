# 06 - Migrate meta, staples and sync-pipeline to Repositories

**GitHub:** #45 (parent #39)

**What to build:** Meta, staples, and two-phase sync-pipeline persistence use Repositories; meta.ts is split under 400 lines. Meta sync behavior is unchanged.

**Blocked by:** #40

**Status:** ready-for-agent

- [ ] No direct db access in meta, staples, or sync-pipeline modules
- [ ] Each resulting file is under 400 lines
- [ ] Migrated files removed from the allowlist
- [ ] Meta and sync tests pass

