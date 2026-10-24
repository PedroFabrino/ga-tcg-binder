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
  hasListingChanges,
  hasNewListings,
  listingKey,
  matchKey,
  type DealAlertMatch,
  type DealAlertSource,
} from "./deal-alert-format";
import { MESSAGE_MAX_LENGTH } from "../lib/market-vocabulary";
import { splitMessageContent } from "./market-notification-message";
import type { AssistantWantlistResponse } from "@ga/contracts";
import type { DiscordEmbed } from "./discord-interactions/types";

export { formatDealAlertMessage, formatDealAlertChunks };
export type { DealAlertMatch, DealAlertSource };

/**
 * Normalizes message ID strings stored in the database. Supports single IDs,
 * comma-separated ID lists, and JSON-serialized string arrays.
 */
export function parseMessageIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        );
      }
    } catch {
      // fallback to comma separation below
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
 * shortages. Returns all current matches; deduplication and message lifecycle
 * are handled by `dispatchDealAlerts`.
 */
export async function matchDealAlerts(
  listings: MarketCard[],
  database?: unknown
): Promise<DealAlertMatch[]> {
  const identities = await findIdentitiesWithNotificationsEnabled("discord", database as any);

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
          discordUserId: identity.providerUserId,
          listing,
          source,
        });
      }
    }
  }

  return matches;
}

export interface DealAlertDispatchResult {
  matched: number;
  sent: number;
}

export interface DealAlertMessageRef {
  channelId: string;
  messageId: string;
}

export interface DealAlertTransport {
  send(discordUserId: string, content: string): Promise<DealAlertMessageRef | null>;
  delete(ref: DealAlertMessageRef): Promise<void>;
}

const defaultDealAlertTransport: DealAlertTransport = {
  send: (discordUserId, content) => sendDiscordDirectContent(discordUserId, content),
  delete: (ref) => deleteDiscordDirectMessage(ref.channelId, ref.messageId),
};

export interface DispatchDealAlertsOptions {
  forceRefresh?: boolean;
}

/**
 * Fetches every in-stock marketplace listing, matches them against enabled
 * collectors' wantlists and deck shortages, and maintains a single rolling DM
 * per collector. Stale snapshots are deleted and updated snapshots sent
 * whenever listing matches change or forceRefresh is requested.
 */
export async function dispatchDealAlerts(
  database?: MarketplaceDatabase,
  transport: DealAlertTransport = defaultDealAlertTransport,
  now: Date = new Date(),
  options: DispatchDealAlertsOptions = {}
): Promise<DealAlertDispatchResult> {
  const listings = await getMarketCards({ inStockOnly: true }, database);
  const matches = await matchDealAlerts(listings, database);

  const byUser = new Map<string, DealAlertMatch[]>();
  for (const match of matches) {
    const list = byUser.get(match.discordUserId);
    if (list) list.push(match);
    else byUser.set(match.discordUserId, [match]);
  }

  // Clean up stale alerts for users who no longer have any active shortages/matches
  const storedMessages = await listAllDealAlertMessages(database);
  for (const stored of storedMessages) {
    if (!byUser.has(stored.discordUserId)) {
      for (const oldId of parseMessageIds(stored.messageId)) {
        await transport.delete({ channelId: stored.channelId, messageId: oldId });
      }
      await deleteDealAlertMessage(stored.discordUserId, database);
    }
  }

  let sent = 0;
  for (const [discordUserId, userMatches] of byUser) {
    const currentKeys = userMatches.map(matchKey);
    const stored = await getDealAlertMessage(discordUserId, database);

    if (!hasListingChanges(currentKeys, stored?.lastListingKeys, options.forceRefresh)) {
      continue;
    }

    const chunks = formatDealAlertChunks(userMatches, now);
    const sentRefs: DealAlertMessageRef[] = [];
    for (const chunk of chunks) {
      const ref = await transport.send(discordUserId, chunk);
      if (ref) sentRefs.push(ref);
      else break;
    }

    if (sentRefs.length !== chunks.length) {
      console.warn(
        `[discord-dm] Failed to send all deal alert chunks to ${discordUserId} (${sentRefs.length}/${chunks.length} sent)`
      );
      for (const partial of sentRefs) await transport.delete(partial);
      continue;
    }

    if (stored) {
      for (const oldId of parseMessageIds(stored.messageId)) {
        await transport.delete({ channelId: stored.channelId, messageId: oldId });
      }
    }

    await upsertDealAlertMessage(
      {
        discordUserId,
        channelId: sentRefs[0].channelId,
        messageId: sentRefs.map((r) => r.messageId).join(","),
        lastListingKeys: JSON.stringify(currentKeys),
        updatedAt: now,
      },
      database
    );
    sent++;
  }

  return { matched: matches.length, sent };
}

