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

const KNOWN_DESTINATIONS: readonly Destination[] = [
  ROOT_DESTINATION,
  DISCORD_DESTINATION,
  DISCORD_DM_DESTINATION,
  ROOT_ALERT_DESTINATION,
];

/**
 * Reads the comma-separated `DEAL_ALERT_DM_DESTINATION` setting (for example
 * `discord-dm,root-alert`). Defaults to both destinations; each delivery
 * process still requires its own credentials (Discord webhook/bot token for
 * Discord, `ROOT_DEAL_ALERT_SECTION_ID` for Root) before it actually sends.
 */
export function readDealAlertDestinations(
  env: Record<string, string | undefined> = process.env
): Destination[] {
  const raw =
    env.DEAL_ALERT_DM_DESTINATION ??
    `${DISCORD_DM_DESTINATION},${ROOT_ALERT_DESTINATION}`;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const parsed = values.filter((value): value is Destination =>
    (KNOWN_DESTINATIONS as readonly string[]).includes(value)
  );
  const unknown = values.filter(
    (value) => !(KNOWN_DESTINATIONS as readonly string[]).includes(value)
  );

  if (unknown.length > 0) {
    console.warn(
      `[deal-alerts] Ignoring unknown DEAL_ALERT_DM_DESTINATION values: ${unknown.join(", ")}`
    );
  }

  return parsed.length > 0 ? parsed : [DISCORD_DM_DESTINATION];
}

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
 * Root's MessageGrpcService/Create rejects messages larger than ~1 KB with a
 * gRPC UNAVAILABLE (empty response) rather than a validation error. The limit
 * is measured in UTF-8 bytes, so keep Root messages under this byte budget.
 * (A 994-char deal-alert chunk at 1014 bytes posts fine; market chunks at
 * 1028–1048 bytes fail.)
 */
export const ROOT_MESSAGE_MAX_BYTES = 900;

/**
 * Canonical external Listing identity. Parsers may keep their legacy field
 * names during the expand phase; new callers should read these.
 */
export interface ExternalListingIdentity {
  itemId: string | null;
  rawName: string;
}
