import { findIdentitiesWithNotificationsEnabled } from "../db/repositories/assistant-repository";
import {
  getDealAlertMessage,
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
  formatDealAlertMessage,
  hasNewListings,
  listingKey,
  type DealAlertMatch,
  type DealAlertSource,
} from "./deal-alert-format";
import type { AssistantWantlistResponse } from "@ga/contracts";
import type { DiscordEmbed } from "./discord-interactions/types";

export { formatDealAlertMessage };
export type { DealAlertMatch, DealAlertSource };

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
      return {
        kind: "hard",
        deckId: deck.deckId,
        deckName: deck.deckName,
        missingQuantity: hard.missingQuantity,
      };
    }
    const shared = deck.sharedShortages.find((s) => s.cardSlug === listing.cardSlug);
    if (shared) {
      return {
        kind: "shared",
        deckId: deck.deckId,
        deckName: deck.deckName,
        sharedQuantity: shared.sharedQuantity,
      };
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

/**
 * Fetches every in-stock marketplace listing, matches them against enabled
 * collectors' wantlists and deck shortages, and maintains a single rolling DM
 * per collector. The previous snapshot message is deleted and a fresh one is
 * sent only when at least one new matching listing appears.
 */
export async function dispatchDealAlerts(
  database?: MarketplaceDatabase,
  transport: DealAlertTransport = defaultDealAlertTransport,
  now: Date = new Date()
): Promise<DealAlertDispatchResult> {
  const listings = await getMarketCards({ inStockOnly: true }, database);
  const matches = await matchDealAlerts(listings, database);

  const byUser = new Map<string, DealAlertMatch[]>();
  for (const match of matches) {
    const list = byUser.get(match.discordUserId);
    if (list) {
      list.push(match);
    } else {
      byUser.set(match.discordUserId, [match]);
    }
  }

  let sent = 0;
  for (const [discordUserId, userMatches] of byUser) {
    const currentKeys = userMatches.map((match) => listingKey(match.listing));
    const stored = await getDealAlertMessage(discordUserId, database);

    if (!hasNewListings(currentKeys, stored?.lastListingKeys)) {
      continue;
    }

    if (stored) {
      await transport.delete({
        channelId: stored.channelId,
        messageId: stored.messageId,
      });
    }

    const ref = await transport.send(
      discordUserId,
      formatDealAlertMessage(userMatches, now)
    );
    if (!ref) {
      continue;
    }

    await upsertDealAlertMessage(
      {
        discordUserId,
        channelId: ref.channelId,
        messageId: ref.messageId,
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
 * and returns the created message reference for later edit/delete.
 */
export async function sendDiscordDirectContent(
  discordUserId: string,
  content: string,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<DealAlertMessageRef | null> {
  return postDiscordDirectMessage(discordUserId, { content }, botToken);
}

/**
 * Deletes a previously sent DM message. Best-effort: missing messages and
 * network failures are logged and ignored so a stale alert never blocks a new
 * one from being delivered.
 */
export async function deleteDiscordDirectMessage(
  channelId: string,
  messageId: string,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<void> {
  if (!botToken) {
    return;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
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
