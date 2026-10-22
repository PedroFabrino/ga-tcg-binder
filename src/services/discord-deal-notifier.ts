import { findIdentitiesWithNotificationsEnabled } from "../db/repositories/assistant-repository";
import { listPersonalWants, type PersonalWantItem } from "../db/repositories/personal-wants-repository";
import { type MarketCard } from "../db/repositories/marketplace-repository";
import { getDeckPartitionedWantlist } from "./collector-assistant";
import { DISCORD_COLORS, type DiscordEmbed } from "./discord-interactions/types";

export interface DealAlertMatch {
  collectorId: string;
  discordUserId: string;
  listing: MarketCard;
  reason: string;
}

// In-memory alert cache for 24-hour alert deduplication
const sentAlertsCache = new Map<string, number>();
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

export function getDedupeKey(collectorId: string, listing: MarketCard): string {
  return `${collectorId}:${listing.cardSlug || listing.cardName}:${listing.storeId}:${listing.priceNumeric}:${listing.isFoil ? 1 : 0}`;
}

export function isAlertRecentlySent(key: string, now = Date.now()): boolean {
  const lastSent = sentAlertsCache.get(key);
  if (!lastSent) return false;
  if (now - lastSent > DEDUPE_TTL_MS) {
    sentAlertsCache.delete(key);
    return false;
  }
  return true;
}

export function recordAlertSent(key: string, now = Date.now()): void {
  sentAlertsCache.set(key, now);
}

export function clearAlertsCache(): void {
  sentAlertsCache.clear();
}

/**
 * Matches market listings against collectors with active wantlists and enabled deal alerts.
 */
export async function matchDealAlerts(
  listings: MarketCard[],
  database?: unknown
): Promise<DealAlertMatch[]> {
  // Find all Discord identities with notifications enabled
  const identities = await findIdentitiesWithNotificationsEnabled("discord", database as any);

  const matches: DealAlertMatch[] = [];

  for (const identity of identities) {
    const collectorId = identity.collectorId;
    const [personalWants, wantlist] = await Promise.all([
      listPersonalWants(collectorId, database as any),
      getDeckPartitionedWantlist(collectorId, undefined, database as any),
    ]);

    for (const listing of listings) {
      const dedupeKey = getDedupeKey(collectorId, listing);
      if (isAlertRecentlySent(dedupeKey)) {
        continue;
      }

      let matchedReason: string | null = null;

      // 1. Check Personal Wants (Direct Wants)
      const matchingWant = personalWants.find((w) => {
        if (w.cardSlug !== listing.cardSlug) return false;
        if (w.editionId && listing.editionId && w.editionId !== listing.editionId) return false;
        if (w.foil !== null && w.foil !== listing.isFoil) return false;
        if (w.targetMaxPrice !== null && listing.priceNumeric > w.targetMaxPrice) return false;
        return true;
      });

      if (matchingWant) {
        matchedReason = `🎯 Personal Want (needs ${matchingWant.desiredQuantity})`;
      } else {
        // 2. Check Deck Shortages (Hard and Shared)
        for (const deck of wantlist.decks) {
          const hard = deck.hardShortages.find((h) => h.cardSlug === listing.cardSlug);
          if (hard) {
            matchedReason = `🔴 Hard Shortage for ${deck.deckName} (needs ${hard.missingQuantity})`;
            break;
          }
          const shared = deck.sharedShortages.find((s) => s.cardSlug === listing.cardSlug);
          if (shared) {
            matchedReason = `🟡 Shared Shortage for ${deck.deckName} (needs ${shared.sharedQuantity})`;
            break;
          }
        }
      }

      if (matchedReason) {
        matches.push({
          collectorId,
          discordUserId: identity.providerUserId,
          listing,
          reason: matchedReason,
        });
        recordAlertSent(dedupeKey);
      }
    }
  }

  return matches;
}

/**
 * Formats a Discord embed for a private bot Direct Message deal alert.
 */
export function formatDealAlertEmbed(match: DealAlertMatch): DiscordEmbed {
  const { listing, reason } = match;
  const finish = listing.isFoil ? "★ Foil" : "Normal";
  const url = listing.productUrl || listing.vendorUrl || undefined;

  return {
    title: `🚨 Deal Alert: ${listing.cardName}`,
    description: `A card matching your wantlist is now available!`,
    color: DISCORD_COLORS.GREEN,
    fields: [
      {
        name: "Printing & Finish",
        value: `${listing.setPrefix} | ${finish} (${listing.quality})`,
        inline: true,
      },
      {
        name: "Price",
        value: `**${listing.price}**`,
        inline: true,
      },
      {
        name: "Store / Seller",
        value: listing.vendorName || listing.storeId,
        inline: true,
      },
      {
        name: "Reason",
        value: reason,
        inline: false,
      },
      url
        ? {
            name: "Direct Store Link",
            value: `[Open Store Page](${url})`,
            inline: false,
          }
        : {
            name: "Direct Store Link",
            value: "Visit store catalog",
            inline: false,
          },
    ],
    footer: { text: "Manage notifications anytime with /wantlist notify" },
  };
}

/**
 * Dispatches a private bot DM to a Discord user via REST API.
 */
export async function sendDiscordDirectMessage(
  discordUserId: string,
  embed: DiscordEmbed,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<boolean> {
  if (!botToken) return false;

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
      return false;
    }
    const dmData = await dmRes.json();
    const channelId = dmData.id;

    // 2. Post embed to DM channel
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    return msgRes.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}
