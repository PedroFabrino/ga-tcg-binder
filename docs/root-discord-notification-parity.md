# Root ↔ Discord Notification Parity

Status: **Implemented** (spec #147, tickets #148–#153) · Last updated: 2026-10-24

This document records how Root deal alerts and market notifications map onto
Discord's behavior, the architecture chosen because Root has no DM API and no
cloud secrets, and the pull-based delivery contract between the Root bot and
the web app.

---

## 1. What Root offers (and what it doesn't)

- **No direct-message API.** The server SDK exposes no private/conversation
  surface. There is no `directMessage`, `conversation`, or `userMessage`
  primitive.
- **No inbound webhooks and no cloud secret storage.** Root-hosted code cannot
  receive webhooks and does not get `.env` / secrets. The web app therefore
  exposes a **pull API** and the bot holds only a per-install token it stores in
  Root's own key-value store.
- **Access-controlled channels.** `channels.create` accepts
  `accessRuleCreates` (per-role/member `ChannelOverlayPermission` overlays) and
  `useChannelGroupPermission: false`. `ChannelPermission.channelView` controls
  visibility, and `WellKnownRootGuids.CommunityRoles.EveryoneRole` identifies
  the base role to deny.
- **Channel messages** can be created and deleted (`channelMessages.create` /
  `channelMessages.delete`), so a rolling message can be replaced.
- **In-app notifications** via `notifications.send`: title ≤ 50 chars,
  description ≤ 150 chars, up to 1000 users per call, returns no message id
  (so no edit/delete/rolling).
- **Job scheduler** runs one-time/daily/weekly/monthly/yearly jobs, not
  arbitrary sub-daily intervals (see §3).

## 2. The delivered design

Three surfaces:

1. **Shared market channel** — the bot pulls pending market chunks from the API
   and posts them to the channel configured by `/setup`. Everyone sees the same
   stream.
2. **Private per-user deal-alert channel** — one channel per opted-in
   collector, created in the **parent group of the `/setup` channel** (so it
   sits beside the market dump). Access rules deny `channelView` to the base
   role and grant it to the recipient (plus create/history); the bot grants
   itself access via its app id, so other members cannot see it. The channel
   holds the **full rolling list** of that collector's wantlist + deck shortages
   that are for sale; the message is replaced only when the list changes.
3. **In-app notification ping** — when the list changes, the bot also sends a
   short notification. If there are hard shortages it names up to three
   (`Cards: A, B and C for sale and more!`); otherwise it says new wantlist
   cards are for sale. It deep-links to the channel when supported and names
   the channel otherwise.

Change-only semantics stay on the server: `hasListingChanges` compares the match
keys, so an unchanged list produces neither a channel update nor a notification.

## 3. Architecture: thin bot, data plane in the web app

The web app (Next.js, deployed on Vercel) owns Turso and the Discord secrets and
all data-plane logic. The Root cloud bot is a **delivery agent**: it authenticates,
pulls work, posts/updates Root channels, sends Root notifications, and reports
delivery. It imports nothing from the web app.

```
Root cloud bot                         Next.js Root bot API
  install (appId, communityId)  ──────▶ POST /api/root-bot/install   → token (hashed at rest)
  poll market / deal-alert work ──────▶ GET  /api/root-bot/...        (Bearer + community id)
  post to Root / ping user
  report delivery / cleanup     ──────▶ POST /api/root-bot/.../delivered
```

### Per-install auth

- `root_bot_installs` is keyed by `(app_id, community_id)` and stores only a
  SHA-256 **hash** of a random token (`token_hash` unique, `revoked_at`).
- `POST /api/root-bot/install` accepts only the allowlisted `ROOT_BOT_APP_ID`
  (public manifest id, default `ADH-6fbvigmppj1_qgZSmw`) and rotates the token on
  every install.
- Every other call sends `Authorization: Bearer <token>` and
  `x-root-community-id`; `authenticateRootBot` hashes the bearer, rejects
  missing/revoked tokens, and rejects a community mismatch. Tokens can be
  revoked with `revokeRootBotInstall(appId, communityId)`.
- The bot persists the token in `rootServer.dataStore.appData`
  (`rootBot.installToken:<communityId>`) and reuses it across restarts. No
  shared secret or `.env` is compiled into the bot.

### Scheduling

Root's job scheduler has no sub-daily interval (`OneTime`, `Daily`, …). The bot
therefore keeps **one pending one-time job per tag** and reschedules it after
each run (`scheduleRootBotPolling`). The pending job is persisted by Root, so a
restart resumes polling instead of losing the timer. There is no `setInterval`.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/root-bot/install` | Mint/rotate the per-install token |
| `GET` | `/api/root-bot/market-notifications` | Pending market chunks |
| `POST` | `/api/root-bot/market-notifications/delivered` | Record market delivery |
| `GET` | `/api/root-bot/deal-alerts` | Changed plans + stale cleanup |
| `POST` | `/api/root-bot/deal-alerts/delivered` | Record rolling-list delivery |
| `POST` | `/api/root-bot/deal-alerts/cleanup` | Clear a removed recipient's state |
| `GET` | `/api/root-bot/deal-alerts/channel` | Existing channel for a recipient |
| `GET` | `/api/root-bot/collector` | Resolve a Root identity to a collector |
| `POST` | `/api/root-bot/notify` | Set the wantlist-notification preference |
| `POST/GET` | `/api/assistant/*` | `/link`, `/decks`, `/shortages`, `/collection`, `/wantlist` |

Assistant routes accept either the existing `x-assistant-token` shared secret or
a validated per-install Bearer token, so the bot reuses the same handlers.

### State and scoping

- Market delivery reuses `notification_deliveries` with destination
  `root:<communityId>`, so each community has its own ledger.
- Deal-alert state reuses `deal_alert_messages` with destination
  `root:<communityId>`; Discord keeps `discord-dm`. Rows are keyed by
  `(destination, recipient_id)`.
- `planDealAlerts` computes plans/cleanup without sending; the bot delivers and
  reports. Matching, formatting, and change detection never run in the bot.

## 4. Opt-in

`/notify on|off` in Root sets
`collector_identities.wantlist_notifications_enabled` for the `root` identity
through `/api/root-bot/notify`. Enabling creates the collector's private channel
immediately, posts a welcome message there, and replies with a link to it (so
the user knows where alerts will arrive); disabling deletes the channel and
clears the stored state. An opted-in collector with no current matches keeps
their channel and welcome message until the first match arrives.

## 5. Configuration

| Variable | Where | Purpose |
|---|---|---|
| `ROOT_BOT_API_BASE_URL` | `apps/ga-tcg-root-app/src/root-bot-config.ts` (compiled) | Public URL of the web app. Root cloud injects no `.env`, so set this before `npm run deploy`; an env override works locally. |
| `ROOT_BOT_APP_ID` | Web app env | Allowed install app id. Defaults to the manifest id `ADH-6fbvigmppj1_qgZSmw`. |
| `ASSISTANT_API_SECRET` / `ASSISTANT_TOKEN` | Web app env | Existing shared secret for non-Root assistant clients; install Bearer tokens are also accepted. |
| `DEAL_ALERT_DM_DESTINATION` | Web app env | Comma-separated destinations (`discord-dm,root-alert`). Defaults to both. |
| `DISCORD_BOT_TOKEN` | Web app env | Opens/reuses Discord DMs. |
| `DEV_TOKEN` | Bot (local devhost only) | Selects the community the bot attaches to. Root's cloud supplies the community in production. |
| `ROOT_BOT_POLL_INTERVAL_MS` | Bot env (local) | Market poll interval (default 30000). |
| `ROOT_DEAL_ALERT_INTERVAL_MS` | Bot env (local) | Deal-alert poll interval (default 300000). |

Community-specific channel configuration is **not** in `.env`. It lives in the
bot's per-community key-value store (`rootServer.dataStore.appData`): `/setup`
records the broadcast channel and its parent group (used for per-user channels);
if the group cannot be resolved, the bot falls back to creating a "GA Alerts"
group.

## 6. Root setup checklist (portal + community)

**Web app**

- Apply `drizzle/0008_root_bot_installs.sql` to Turso (the test harness runs it
  automatically; production needs the normal migration step).
- Optionally set `ROOT_BOT_APP_ID` (defaults to the manifest id).
- Deploy. The bot calls `/api/root-bot/install` on first start and stores the
  token in Root's key-value store.

**Bot**

- Set `ROOT_BOT_API_BASE_URL` in `apps/ga-tcg-root-app/src/root-bot-config.ts`
  to the deployed web app origin (compiled into the bundle).
- Bump the manifest version and `npm run deploy` so the community approves the
  updated permissions.

**Developer Portal / manifest**

- The manifest declares `channel.fullControl = true` (channel create/delete/edit
  plus posting) and `community.createChannelGroup = true` (to create the
  "GA Alerts" section).

**Community (Root client, owner)**

- Install/approve the app with the updated permissions.
- Run `/setup` in the channel that should receive market updates (community
  admins with Manage Apps, or the owner). It warns that the channel becomes the
  market dump and requires `/setup confirm` to apply.
- Make sure the bot has `fullControl` on that channel's group, so it can create
  per-user channels there. A role with `channelFullControl`, assigned to the bot
  and added to the group, works.
- Per-user channels are created in the `/setup` channel's group on `/notify on`
  (fallback: a bot-created "GA Alerts" group if the group cannot be resolved).
  Notifications need no manifest permission.

## 7. Verification caveats

These were flagged during design and should be confirmed in a real community:

- Whether `channelView: false` **hides** a channel from the member's channel list
  or only blocks opening it. The wording implies hiding; verify.
- The channel's **default permission** when `useChannelGroupPermission: false` —
  the base-role `channelView: false` overlay is what makes it private.
- Whether channel/group creation needs a **manifest permission** granted by the
  community admin (notifications are documented as needing none).
- Whether a notification's `relativeUrl` can target a Root channel. It is
  documented as resolving against the app's own router, so the fallback is to
  name the channel in the notification text.
- Identity resolution is per Root user (`collector_identities`), not per
  community membership. A multi-tenant deployment would need community-scoped
  identities; the current token and delivery ledgers are already
  community-scoped, so a single install per community is the supported shape.

## 8. Deferred: channel-broadcast unification

The Root market poller now reads through the API and records delivery in
`notification_deliveries` under `root:<communityId>`. Discord still uses its own
sink. The remaining duplication is the formatter selection (the API formats, the
bot posts), which is intentional: formatting stays in the data plane.

## 9. Out of scope

- **Root cloud secret storage** — no longer a blocker: the bot holds no Turso or
  Discord secrets and only stores its per-install token in Root's key-value
  store.
- A full Root client app (UI, onboarding overhaul, deep-link router).
- A Root DM API (does not exist).
- Web-app Settings toggle for Root opt-in (the Root command is the surface).
- Changes to the Discord deal-alert path.
