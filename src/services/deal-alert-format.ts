import type { MarketCard } from "../db/repositories/marketplace-repository";
import { type SupportedLocale, getDictionary } from "@ga/contracts";
import { MESSAGE_MAX_LENGTH } from "../lib/market-vocabulary";
import { extractCollectorNumber } from "./market-notifications";
import {
  escapeLinkUrl,
  formatDateTimeInBrazil,
  isHttpsUrl,
  splitMessageContent,
  splitMessageContentByBytes,
} from "./market-notification-message";

export type DealAlertSource =
  | { kind: "personal-want"; desiredQuantity: number }
  | { kind: "hard"; deckId: string; deckName: string; missingQuantity: number }
  | { kind: "shared"; deckId: string; deckName: string; sharedQuantity: number };

export interface DealAlertMatch {
  collectorId: string;
  /** The platform user id to deliver to (Discord snowflake or Root user id). */
  recipientId: string;
  listing: MarketCard;
  source: DealAlertSource;
}

const WANTLIST_GROUP_TITLE = "Wantlist";

function formatListingCollection(listing: MarketCard): string {
  const collectorNumber = extractCollectorNumber(listing.rawName, listing.itemId);
  return collectorNumber ? `${listing.setPrefix} ${collectorNumber}` : listing.setPrefix;
}

function formatDealAlertCardLine(
  listing: MarketCard,
  ball: string,
  rootMode = false
): string {
  const url = listing.productUrl || listing.vendorUrl;
  const cardName = isHttpsUrl(url)
    ? rootMode
      ? `[${listing.cardName}](${escapeLinkUrl(url)})`
      : `[${listing.cardName}](<${escapeLinkUrl(url)}>)`
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
  now: Date = new Date(),
  rootMode = false,
  locale: SupportedLocale = "en"
): string {
  const dict = getDictionary(locale).rootApp.notifications;
  const wantlistTitle = dict.wantlistGroupTitle;
  const groups = new Map<
    string,
    { title: string; isWantlist: boolean; lines: string[] }
  >();

  for (const match of matches) {
    const { listing, source } = match;
    const groupKey =
      source.kind === "personal-want" ? "wantlist" : `deck:${source.deckId}`;
    const title =
      source.kind === "personal-want" ? wantlistTitle : source.deckName;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        title,
        isWantlist: source.kind === "personal-want",
        lines: [],
      });
    }
    groups
      .get(groupKey)!
      .lines.push(formatDealAlertCardLine(listing, severityBall(source), rootMode));
  }

  const sections = [...groups.values()]
    .sort((a, b) => {
      if (a.isWantlist !== b.isWantlist) return a.isWantlist ? 1 : -1;
      return a.title.localeCompare(b.title);
    })
    .map((group) => `**${group.title}**\n${group.lines.join("\n")}`);

  return [`${dict.lastUpdatePrefix} ${formatDateTimeInBrazil(now)}`, ...sections].join("\n\n");
}

/**
 * Splits the rolling deal-alert message into chunks no longer than `maxLength`
 * characters (defaulting to Discord's safe 2000-character boundary), breaking
 * only on line boundaries. When `options.maxBytes` is set (Root), chunks are
 * instead capped by UTF-8 byte length; `options.rootMode` uses plain `[name](url)`
 * links instead of Discord's `<…>`-wrapped form.
 */
export function formatDealAlertChunks(
  matches: DealAlertMatch[],
  now: Date = new Date(),
  maxLength: number = MESSAGE_MAX_LENGTH,
  options: { rootMode?: boolean; maxBytes?: number; locale?: SupportedLocale } = {}
): string[] {
  const full = formatDealAlertMessage(
    matches,
    now,
    options.rootMode,
    options.locale ?? "en"
  );
  if (!full) {
    return [];
  }
  if (options.maxBytes !== undefined) {
    return splitMessageContentByBytes(full, options.maxBytes);
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

export interface DealAlertNotificationSummary {
  title: string;
  description: string;
}

const NOTIFICATION_TITLE_MAX = 50;
const NOTIFICATION_DESCRIPTION_MAX = 150;

function truncateSummary(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Builds the short summary used for a Root in-app notification (title ≤ 50,
 * description ≤ 150). Names up to three hard-shortage cards when a few are
 * available; otherwise falls back to a generic "new cards from your wantlist"
 * message.
 */
export function formatDealAlertNotificationSummary(
  matches: DealAlertMatch[],
  locale: SupportedLocale = "en"
): DealAlertNotificationSummary {
  const dict = getDictionary(locale).rootApp.notifications;
  const uniqueCards = [
    ...new Set(matches.map((match) => match.listing.cardName).filter(Boolean)),
  ];
  const hardCards = [
    ...new Set(
      matches
        .filter((match) => match.source.kind === "hard")
        .map((match) => match.listing.cardName)
        .filter(Boolean)
    ),
  ];

  const count = uniqueCards.length;
  const rawTitle =
    count === 1
      ? dict.summaryTitleSingle
      : dict.summaryTitlePlural.replace("{count}", String(count));
  const title = truncateSummary(rawTitle, NOTIFICATION_TITLE_MAX);

  let description: string;
  if (hardCards.length > 0) {
    const shown = hardCards.slice(0, 3);
    const list =
      shown.length === 1
        ? shown[0]
        : `${shown.slice(0, -1).join(", ")}${dict.summaryConjunction}${shown[shown.length - 1]}`;
    const suffix = hardCards.length > shown.length ? dict.summaryMoreSuffix : "";
    const template = shown.length === 1 ? dict.summaryHardSingle : dict.summaryHardPlural;
    description = template.replace("{list}", list).replace("{suffix}", suffix);
  } else {
    description = dict.summaryWantlistOnly;
  }

  return {
    title,
    description: truncateSummary(description, NOTIFICATION_DESCRIPTION_MAX),
  };
}
