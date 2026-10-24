import { findIdentitiesWithNotificationsEnabled } from "../db/repositories/assistant-repository";
import {
  deleteDealAlertMessage,
  getDealAlertMessage,
  listAllDealAlertMessages,
  upsertDealAlertMessage,
} from "../db/repositories/deal-alert-repository";
import {
  listPersonalWants,
  type PersonalWantItem,
} from "../db/repositories/personal-wants-repository";
import {
  getMarketCards,
  type MarketCard,
  type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import { getDeckPartitionedWantlist } from "./collector-assistant";
import {
  formatDealAlertChunks,
  formatDealAlertMessage,
  formatDealAlertNotificationSummary,
  hasListingChanges,
  hasNewListings,
  listingKey,
  matchKey,
  type DealAlertMatch,
  type DealAlertNotificationSummary,
  type DealAlertSource,
} from "./deal-alert-format";
import {
  DISCORD_DM_DESTINATION,
  MESSAGE_MAX_LENGTH,
  ROOT_ALERT_DESTINATION,
  type Destination,
} from "../lib/market-vocabulary";
import { splitMessageContent } from "./market-notification-message";
import type { DirectMessageSink, DirectMessageRef } from "./market-notification-sink";
import type { AssistantWantlistResponse } from "@ga/contracts";
import type { DiscordEmbed } from "./discord-interactions/types";
import {
  parseMessageIds,
  sendDiscordDirectContent,
  deleteDiscordDirectMessage,
  sendDiscordDirectMessage,
  type DealAlertMessageRef,
} from "./discord-dm-client";

export { formatDealAlertMessage, formatDealAlertChunks };
export type { DealAlertMatch, DealAlertSource, DealAlertMessageRef };
export {
  parseMessageIds,
  sendDiscordDirectContent,
  deleteDiscordDirectMessage,
  sendDiscordDirectMessage,
};

function resolveDealAlertSource(
  listing: MarketCard,
  personalWants: PersonalWantItem[],
  wantlist: AssistantWantlistResponse
): DealAlertSource | null {
  const matchingWant = personalWants.find((w) => {
    if (w.cardSlug !== listing.cardSlug) return false;
    if (w.editionId && listing.editionId && w.editionId !== listing.editionId) return false;
    if (w.foil !== null && w.foil !== listing.isFoil) return false;
    if (w.targetMaxPrice !== null && listing.priceNumeric > w.targetMaxPrice) return false;
    return true;
  });

  if (matchingWant) {
    return { kind: "personal-want", desiredQuantity: matchingWant.desiredQuantity };
  }

  for (const deck of wantlist.decks) {
    const hard = deck.hardShortages.find((h) => h.cardSlug === listing.cardSlug);
    if (hard) {
      return { kind: "hard", deckId: deck.deckId, deckName: deck.deckName, missingQuantity: hard.missingQuantity };
    }
    const shared = deck.sharedShortages.find((s) => s.cardSlug === listing.cardSlug);
    if (shared) {
      return { kind: "shared", deckId: deck.deckId, deckName: deck.deckName, sharedQuantity: shared.sharedQuantity };
    }
  }

  return null;
}

/**
 * Matches market listings against every enabled collector's wantlists and deck
 * shortages for one provider. Returns all current matches; deduplication and
 * message lifecycle are handled by `dispatchDealAlerts`.
 */
export async function matchDealAlerts(
  listings: MarketCard[],
  database?: unknown,
  provider: "discord" | "root" = "discord",
  recipientIds?: ReadonlySet<string>
): Promise<DealAlertMatch[]> {
  const identities = (
    await findIdentitiesWithNotificationsEnabled(provider, database as any)
  ).filter(
    (identity) => !recipientIds || recipientIds.has(identity.providerUserId)
  );

  const matches: DealAlertMatch[] = [];

  for (const identity of identities) {
    const collectorId = identity.collectorId;

    const [personalWants, wantlist] = await Promise.all([
      listPersonalWants(collectorId, database as any),
      getDeckPartitionedWantlist(collectorId, undefined, database as any),
    ]);

    for (const listing of listings) {
      const source = resolveDealAlertSource(listing, personalWants, wantlist);
      if (source) {
        matches.push({
          collectorId,
          recipientId: identity.providerUserId,
          listing,
          source,
        });
      }
    }
  }

  return matches;
}

export interface DealAlertTransport {
  send: (
    recipientId: string,
    content: string,
    channelId?: string
  ) => Promise<DealAlertMessageRef | null>;
  delete: (ref: DealAlertMessageRef) => Promise<void>;
  /** Optional notification ping for destinations that support non-message notifications. */
  notify?: (
    recipientId: string,
    summary: DealAlertNotificationSummary
  ) => Promise<void>;
}

const defaultDealAlertTransport: DealAlertTransport = {
  send: async (discordUserId, content) => {
    return sendDiscordDirectContent(discordUserId, content);
  },
  delete: async (ref) => {
    await deleteDiscordDirectMessage(ref.channelId, ref.messageId);
  },
};

/**
 * Adapts a unified `DirectMessageSink` into the transport interface expected
 * by `dispatchDealAlerts`.
 */
export function adaptDirectMessageSink(sink: DirectMessageSink): DealAlertTransport {
  return {
    send: async (recipientId, content, channelId) => {
      const ref = await sink.send(recipientId, content, channelId);
      if (!ref) return null;
      return { channelId: ref.channelId, messageId: ref.messageId };
    },
    delete: async (ref) => {
      await sink.delete(ref);
    },
    notify: sink.notify ? async (recipientId, summary) => sink.notify!(recipientId, summary) : undefined,
  };
}

export interface DealAlertDispatchResult {
  matched: number;
  sent: number;
}

export interface DispatchDealAlertsOptions {
  forceRefresh?: boolean;
  /** Which platform destination to dispatch to (default: Discord DMs). */
  destination?: Destination;
  /**
   * Recipients who are still opted in but may have no current matches. Their
   * stored rolling message/state is kept rather than cleaned up, so a channel
   * created at opt-in is not deleted before the first match arrives.
   */
  keepRecipients?: ReadonlySet<string>;
}

function providerForDestination(destination: Destination): "discord" | "root" {
  return destination === ROOT_ALERT_DESTINATION ? "root" : "discord";
}

/**
 * Fetches every in-stock marketplace listing, matches them against enabled
 * collectors' wantlists and deck shortages, and maintains a single rolling
 * message per recipient on the chosen destination. Stale snapshots are deleted
 * and updated snapshots sent whenever listing matches change (or forceRefresh is
 * requested); a destination that supports it also receives one notification
 * ping per changed recipient.
 */
export async function dispatchDealAlerts(
  database?: MarketplaceDatabase,
  transport: DealAlertTransport = defaultDealAlertTransport,
  now: Date = new Date(),
  options: DispatchDealAlertsOptions = {}
): Promise<DealAlertDispatchResult> {
  const destination = options.destination ?? DISCORD_DM_DESTINATION;
  const provider = providerForDestination(destination);

  const listings = await getMarketCards({ inStockOnly: true }, database);
  const matches = await matchDealAlerts(listings, database, provider);

  const byRecipient = new Map<string, DealAlertMatch[]>();
  for (const match of matches) {
    const list = byRecipient.get(match.recipientId);
    if (list) list.push(match);
    else byRecipient.set(match.recipientId, [match]);
  }

  // Clean up stale alerts for recipients with no current matches on this destination.
  const storedMessages = (await listAllDealAlertMessages(database)).filter(
    (row) => row.destination === destination
  );
  for (const stored of storedMessages) {
    if (
      !byRecipient.has(stored.recipientId) &&
      !options.keepRecipients?.has(stored.recipientId)
    ) {
      for (const oldId of parseMessageIds(stored.messageId)) {
        await transport.delete({ channelId: stored.channelId, messageId: oldId });
      }
      await deleteDealAlertMessage(destination, stored.recipientId, database);
    }
  }

  let sent = 0;
  for (const [recipientId, userMatches] of byRecipient) {
    const currentKeys = userMatches.map(matchKey);
    const stored = await getDealAlertMessage(destination, recipientId, database);

    if (!hasListingChanges(currentKeys, stored?.lastListingKeys, options.forceRefresh)) {
      continue;
    }

    const chunks = formatDealAlertChunks(userMatches, now);
    const sentRefs: DealAlertMessageRef[] = [];
    let channelId = stored?.channelId;
    for (const chunk of chunks) {
      const ref = await transport.send(recipientId, chunk, channelId);
      if (ref) {
        sentRefs.push(ref);
        channelId = ref.channelId;
      } else {
        break;
      }
    }

    if (sentRefs.length !== chunks.length) {
      console.warn(
        `[deal-alert] Failed to send all chunks to ${destination}:${recipientId} (${sentRefs.length}/${chunks.length} sent)`
      );
      for (const partial of sentRefs) await transport.delete(partial);
      continue;
    }

    // Best-effort delete of previous message chunks after the new ones succeed
    if (stored?.channelId && stored?.messageId) {
      for (const oldId of parseMessageIds(stored.messageId)) {
        await transport.delete({ channelId: stored.channelId, messageId: oldId });
      }
    }

    await upsertDealAlertMessage(
      {
        destination,
        recipientId,
        channelId: sentRefs[0].channelId,
        messageId: sentRefs.map((r) => r.messageId).join(","),
        lastListingKeys: JSON.stringify(currentKeys),
        updatedAt: now,
      },
      database
    );

    if (transport.notify) {
      try {
        await transport.notify(
          recipientId,
          formatDealAlertNotificationSummary(userMatches)
        );
      } catch (err) {
        console.warn(
          `[deal-alert] Failed to notify ${destination}:${recipientId}`,
          err
        );
      }
    }

    sent++;
  }

  return { matched: matches.length, sent };
}
