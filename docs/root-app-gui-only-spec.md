# Root App GUI-Only Mode & In-App Channel Configuration

## Problem Statement

The Root Collector Assistant (`@ga/root-app`) currently operates as a hybrid of a graphical application and a legacy plain-text chat bot that intercepts messages starting with `/` (`/link`, `/register`, `/decks`, `/shortages`, `/collection`, `/wantlist`, `/notify`, `/setup`). Now that the in-channel GUI App provides full interactive parity for Collector Identity Link management, Deck and Shortage inspection, Personal Want management, and Collector Alert Subscription toggles, maintaining the chat command listener creates several issues:

1. **Redundant Surface Area**: Two parallel interfaces exist for identical Collector workflows, doubling maintenance and test overhead while exposing inferior text-command interactions in public channels.
2. **Chat Command Dependency for Community Setup**: Community administrators still have to type `/setup confirm` inside a text channel to provision the `GA Market` channel group and configure the Bot Channel (market broadcast dump channel). There is no way to select an existing channel or trigger provisioning from inside the GUI App.
3. **Unnecessary Message Event Subscription**: Listening to every `channelMessage.created` event across the community to parse `/` prefixes consumes resources when all interactions belong in the dedicated `#assistant` App channel.
4. **Hardcoded Static Text Debt**: Client components in `@ga/root-app` render user-facing English strings inline rather than resolving keys through the shared `@ga/contracts` compile-time typed i18n catalog (`en` and `pt-BR`).

## Solution

Transition the Root Collector Assistant to a strictly GUI-driven App backed by its headless server daemon (for RPC handling and background Notification Outbox / Collector Alert Subscription polling):

1. **In-App Community Admin Channel Configuration**: Add an administrator-only configuration card inside the Root App GUI that allows community owners and administrators (members with `communityManageApps` or `communityFullControl`) to:
   - View the currently configured market broadcast channel (dump channel).
   - Select any existing community text channel from a dropdown list to serve as the market broadcast channel.
   - Or one-click provision the default `GA Market` channel group (`#market` text channel and `#assistant` App channel) idempotently.
2. **Remove Legacy Chat Command Bot**: Delete the `channelMessage.created` listener and all `/command` text parsers and handlers (`/help`, `/link`, `/register`, `/decks`, `/shortages`, `/collection`, `/wantlist`, `/notify`, `/setup`), leaving the server daemon solely responsible for `AssistantRpcService`, `startMarketNotifier`, and `startDealAlertNotifier`.
3. **Shared i18n Catalog Integration**: Wire `@ga/root-app` client components (starting with the new Community Admin card and surrounding shell) to the shared `@ga/contracts` translation catalog (`en` and `pt-BR`) while preserving canonical English Game Nomenclature.

## User Stories

1. As a community administrator, I want to see a "Community Market Channel" configuration card inside the Root App GUI, so that I can configure where marketplace updates are posted without typing `/setup` in chat.
2. As a regular community member without `communityManageApps` or `communityFullControl` permissions, I want the admin configuration card to remain hidden in the GUI, so that I only see my personal Collector Assistant dashboard.
3. As a community administrator, I want to see a dropdown of all existing text channels across my community's channel groups inside the admin configuration card, so that I can pick an existing channel as the marketplace dump channel.
4. As a community administrator, I want to see which text channel is currently active as the marketplace dump channel when I open the GUI, so that I know where Market Listing updates are being delivered.
5. As a community administrator, I want to save a newly selected text channel as the marketplace dump channel with a single click, so that subsequent Market Sync notifications are routed to that channel immediately.
6. As a community administrator in a fresh community, I want a "Provision Default Channels" button inside the admin configuration card, so that the App automatically creates the `GA Market` channel group, `#market` broadcast channel, and `#assistant` App channel if they do not exist yet.
7. As a community administrator, I want channel provisioning from the GUI to be idempotent, so that clicking the provision action when channels are already configured does not create duplicate groups or channels.
8. As a non-admin user, if I attempt to invoke admin RPC methods (`GetAdminSettings`, `SetBroadcastChannel`, `ProvisionMarketChannels`), I want the server to reject the request with a `FORBIDDEN` error, so that community channel configuration cannot be tampered with.
9. As a community administrator, if I select a channel ID that no longer exists in the community, I want the server to return a clear validation error, so that the broadcast channel is never pointed at a broken destination.
10. As a Collector using the Root App, I want all `/` text messages in community chat to be ignored by the Collector Assistant, so that typing `/decks` or `/link` in public chat no longer triggers noisy bot replies.
11. As a Collector with an active Collector Alert Subscription, I want background deal alerts and public marketplace broadcast notifications to continue arriving on schedule after the chat command handlers are removed, so that notification delivery is uninterrupted.
12. As a developer, I want all user-facing strings in the new admin configuration UI to be defined in both `en` and `pt-BR` dictionaries in `@ga/contracts`, so that compile-time i18n parity is enforced.
13. As a developer, I want unused `@rootsdk/server-bot` references replaced by `@rootsdk/server-app`, so that the Root App relies on a single unified platform SDK package.

