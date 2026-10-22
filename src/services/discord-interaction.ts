import crypto from "crypto";
import {
  linkIdentityWithToken,
  resolveCollectorByPlatform,
  getCollectorDecks,
  getDeckShortages,
  searchCollectorCollection,
  getDeckPartitionedWantlist,
} from "./collector-assistant";

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  url?: string;
}

export interface DiscordInteractionDataOption {
  name: string;
  type: number;
  value?: string | number | boolean;
}

export interface DiscordInteractionPayload {
  type: number; // 1 = PING, 2 = APPLICATION_COMMAND
  token: string;
  id: string;
  data?: {
    name: string;
    options?: DiscordInteractionDataOption[];
  };
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
}

export interface DiscordInteractionResponse {
  type: number; // 1 = PONG, 4 = CHANNEL_MESSAGE_WITH_SOURCE
  data?: {
    content?: string;
    embeds?: DiscordEmbed[];
    flags?: number; // 64 = EPHEMERAL
  };
}

const COLORS = {
  GREEN: 0x2ecc71,
  RED: 0xe74c3c,
  GOLD: 0xf1c40f,
  BLUE: 0x3498db,
};

/**
 * Validates Ed25519 signature headers sent by Discord.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string,
  timestamp: string,
  clientPublicKeyHex: string
): boolean {
  try {
    const prefix = Buffer.from("302a300506032b6570032100", "hex");
    const rawPub = Buffer.from(clientPublicKeyHex, "hex");
    const key = crypto.createPublicKey({
      key: Buffer.concat([prefix, rawPub]),
      format: "der",
      type: "spki",
    });
    const message = Buffer.from(timestamp + rawBody);
    const signature = Buffer.from(signatureHex, "hex");
    return crypto.verify(null, message, key, signature);
  } catch {
    return false;
  }
}

/**
 * Creates an ephemeral Discord interaction response with an embed.
 */
function createEphemeralEmbedResponse(embed: DiscordEmbed): DiscordInteractionResponse {
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      flags: 64, // EPHEMERAL (strictly private to user)
      embeds: [embed],
    },
  };
}

/**
 * Dispatches an inbound Discord interaction to the appropriate assistant logic.
 */
