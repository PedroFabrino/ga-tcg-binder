/**
 * Shared vocabulary for notifications and marketplaces.
 *
 * One name per concept, used across notification delivery, market sync, and
 * the pipeline. `root-alert` is the Root deal-alert destination (a private
 * per-user channel plus an in-app notification ping); Root has no DM API.
 */

/** A named notification destination recorded in `notification_deliveries`. */
export type Destination = "root" | "discord" | "discord-dm" | "root-alert";

export const ROOT_DESTINATION: Destination = "root";
export const DISCORD_DESTINATION: Destination = "discord";
export const DISCORD_DM_DESTINATION: Destination = "discord-dm";
export const ROOT_ALERT_DESTINATION: Destination = "root-alert";

/** A marketplace platform crawled by Market Sync. */
export type MarketplacePlatform = "myp" | "liga_store" | "lootcards";

export const MARKETPLACE_PLATFORMS: readonly MarketplacePlatform[] = [
  "myp",
  "liga_store",
  "lootcards",
];

/** One character budget shared by every notification destination. */
export const MESSAGE_MAX_LENGTH = 2000;

/**
 * Canonical external Listing identity. Parsers may keep their legacy field
 * names during the expand phase; new callers should read these.
 */
export interface ExternalListingIdentity {
  itemId: string | null;
  rawName: string;
}
