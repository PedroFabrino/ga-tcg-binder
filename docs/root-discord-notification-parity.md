# Root ↔ Discord Notification Parity

Status: **Proposal** · Owner: TBD · Last updated: 2026-10-24

This document maps what Discord notifications do today, what the Root
app/bot does today, and the concrete work needed to make Root a first-class
peer of Discord for market notifications and deal-alert DMs.

The consolidation work in spec #129 already laid most of the groundwork: a
shared vocabulary (`Destination`), two delivery seams (`ChannelDeliverySink`
for broadcasts, `DirectMessageSink` for per-recipient rolling DMs), and a
reserved `root-dm` destination. This document is the "what's left" list.

---

## 1. Two delivery systems

| Capability | Discord (today) | Root (today) |
|---|---|---|
| **Channel broadcast** | Push via webhook. `deliverDiscordNotifications()` → `DiscordMarketNotificationSink` → `deliverMarketNotifications()`. Delivery tracked in `notification_deliveries` (keyed `destination = "discord"`). | Pull via poller. `startMarketNotifier()` polls `market_notifications` every 30s, posts to a community channel. Delivery tracked on the outbox row itself: `market_notifications.sent_at` / `message_id`. |
| **Per-recipient rolling DM** (Deal Alerts) | `dispatchDealAlerts()` matches in-stock listings to wantlists/deck shortages, keeps one rolling DM per Discord user, deletes + re-sends only when the match list changes. State in `deal_alert_messages` keyed by `discord_user_id`. | **None.** No DM adapter ships. |
| **Opt-in toggle** | `/wantlist notify` (Discord) sets `collector_identities.wantlist_notifications_enabled` for `provider = "discord"`. | **None.** No Root surface sets the flag. |
| **Identity linking** | OAuth + bot onboarding → `collector_identities` rows with `provider = "discord"`. | `/link <code>` → `provider = "root"`, `providerUserId` = Root user id. Already works. |
| **Message formatting** | `formatDiscordMarketNotificationMessage` (escaped Markdown, chunked). Deal alerts use plain-text `formatDealAlertChunks`. | `formatMarketNotificationChunks` (Root Markdown, chunked under Root limits). |
| **Message length budget** | `MESSAGE_MAX_LENGTH = 2000`. | Same constant, but Root's real per-message limit must be confirmed against the SDK. |

---

## 2. What is already in place (do not rebuild)

These are the seams and vocabulary introduced by #129/#135 that this work builds on:

- `src/lib/market-vocabulary.ts`
  - `type Destination = "root" | "discord" | "discord-dm" | "root-dm"`
  - `ROOT_DESTINATION`, `DISCORD_DESTINATION`, `DISCORD_DM_DESTINATION`, and the
    reserved `ROOT_DM_DESTINATION`.
- `src/services/market-notification-sink.ts`
  - `ChannelDeliverySink` (= `MarketNotificationSink`) — `formatGroup` / `send` / `markDelivered`.
  - `DirectMessageSink` + `DirectMessageRef` — `send(recipient, content) → { channelId, messageId }`, `delete(ref)`.
  - `deliverMarketNotifications(sink, db)` — the broadcast delivery loop, destination-agnostic.
- `src/db/repositories/notification-delivery-repository.ts`
  - `getUndeliveredNotifications(destination)` / `markNotificationsDelivered(...)` — already destination-parameterized.
- `src/db/repositories/assistant-repository.ts`
  - `findIdentitiesWithNotificationsEnabled(provider)` — **already** takes `provider`; `matchDealAlerts` just hardcodes `"discord"` today.
- `src/db/repositories/personal-wants-repository.ts`
  - `setWantlistNotificationPreference(collectorId, provider, enabled)` / `getWantlistNotificationPreference(...)` — **already** provider-parameterized.
- `src/services/discord-deal-notifier.ts`
  - `dispatchDealAlerts(database, transport, now, options)` — **already** takes a `DirectMessageSink` transport, so a Root adapter can be swapped in without touching the matcher/formatter.

---

## 3. Work breakdown

### A. Confirm Root SDK direct-message capability (blocker)

The Root bot currently only touches `rootServer.community.channelMessages`
(channel broadcast). Before building the adapter, confirm against
`@rootsdk/server-bot`:

- Whether it exposes a direct/private message or conversation API
  (e.g. `rootServer.directMessages` / `rootServer.conversations`).
- The return shape (does it yield a `channelId` + `messageId` for later delete?).
- Whether DMs support delete/edit (rolling replacement needs delete).
- The actual per-message character limit (to size `MESSAGE_MAX_LENGTH` or add a Root-specific limit).

If the SDK has **no DM surface**, the deal-alert DM parity is blocked until the
SDK exposes one — fall back to "Root deal alerts land in the community channel
as a single tagged mention," which is a product decision, not a code seam change.

### B. Root `DirectMessageSink` adapter (`root-dm`)