export async function handleDiscordInteraction(
  payload: DiscordInteractionPayload,
  database?: unknown
): Promise<DiscordInteractionResponse> {
  // 1. Handle Ping
  if (payload.type === 1) {
    return { type: 1 };
  }

  // 2. Extract user identity
  const discordUser = payload.user || payload.member?.user;
  if (!discordUser) {
    return createEphemeralEmbedResponse({
      title: "Authentication Error",
      description: "Unable to identify Discord user from interaction payload.",
      color: COLORS.RED,
    });
  }

  const commandName = payload.data?.name;
  const options = payload.data?.options || [];
  const getOptionValue = (name: string): string | undefined => {
    const opt = options.find((o) => o.name === name);
    return opt?.value !== undefined ? String(opt.value) : undefined;
  };

  // 3. Handle /link
  if (commandName === "link") {
    const code = getOptionValue("code");
    if (!code) {
      return createEphemeralEmbedResponse({
        title: "Missing Pairing Code",
        description: "Please provide the 6-character code: `/link <code>`.",
        color: COLORS.RED,
      });
    }

    const linkResult = await linkIdentityWithToken(
      {
        token: code.trim().toUpperCase(),
        provider: "discord",
        providerUserId: discordUser.id,
        providerUsername: discordUser.username,
      },
      database
    );

    if (!linkResult.success) {
      return createEphemeralEmbedResponse({
        title: "Linking Failed",
        description:
          "Invalid or expired pairing code. Please generate a fresh code in **Settings > Linked Accounts** on the Grand Archive Binder web app.",
        color: COLORS.RED,
      });
    }

    return createEphemeralEmbedResponse({
      title: "Account Linked Successfully!",
      description: `Your Discord account has been linked to **${linkResult.collector?.name || "Collector"}**.\n\nYou can now use \`/decks\`, \`/shortages\`, \`/collection\`, and \`/wantlist\`!`,
      color: COLORS.GREEN,
    });
  }

  // 4. Resolve collector for all other commands
  const resolved = await resolveCollectorByPlatform("discord", discordUser.id, database);
  if (!resolved) {
    return createEphemeralEmbedResponse({
      title: "Grand Archive Binder Account Not Linked",
      description:
        "You haven't linked your Grand Archive Binder account yet.\n\n1. Visit the GA Binder web app and go to **Settings > Linked Accounts**.\n2. Click **Generate Code** to get a 6-character code.\n3. Run `/link <code>` here in Discord.",
      color: COLORS.GOLD,
    });
  }

  const { collector } = resolved;

  // 5. Handle /decks
  if (commandName === "decks") {
    const decks = await getCollectorDecks(collector.id, database);
    if (decks.length === 0) {
      return createEphemeralEmbedResponse({
        title: `${collector.name || "Collector"}'s Decks`,
        description: "You don't have any decks saved yet. Create a deck on the GA Binder web app!",
        color: COLORS.BLUE,
      });
    }

    const fields: DiscordEmbedField[] = decks.map((deck) => {
      const statusIcon = deck.completionPercentage === 100 ? "✅" : "⚠️";
      const value = [
        `Champion: **${deck.champion || "None"}** | Format: ${deck.format}`,
        `Cards: ${deck.totalCards} (${deck.uniqueCards} unique)`,
        `Completion: **${deck.completionPercentage}%** ${statusIcon}`,
        deck.hardShortageCount > 0 ? `🔴 Hard Shortages: ${deck.hardShortageCount}` : null,
        deck.sharedShortageCount > 0 ? `🟡 Shared Shortages: ${deck.sharedShortageCount}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        name: `${deck.name}`,
        value,
        inline: false,
      };
    });

    return createEphemeralEmbedResponse({
      title: `${collector.name || "Collector"}'s Decks (${decks.length})`,
      color: COLORS.BLUE,
      fields,
      footer: { text: "Use /shortages <deck> to inspect itemized missing cards." },
    });
  }

  // 6. Handle /shortages
  if (commandName === "shortages") {
    const deckQuery = getOptionValue("deck");
    if (!deckQuery) {
      return createEphemeralEmbedResponse({
        title: "Missing Deck Name",
        description: "Please specify a deck: `/shortages <deck_name>`.",
        color: COLORS.RED,
      });
    }

    try {
      const shortages = await getDeckShortages(collector.id, deckQuery, database);
      const isComplete = shortages.hardShortages.length === 0 && shortages.sharedShortages.length === 0;

      if (isComplete) {
        return createEphemeralEmbedResponse({
          title: `${shortages.deckName} — 100% Complete!`,
          description: "All cards are fully owned and available with zero shortages. Ready to play! 🎉",
          color: COLORS.GREEN,
        });
      }

      const fields: DiscordEmbedField[] = [];

      if (shortages.hardShortages.length > 0) {
        const hardLines = shortages.hardShortages.map(
          (s) => `• **${s.cardName}** x${s.missingQuantity} missing (needs ${s.requiredQuantity})`
        );
        fields.push({
          name: `🔴 Hard Shortages (${shortages.totalHardShortages}) — Compra Necessária`,
          value: hardLines.join("\n").slice(0, 1024),
          inline: false,
        });
      }

      if (shortages.sharedShortages.length > 0) {
        const sharedLines = shortages.sharedShortages.map((s) => {
          const competing = s.competingDecks.length > 0 ? ` [contended with ${s.competingDecks.join(", ")}]` : "";
          return `• **${s.cardName}** x${s.sharedQuantity} shared${competing}`;
        });
        fields.push({
          name: `🟡 Shared Shortages (${shortages.totalSharedShortages}) — Revezamento entre Decks`,
          value: sharedLines.join("\n").slice(0, 1024),
          inline: false,
        });
      }

      const embedColor = shortages.hardShortages.length > 0 ? COLORS.RED : COLORS.GOLD;

      return createEphemeralEmbedResponse({
        title: `Shortages for ${shortages.deckName} (${shortages.completionPercentage}%)`,
        description: `Format: ${shortages.format} | Total Shortages: ${shortages.totalHardShortages + shortages.totalSharedShortages}`,
        color: embedColor,
        fields,
      });
    } catch (err: any) {
      return createEphemeralEmbedResponse({
        title: "Deck Not Found",
        description: `Could not find a deck matching "${deckQuery}". Run \`/decks\` to see your active decks.`,
        color: COLORS.RED,
      });
    }
  }

  // 7. Handle /collection
  if (commandName === "collection") {
    const query = getOptionValue("query");
    if (!query) {
      return createEphemeralEmbedResponse({
        title: "Missing Search Query",
        description: "Please specify a card name: `/collection <card_name>`.",
        color: COLORS.RED,
      });
    }

    const res = await searchCollectorCollection(collector.id, query, database);
    if (res.cards.length === 0) {
      return createEphemeralEmbedResponse({
        title: `Collection Search: "${query}"`,
        description: "No owned copies found matching that name in your Binder.",
        color: COLORS.BLUE,
      });
    }

    const fields: DiscordEmbedField[] = res.cards.slice(0, 5).map((card) => {
      const printingLines = card.printings.map(
        (p) => `• ${p.setPrefix}-${p.collectorNumber} ${p.foil ? "★ Foil" : "Normal"} x${p.quantity} (${p.isDedicated ? "Dedicated" : "Idle"})`
      );

      return {
        name: `${card.cardName} (${card.element} ${card.type}) — Total: ${card.totalOwned}`,
        value: [`Dedicated: ${card.dedicatedTotal} | Idle: ${card.idleTotal}`, ...printingLines]
          .join("\n")
          .slice(0, 1024),
        inline: false,
      };
    });

    return createEphemeralEmbedResponse({
      title: `Collection Search: "${query}" (${res.cards.length} match${res.cards.length > 1 ? "es" : ""})`,
      color: COLORS.BLUE,
      fields,
    });
  }

  // 8. Handle /wantlist
  if (commandName === "wantlist") {
    const optionalDeck = getOptionValue("deck");
    try {
      const wantlist = await getDeckPartitionedWantlist(collector.id, optionalDeck, database);

      if (wantlist.decks.length === 0) {
        return createEphemeralEmbedResponse({
          title: "Wantlist",
          description: optionalDeck
            ? `Zero shortages for **${optionalDeck}**! Your collection fully covers this decklist.`
            : "Zero shortages across your decks! Your collection fully covers all active decklists.",
          color: COLORS.GREEN,
        });
      }

      const fields: DiscordEmbedField[] = wantlist.decks.map((group) => {
        const items: string[] = [];
        for (const h of group.hardShortages) {
          items.push(`🔴 ${h.cardName} x${h.missingQuantity}`);
        }
        for (const s of group.sharedShortages) {
          items.push(`🟡 ${s.cardName} x${s.sharedQuantity}`);
        }

        return {
          name: `**${group.deckName}** (${group.totalShortages} shortages)`,
          value: items.join("\n").slice(0, 1024) || "No shortages",
          inline: false,
        };
      });

      return createEphemeralEmbedResponse({
        title: `Wantlist (${wantlist.totalDecks} Deck${wantlist.totalDecks > 1 ? "s" : ""})`,
        description: `Total: **${wantlist.grandTotalHard}** Hard (🔴) | **${wantlist.grandTotalShared}** Shared (🟡)`,
        color: COLORS.GOLD,
        fields,
      });
    } catch {
      return createEphemeralEmbedResponse({
        title: "Deck Not Found",
        description: `Could not find a deck matching "${optionalDeck}". Run \`/decks\` to see your active decks.`,
        color: COLORS.RED,
      });
    }
  }

  return createEphemeralEmbedResponse({
    title: "Unknown Command",
    description: `Command \`/${commandName}\` is not recognized.`,
    color: COLORS.RED,
  });
}
