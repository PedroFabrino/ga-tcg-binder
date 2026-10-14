# 0002: Use Auth.js (NextAuth) with Discord and Google OAuth

## Context
The application supports multiple collectors (friends and playgroup members) who need isolated personal collections, personal decks, and reciprocal visibility into each other's idle cards.

## Decision
We use Auth.js (NextAuth v5) configured with Discord and Google OAuth providers, persisting users and sessions directly into the Turso (libSQL) database via Drizzle adapter.

## Consequences
- Eliminates the need to build and secure custom password reset, salt/hash, and email verification flows.
- Integrates seamlessly with Discord, the primary platform used by the Grand Archive community and local playgroups.
- Requires configuring OAuth Client IDs and Secrets in environment variables for deployment.
