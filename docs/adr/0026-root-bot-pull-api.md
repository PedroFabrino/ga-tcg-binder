# 0026: Root cloud bot pulls from the web app API

## Status

Accepted

## Context

The Root bot runs in Root's cloud, which provides no `.env` / secret storage and
no inbound webhooks. The bot therefore cannot reach Turso or Discord directly,
and the web app cannot push to it. The previous design assumed the bot could run
the shared matcher and write the database (devhost or a shared secret), which
does not work in the hosted community.

Root also does not sign outbound requests, so the only trust anchors available
today are the app id (public manifest id) and a token the bot obtains at
runtime.

## Decision

- The Next.js app owns the data plane (Turso, Discord, matching, formatting,
  change detection) and exposes a **pull API** under `/api/root-bot/*`.
- `POST /api/root-bot/install` accepts only the allowlisted app id and mints a
  random per-install token keyed by `(app_id, community_id)`. Only the SHA-256
  hash is stored (`root_bot_installs`). The bot stores the token in Root's
  `dataStore.appData`; rotations and operator revocation are supported.
- Every other call carries `Authorization: Bearer <token>` plus the community
  id. State is scoped by `root:<communityId>` for market delivery
  (`notification_deliveries`) and deal alerts (`deal_alert_messages`).
  `root_community_identities` scopes Root identities to the community.
- The bot is a thin delivery agent: it authenticates, pulls work, posts/updates
  Root channels, sends Root notifications, and reports delivery. It imports no
  database, repository, or Discord code.
- Polling uses Root's job scheduler (one persisted one-time job per tag,
  rescheduled after each run) because the scheduler has no sub-daily interval.
- Assistant commands reuse the existing Assistant service; the routes accept a
  validated install bearer token in addition to the shared assistant secret.

## Consequences

- The bot can run in Root's cloud with no secrets besides its install token.
- Operators can revoke an install; a revoked install cannot be revived by
  re-registering.
- Multi-community installs are isolated by token, state key, and identity
  mapping. A user must link or opt in once per community before they are in
  scope.
- The app-id allowlist is the initial trust baseline; if Root adds outbound
  request signing, the install endpoint can verify it without changing the bot.