interface DiscordDirectMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Opens (or reuses) a DM channel with a Discord user and posts a message.
 * Returns the created message's channel/message ids so callers can edit or
 * delete it later.
 */
async function postDiscordDirectMessage(
  discordUserId: string,
  payload: DiscordDirectMessagePayload,
  botToken?: string
): Promise<DealAlertMessageRef | null> {
  if (!botToken) {
    console.warn("[discord-dm] DISCORD_BOT_TOKEN is not configured in environment variables.");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    // 1. Open DM channel with recipient
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
      signal: controller.signal,
    });

    if (!dmRes.ok) {
      clearTimeout(timer);
      const errText = await dmRes.text().catch(() => "");
      console.error(`[discord-dm] Failed to open DM channel (${dmRes.status}):`, errText);
      return null;
    }
    const dmData = await dmRes.json();
    const channelId = dmData.id;

    // 2. Post message (embed or plain text) to the DM channel
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => "");
      console.error(`[discord-dm] Failed to post DM message (${msgRes.status}):`, errText);
      return null;
    }

    const msgData = await msgRes.json();
    if (!msgData?.id) {
      return null;
    }
    return { channelId, messageId: msgData.id };
  } catch (err) {
    clearTimeout(timer);
    console.error("[discord-dm] Error sending DM:", err);
    return null;
  }
}

/**
 * Dispatches a private bot DM carrying a Discord embed (e.g. the /wantlist
 * notify confirmation).
 */
export async function sendDiscordDirectMessage(
  discordUserId: string,
  embed: DiscordEmbed,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<boolean> {
  const ref = await postDiscordDirectMessage(
    discordUserId,
    { embeds: [embed] },
    botToken
  );
  return ref !== null;
}

/**
 * Dispatches a private bot DM carrying plain-text content (e.g. deal alerts)
 * and returns the created message reference for later edit/delete. If content
 * exceeds Discord's length boundary, it is split into chunks and sent sequentially.
 */
export async function sendDiscordDirectContent(
  discordUserId: string,
  content: string,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<DealAlertMessageRef | null> {
  const chunks = splitMessageContent(content, MESSAGE_MAX_LENGTH);
  if (chunks.length === 0) {
    return null;
  }

  const sentRefs: DealAlertMessageRef[] = [];
  for (const chunk of chunks) {
    const ref = await postDiscordDirectMessage(discordUserId, { content: chunk }, botToken);
    if (!ref) {
      for (const partial of sentRefs) {
        await deleteDiscordDirectMessage(partial.channelId, partial.messageId, botToken);
      }
      return null;
    }
    sentRefs.push(ref);
  }

  return {
    channelId: sentRefs[0].channelId,
    messageId: sentRefs.map((r) => r.messageId).join(","),
  };
}

/**
 * Deletes a previously sent DM message (or comma-separated list of message IDs).
 * Best-effort: missing messages and network failures are logged and ignored
 * so a stale alert never blocks a new one from being delivered.
 */
export async function deleteDiscordDirectMessage(
  channelId: string,
  messageId: string,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<void> {
  if (!botToken) {
    return;
  }

  const messageIds = parseMessageIds(messageId);
  for (const id of messageIds) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        }
      );

      if (!res.ok && res.status !== 404) {
        const errText = await res.text().catch(() => "");
        console.error(`[discord-dm] Failed to delete DM message (${res.status}):`, errText);
      }
    } catch (err) {
      console.error("[discord-dm] Error deleting DM message:", err);
    }
  }
}
