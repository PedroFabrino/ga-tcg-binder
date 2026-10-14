# 0001: Use Turso (libSQL) with Drizzle ORM for Persistence

## Context
The application is a Next.js full-stack app deployed to Vercel serverless environments. Traditional local disk-backed SQLite (`file:dev.db`) cannot be used in production because Vercel serverless functions are stateless and ephemeral.

## Decision
We chose Turso (libSQL) with Drizzle ORM for data storage. In local development, the app can run against local SQLite or a local Turso instance, while in production on Vercel it connects to a Turso cloud database over HTTP using `@libsql/client`.

## Consequences
- Preserves the low footprint and schema simplicity of SQLite across both development and production.
- Enables relational joins for cross-deck contention, card catalog search, and shortage calculations without connection pooling bottlenecks on serverless lambdas.
- Requires configuring `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables for remote deployments.
