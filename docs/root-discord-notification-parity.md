# Root ↔ Discord Notification Parity

Status: **Implemented** (spec #136, tickets #137–#141) · Last updated: 2026-10-24

This document records how Root deal alerts map onto Discord's behavior, the
architecture chosen because Root has no DM API, and the one deferred
unification.

---

## 1. What Root offers (and what it doesn't)

- **No direct-message API.** The server SDK exposes no private/conversation
  surface. There is no `directMessage`, `conversation`, or `userMessage`
  primitive.
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

## 2. The delivered design

Two kinds of channel, plus a notification:

1. **Shared market channel** — unchanged. The Root bot polls
   `market_notifications` and posts every store update
   (`ROOT_BOT_MARKET_CHANNEL_ID`). Everyone sees the same stream.
2. **Private per-user deal-alert channel** — new. One channel per opted-in
   collector, created lazily under a dedicated bot-only channel section
   (`ROOT_DEAL_ALERT_SECTION_ID`). Access rules deny `channelView` to the
   base role and grant it to the recipient (plus create/history), so other
   members cannot see it. The channel holds the **full rolling list** of that
   collector's wantlist + deck shortages that are for sale; the message is
   replaced only when the list changes.
3. **In-app notification ping** — new. When the list changes, the Root bot also
   sends a short notification. If there are hard shortages it names up to three
   (`Cards: A, B and C for sale and more!`); otherwise it says new wantlist
   cards are for sale. It deep-links to the channel when supported and names
   the channel otherwise.

Change-only semantics are shared with Discord: `hasListingChanges` compares the
match keys, so an unchanged list produces neither a channel update nor a
notification.

## 3. Architecture: one matcher, two delivery processes

Root delivery must run **inside the Root bot**, because `@rootsdk/server-bot`
is only available there. Discord delivery continues to run in the market-sync
daemon. Both use the same shared code:

- `matchDealAlerts(listings, database, provider)` resolves identities per
  provider (`discord` / `root`).
- `dispatchDealAlerts(database, transport, now, { destination })` owns
  change-detection, rolling replacement, the state store, and the optional
  notification ping.
- `deal_alert_messages` is keyed by `(destination, recipient_id)`, so one table
  serves `discord-dm` and `root-alert`. Legacy Discord rows are back-filled with
  `destination = 'discord-dm'` on migration.

The daemon dispatches `discord-dm`; the Root bot dispatches `root-alert` on its
own timer (`startDealAlertNotifier`). They share the matcher and the state, so
content never drifts.

## 4. Opt-in

`/notify on|off` in Root sets
`collector_identities.wantlist_notifications_enabled` for the `root` identity
via the existing preference setter. Enabling provisions the channel
immediately; disabling deletes the channel and clears the stored state.

## 5. Configuration

| Variable | Purpose |
|---|---|
| `DEAL_ALERT_DM_DESTINATION` | Comma-separated destinations (`discord-dm,root-alert`). Defaults to both. |
| `DISCORD_BOT_TOKEN` | Opens/reuses Discord DMs. |
| `ROOT_DEAL_ALERT_SECTION_ID` | Bot-only channel section holding per-user channels. Unset ⇒ Root deal alerts disabled. |
| `ROOT_DEAL_ALERT_INTERVAL_MS` | Root dispatch interval (default 300000). |
| `ROOT_BOT_MARKET_CHANNEL_ID` | Shared broadcast channel (already existed). |

## 6. Verification caveats

These were flagged during design and should be confirmed in a real devhost:

- Whether `channelView: false` **hides** a channel from the member's channel list
  or only blocks opening it. The wording implies hiding; verify.
- The channel's **default permission** when `useChannelGroupPermission: false` —
  the base-role `channelView: false` overlay is what makes it private.
- Whether channel/group creation needs a **manifest permission** granted by the
  community admin (notifications are documented as needing none).
- Whether a notification's `relativeUrl` can target a Root channel. It is
  documented as resolving against the app's own router, so the fallback is to
  name the channel in the notification text.

## 7. Deferred: channel-broadcast unification

The shared broadcast still uses its original pull-based poller and its
`sent_at` / `message_id` ledger, while Discord uses `notification_deliveries`
through `ChannelDeliverySink`. We chose to leave it as-is: it works, and Root is
pull-based by nature. A future change can introduce a
`RootMarketNotificationSink` and move the poller onto
`deliverMarketNotifications`, retiring `sent_at` / `message_id`.

## 8. Out of scope

- A full Root client app (UI, onboarding overhaul, deep-link router).
- A Root DM API (does not exist).
- Web-app Settings toggle for Root opt-in (the Root command is the surface).
- Changes to the Discord deal-alert path.
