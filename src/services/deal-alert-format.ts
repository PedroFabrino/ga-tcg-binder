import type { MarketCard } from "../db/repositories/marketplace-repository";
import { extractCollectorNumber } from "./market-notifications";
import {
  escapeLinkUrl,
  formatDateTimeInBrazil,
  isHttpsUrl,
} from "./market-notification-formatter";

export type DealAlertSource =
  | { kind: "personal-want"; desiredQuantity: number }
  | { kind: "hard"; deckId: string; deckName: string; missingQuantity: number }
  | { kind: "shared"; deckId: string; deckName: string; sharedQuantity: number };

export interface DealAlertMatch {
  collectorId: string;
  discordUserId: string;
  listing: MarketCard;
  source: DealAlertSource;
}

const WANTLIST_GROUP_TITLE = "Wantlist";

function formatListingCollection(listing: MarketCard): string {
  const collectorNumber = extractCollectorNumber(listing.rawName, listing.itemId);
  return collectorNumber ? `${listing.setPrefix} ${collectorNumber}` : listing.setPrefix;
}

function formatDealAlertCardLine(listing: MarketCard, ball: string): string {
  const url = listing.productUrl || listing.vendorUrl;
  const cardName = isHttpsUrl(url)
    ? `[${listing.cardName}](<${escapeLinkUrl(url)}>)`
    : listing.cardName;

  return `${ball} ${cardName} - ${formatListingCollection(listing)} - ${listing.price}`;
}

function severityBall(source: DealAlertSource): string {
  switch (source.kind) {
    case "hard":
      return "🔴";
    case "shared":
      return "🟡";
    case "personal-want":
      return "🎯";
  }
}

/**
 * Stable identity for a marketplace listing, used to detect whether a snapshot
 * contains anything new since the last update.
 */
export function listingKey(listing: MarketCard): string {
  return listing.itemId ? `${listing.storeId}:${listing.itemId}` : listing.id;
}

/**
 * Builds the single rolling deal-alert message for one collector: one section
 * per Deck (🔴 hard / 🟡 shared) plus a final Wantlist section (🎯), prefixed
 * with the date/time of the latest update.
 */
export function formatDealAlertMessage(
  matches: DealAlertMatch[],
  now: Date = new Date()
): string {
  const groups = new Map<
    string,
    { title: string; isWantlist: boolean; lines: string[] }
  >();

  for (const match of matches) {
    const { listing, source } = match;
    const groupKey =
      source.kind === "personal-want" ? "wantlist" : `deck:${source.deckId}`;
    const title =
      source.kind === "personal-want" ? WANTLIST_GROUP_TITLE : source.deckName;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        title,
        isWantlist: source.kind === "personal-want",
        lines: [],
      });
    }
    groups
      .get(groupKey)!
      .lines.push(formatDealAlertCardLine(listing, severityBall(source)));
  }

  const sections = [...groups.values()]
    .sort((a, b) => {
      if (a.isWantlist !== b.isWantlist) return a.isWantlist ? 1 : -1;
      return a.title.localeCompare(b.title);
    })
    .map((group) => `**${group.title}**\n${group.lines.join("\n")}`);

  return [`🕒 Last update: ${formatDateTimeInBrazil(now)}`, ...sections].join("\n\n");
}

/**
 * Returns true when `currentKeys` contains at least one listing key that was
 * not part of the previously sent snapshot.
 */
export function hasNewListings(
  currentKeys: string[],
  lastKeysJson?: string | null
): boolean {
  if (!lastKeysJson) {
    return currentKeys.length > 0;
  }

  let lastKeys: string[] = [];
  try {
    const parsed = JSON.parse(lastKeysJson);
    if (Array.isArray(parsed)) {
      lastKeys = parsed.filter((key): key is string => typeof key === "string");
    }
  } catch {
    lastKeys = [];
  }

  const seen = new Set(lastKeys);
  return currentKeys.some((key) => !seen.has(key));
}