## Implementation Decisions

### 1. Protobuf & RPC Contract Extensions
Extend `AssistantService` in the Root protobuf schema with administrator capability and channel management RPCs:

```protobuf
message CommunityChannelOption {
  string id = 1;
  string name = 2;
  string group_name = 3;
}

message AdminSettingsResponse {
  bool is_admin = 1;
  string broadcast_channel_id = 2;
  string broadcast_channel_name = 3;
  repeated CommunityChannelOption text_channels = 4;
}

message SetBroadcastChannelRequest {
  string channel_id = 1;
}

message SetBroadcastChannelResponse {
  bool success = 1;
  string broadcast_channel_id = 2;
  string broadcast_channel_name = 3;
  string error = 4;
}

message ProvisionMarketChannelsResponse {
  bool success = 1;
  string broadcast_channel_id = 2;
  string broadcast_channel_name = 3;
  string assistant_channel_id = 4;
  string error = 5;
}
```

- `StatusResponse` gains `bool is_admin = 8;` so the initial `GetStatus` call informs the client whether to render and fetch the admin configuration card without an extra round-trip for non-admin members.
- `AssistantService` adds three RPC methods:
  - `GetAdminSettings(rootsdk.Void) returns (AdminSettingsResponse)`
  - `SetBroadcastChannel(SetBroadcastChannelRequest) returns (SetBroadcastChannelResponse)`
  - `ProvisionMarketChannels(rootsdk.Void) returns (ProvisionMarketChannelsResponse)`

### 2. Community Admin Authorization & Channel Discovery
- Extract community administrator verification into a dedicated pure module that checks whether the calling `client.userId` is the community `ownerUserId` or holds any role (including `EveryoneRole`) with `communityManageApps` or `communityFullControl`.
- To enumerate selectable text channels for `GetAdminSettings`:
  1. Call `rootServer.community.channelGroups.list()` to retrieve all channel groups in the community.
  2. For each group, call `rootServer.community.channels.list({ channelGroupId: group.id })` and filter for `channel.channelType === ChannelType.Text`.
  3. Map each text channel to `{ id, name, groupName }` so the admin dropdown can display `#channel-name (Group Name)`.
- `SetBroadcastChannel` verifies `isCommunityAdmin(userId)`, confirms the target `channelId` exists among the community's text channels (or via `channels.get`), persists it via `config.setBroadcastChannelId(channelId)`, and returns the updated channel metadata.
- `ProvisionMarketChannels` verifies `isCommunityAdmin(userId)`, invokes `provisionCommunityChannels`, and returns the resulting `broadcastChannelId` and `assistantChannelId`.

### 3. Client Admin Settings Card & i18n
- Create a dedicated `CommunityAdminCard` component rendered inside `App` only when `status.isAdmin` is `true`.
- When mounted, `CommunityAdminCard` fetches `client.getAdminSettings()` to populate the list of available text channels and highlight the active broadcast dump channel.
- Provides:
  - A `<select>` dropdown of community text channels (`#name (Group)`) + a "Save Channel" button that calls `client.setBroadcastChannel({ channelId })`.
  - A "Provision Default Channels" action button that calls `client.provisionMarketChannels()` to auto-create the `GA Market` group and `#market` channel if needed, then refreshes the channel list.
