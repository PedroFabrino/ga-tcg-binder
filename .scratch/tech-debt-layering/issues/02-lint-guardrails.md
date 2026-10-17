# 02 - Lint guardrails with shrinking allowlist

**GitHub:** #41 (parent #39)

**What to build:** Lint fails on database imports outside Repositories and on source files over 400 lines (tests exempt), except for an explicit allowlist of current offenders that may only shrink.

**Blocked by:** #40

**Status:** ready-for-agent

- [ ] Restricted-import rule for drizzle-orm, libsql and db imports outside Repositories
- [ ] max-lines 400 rule for source files, tests exempt
- [ ] Allowlist captures every current offender listed in ADR 0012
- [ ] CI runs the lint and fails on new violations
- [ ] A test or script proves allowlist entries cannot be added without failing review