Create `src/services/root-deal-notifier.ts` (mirrors
`discord-deal-notifier.ts`'s transport section), implementing
`DirectMessageSink`:

```ts
import { ROOT_DM_DESTINATION } from "../lib/market-vocabulary";
import type { DirectMessageSink, DirectMessageRef } from "./market-notification-sink";

export const rootDealAlertTransport: DirectMessageSink = {
  send: async (rootUserId, content) => { /* rootServer.directMessages.create(...) */ },
  delete: async (ref) => { /* rootServer.directMessages.delete(...) */ },
};
```

Requirements:
- Resolve the Root user id → recipient handle the SDK expects.
- Chunk content with `splitMessageContent(content, ROOT_MAX_LENGTH)` and return a
  comma-joined message id (same convention as `sendDiscordDirectContent`).
- Return `null` on any failure so the shared dispatch loop can roll back partial sends.

### C. Destination-scoped deal-alert message store

`deal_alert_messages` is keyed by `discord_user_id` (single-column PK), which is
Discord-specific. Two options:

1. **Generalize** the table: add a `destination` column and make the PK
   `(destination, recipient_id)` (rename `discord_user_id` → `recipient_id`).
   Cleanest long-term; one store serves both providers.
2. **Add** a parallel `root_deal_alert_messages` table and mirror the four
   repository functions in `deal-alert-repository.ts`.

Recommendation: option 1 (generalize), with a migration that back-fills
`destination = "discord-dm"` for existing rows. The `DirectMessageSink` already
carries `channelId`/`messageId`, so the store only needs a stable
`recipient_id` + `destination`.

### D. Generalize deal-alert dispatch

In `src/services/discord-deal-notifier.ts`:

- `matchDealAlerts` hardcodes `findIdentitiesWithNotificationsEnabled("discord")`.
  Add a `provider` parameter (default `"discord"`) and thread it through.
- `dispatchDealAlerts` already accepts a `transport`; add a `destination`
  parameter (default `DISCORD_DM_DESTINATION`) that selects:
  - the identity provider (`"root"` vs `"discord"`),
  - the message-store key (from step C),
  - the transport (`rootDealAlertTransport` vs the Discord default).
- Rename nothing user-facing; keep `dispatchDealAlerts` as the single entry point
  called once per market-sync run (`market-sync-runner.ts`), dispatching to both
  destinations back-to-back, or to whichever `DEAL_ALERT_DM_DESTINATION` names.

### E. Root opt-in surface

The DB setter already exists; expose it:

- **In Root**: add a `/notify` (or `/wantlist notify`) command in
  `command-handlers.ts` that calls
  `setWantlistNotificationPreference(collectorId, "root", enabled)`, mirroring
  the Discord `/wantlist notify` flow in
  `src/services/discord-interactions/wantlist-commands.ts`.
- **In the web app** (optional parity): surface the same toggle under
  Settings > Linked Accounts for `provider = "root"`, if it exists for Discord.

### F. Channel-broadcast parity (decision)

Today Root uses a pull poller writing `sent_at`/`message_id` on the outbox row;
Discord uses the `notification_deliveries` table via `deliverMarketNotifications`.
These are two different delivery-tracking models for the same outbox.

Decide one of:

1. **Keep both** (lowest risk): Root stays pull-based; document that
   `sent_at`/`message_id` are Root-owned and `notification_deliveries` is the
   shared push-sink ledger. No code change.
2. **Unify on the sink** (cleaner): implement `RootMarketNotificationSink`
   (`destination = "root"`, `send` → `rootServer.community.channelMessages.create`),
   have `startMarketNotifier` call `deliverMarketNotifications(sink)` on its
   interval, and retire `getPendingNotifications`/`markNotificationsSent` from
   the Root poller. This makes Root and Discord share one code path and one
   delivery ledger.

Recommendation: option 2, but it is a behavior change to Root's delivery
tracking, so it should land as its own small PR after C/D.

### G. Configuration / environment

Add to `.env.example` (and the Root app's devhost config):

- `ROOT_BOT_MARKET_CHANNEL_ID` (already used, undocumented).
- `ROOT_BOT_POLL_INTERVAL_MS` (already used, undocumented).
- A Root DM credential/token if the SDK requires one (analogous to `DISCORD_BOT_TOKEN`).
- `DEAL_ALERT_DM_DESTINATION` — if generalized, allow `discord-dm`, `root-dm`,
  or both (comma-separated), replacing the current single hardcoded value.

### H. Tests + migration

- Unit tests for `rootDealAlertTransport` using a mocked SDK (mirror
  `src/services/__tests__/discord-deal-alerts.test.ts`'s fake transport).
- Dispatch test: Root identity with `wantlist_notifications_enabled = true`
  receives a rolling DM; unchanged list → no re-send; changed list → delete + send.
- Migration test for the `deal_alert_messages` generalization (C).
- If F-option-2 is chosen, add `RootMarketNotificationSink` delivery tests.

---

## 4. Open questions

1. Does `@rootsdk/server-bot` expose a DM/conversation API, and does it support
   message **delete** for rolling replacement? *(blocker for B/D)*
2. What is Root's real per-message character limit? (Currently assumed 2000.)
3. Should Root deal alerts go to DMs, the community channel, or both?
4. Do we keep Root's pull-based channel delivery, or migrate it onto the shared
   `ChannelDeliverySink` ledger? (F)
5. Is the opt-in toggle surfaced in the web app for Root, Root commands only, or both? (E)

## 5. Suggested sequencing

1. **A** — verify SDK DM capability (cheap, unblocks everything).
2. **B + C + D** — Root deal-alert DM parity (the main deliverable).
3. **E** — Root opt-in surface (needed before D is useful in production).
4. **F** — channel-broadcast unification (optional cleanup, separate PR).
5. **G + H** — config, tests, migrations ship alongside each step.
