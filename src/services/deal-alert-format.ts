import type { MarketCard } from "../db/repositories/marketplace-repository";
import { MESSAGE_MAX_LENGTH } from "../lib/market-vocabulary";
import { extractCollectorNumber } from "./market-notifications";
import {
  escapeLinkUrl,
  formatDateTimeInBrazil,
  isHttpsUrl,
  splitMessageContent,
} from "./market-notification-formatter";

export const DEAL_ALERT_MAX_LENGTH = MESSAGE_MAX_LENGTH;

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
 * Stable identity for a match snapshot (listing + price + deck/want source).
 */
export function matchKey(match: DealAlertMatch): string {
  const base = listingKey(match.listing);
  const deckPart = "deckId" in match.source ? match.source.deckId : match.source.kind;
  return `${base}:${match.listing.priceNumeric}:${deckPart}`;
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
 * Splits the rolling deal-alert message into chunks no longer than `maxLength`
 * characters (defaulting to Discord's safe 2000-character boundary), breaking
 * only on line boundaries.
 */
export function formatDealAlertChunks(
  matches: DealAlertMatch[],
  now: Date = new Date(),
  maxLength: number = DEAL_ALERT_MAX_LENGTH
): string[] {
  const full = formatDealAlertMessage(matches, now);
  if (!full) {
    return [];
  }
  return splitMessageContent(full, maxLength);
}

/**
 * Returns true when `currentKeys` differs from `lastKeysJson` (new listings appeared,
 * existing listings were removed, or price/deck shortages changed), or if `forceRefresh` is true.
 */
export function hasListingChanges(
  currentKeys: string[],
  lastKeysJson?: string | null,
  forceRefresh: boolean = false
): boolean {
  if (forceRefresh) {
    return true;
  }
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

  if (currentKeys.length !== lastKeys.length) {
    return true;
  }

  const seen = new Set(lastKeys);
  if (currentKeys.some((key) => !seen.has(key))) {
    return true;
  }

  const currentSet = new Set(currentKeys);
  if (lastKeys.some((key) => !currentSet.has(key))) {
    return true;
  }

  return false;
}

export const hasNewListings = hasListingChanges;