- All static labels, descriptions, button captions, empty states, and error messages for the admin configuration card are added to `@ga/contracts` (`en` and `pt-BR`) and consumed via the translation helper.

### 4. Removal of Chat Command Bot Layer
- Remove `registerRootCommandHandlers` from server startup (`main.ts`).
- Delete the chat command dispatcher (`command-handlers.ts`) and all command handler modules (`command-auth.ts`, `command-collection.ts`, `command-decks.ts`, `command-help.ts`, `command-notify.ts`, `command-shortages.ts`, `command-wantlist.ts`) along with their dedicated unit test files (`command-handlers.test.ts`, `command-parity.test.ts`).
- Update warning messages in `market-notifier.ts` and `channel-diagnostics.ts` to reference configuring the broadcast channel in the Assistant App GUI rather than running `/setup`.
- Replace remaining `@rootsdk/server-bot` imports/mocks in tests and source with `@rootsdk/server-app` and remove `@rootsdk/server-bot` from `package.json`.

## Testing Decisions

### What Makes a Good Test
Tests must verify observable behavior through public seams (RPC service methods, React component DOM output and user interactions, and notifier poll execution) without asserting internal implementation details.

### Seams & Modules Under Test
1. **RPC Service Seam (`AssistantRpcService`)**:
   - Verify `getStatus` includes `isAdmin: true` for community owners/admins and `isAdmin: false` for regular members.
   - Verify `getAdminSettings` returns available text channels across groups and current `broadcastChannelId` for admins, and returns `isAdmin: false` / empty list for non-admins.
   - Verify `setBroadcastChannel` persists the selected channel ID to community config when called by an admin with a valid text channel, rejects non-admins with `FORBIDDEN`, and rejects unknown/non-text channels with `CHANNEL_NOT_FOUND`.
   - Verify `provisionMarketChannels` provisions the channel group and `#market` / `#assistant` channels idempotently for admins and rejects non-admins with `FORBIDDEN`.
2. **Client UI Seam (`CommunityAdminCard` & `App`)**:
   - Verify `CommunityAdminCard` is not rendered when `status.isAdmin` is `false`.
   - Verify `CommunityAdminCard` renders the active broadcast channel, populates the channel selector dropdown, invokes `setBroadcastChannel` when a new channel is saved, and invokes `provisionMarketChannels` when the provision button is clicked.
   - Verify i18n dictionary completeness (`en` and `pt-BR` parity) via the shared `@ga/contracts` test suite.
3. **Startup & Notifier Seam (`main.ts` & `market-notifier.ts`)**:
   - Verify `runMarketNotificationPoll` delivers pending chunks to the channel ID configured via `SetBroadcastChannel` and logs an updated GUI configuration warning when no channel is configured.

### Prior Art
- Server RPC tests: `apps/ga-tcg-root-app/src/__tests__/assistant-rpc-service.test.ts`
- Provisioning tests: `apps/ga-tcg-root-app/src/__tests__/setup-provisioning.test.ts`
- Client component tests: `apps/ga-tcg-root-app/client/src/__tests__/DealAlertCard.test.tsx` and `App.test.tsx`

## Out of Scope

- Removing or modifying the Discord slash command integration (`apps/ga-tcg-discord-app` and `/api/discord/interactions`), which remains active for Discord communities.
- Modifying how personal Deal Alert channels (`deal-alert-notifier.ts`) are created or cleaned up when a Collector toggles notifications in `DealAlertCard`.
- Adding a full Collection Card Browser inside the Root App GUI (Collectors continue to use the GA Binder Web App for full collection browsing).

## Further Notes

- Existing communities that previously ran `/setup confirm` retain their stored `market.broadcastChannelId` and `dealAlert.sectionId.v2` keys in `rootServer.dataStore.appData` with zero migration required.
- All files must adhere to ADR 0012 (< 400 lines per source file, strict separation of responsibilities).
