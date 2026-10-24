import {
  linkIdentityWithToken,
  resolveCollectorByPlatform,
  registerCollectorFromPlatform,
  getCollectorDecks,
  getDeckShortages,
  searchCollectorCollection,
} from "../collector-assistant";
import { getCollectorPortfolioSummary } from "../collector-portfolio";
import { importOmnidexDeckToCollection } from "../omnidex-wants";
import { fetchDeckFromUrl } from "../omnidex";
import {
  buildDecksOverviewEmbed,
  buildDecksSelectMenu,
  buildDeckShortagesEmbed,
} from "./components";
import {
  buildUnlinkedAccountEmbed,
  buildUnlinkedAccountActionRow,
  buildAccountCreatedEmbed,
  buildAccountAlreadyLinkedEmbed,
} from "./onboarding";
import { buildDecksAddModal } from "./modals";
import {
  handleWantlistCommand,
  getOptionValue,
} from "./wantlist-commands";
import {
  DISCORD_COLORS,
  type DiscordInteractionPayload,
  type DiscordInteractionResponse,
  type DiscordEmbed,
  type DiscordEmbedField,
} from "./types";

/**
 * Creates an ephemeral Discord response containing an embed.
 */
export function createEphemeralEmbedResponse(
  embed: DiscordEmbed,
  components?: any[]
): DiscordInteractionResponse {
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      flags: 64, // EPHEMERAL
      embeds: [embed],
      components,
    },
  };
}

/**
 * Dispatches slash command interactions (type: 2).
 */
export async function handleDiscordApplicationCommand(
  payload: DiscordInteractionPayload,
  database?: unknown
): Promise<DiscordInteractionResponse> {
  const discordUser = payload.user || payload.member?.user;
  if (!discordUser) {
    return createEphemeralEmbedResponse({
      title: "Authentication Error",
      description: "Unable to identify Discord user from interaction payload.",
      color: DISCORD_COLORS.RED,
    });
  }

  const commandName = payload.data?.name;
  const rootOptions = payload.data?.options || [];

  // 1. /link
  if (commandName === "link") {
    const code = getOptionValue(rootOptions, "code");
    if (!code) {
      return createEphemeralEmbedResponse({
        title: "Missing Pairing Code",
        description: "Please provide the 6-character code: `/link <code>`.",
        color: DISCORD_COLORS.RED,
      });
    }

    const linkResult = await linkIdentityWithToken(
      {
        token: String(code).trim().toUpperCase(),
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
        color: DISCORD_COLORS.RED,
      });
    }

    return createEphemeralEmbedResponse({
      title: "Account Linked Successfully!",
      description: `Your Discord account has been linked to **${
        linkResult.collector?.name || "Collector"
      }**.\n\nYou can now use \`/decks\`, \`/shortages\`, \`/collection\`, and \`/wantlist\`!`,
      color: DISCORD_COLORS.GREEN,
    });
  }

  // 2. /register (Direct Discord registration)
  if (commandName === "register") {
    const { collector, created } = await registerCollectorFromPlatform(
      {
        provider: "discord",
        providerUserId: discordUser.id,
        providerUsername: discordUser.username,
      },
      database
    );

    const embed = created
      ? buildAccountCreatedEmbed(collector)
      : buildAccountAlreadyLinkedEmbed(collector);

    return createEphemeralEmbedResponse(embed);
  }

  // 3. Resolve collector identity
  const resolved = await resolveCollectorByPlatform("discord", discordUser.id, database);
  if (!resolved) {
    return createEphemeralEmbedResponse(
      buildUnlinkedAccountEmbed(),
      [buildUnlinkedAccountActionRow()]
    );
  }

  const { collector } = resolved;

  // 3. /decks
  if (commandName === "decks") {
    const addSub = rootOptions.find((o) => o.name === "add");
    if (addSub) {
      const url = getOptionValue(addSub.options, "url");
      if (!url) {
        return buildDecksAddModal();
      }

      try {
        const fetched = await fetchDeckFromUrl(String(url).trim());
        const deckName = fetched.name || "Imported Deck";
        await importOmnidexDeckToCollection(
          collector.id,
          deckName,
          fetched.decklist,
          undefined,
          "standard",
          database
        );

        return createEphemeralEmbedResponse({
          title: `🎉 Deck "${deckName}" Imported!`,
          description:
            "The deck was successfully parsed and added to your collection.\nUse `/decks` or `/shortages` to view its composition.",
          color: DISCORD_COLORS.GREEN,
        });
      } catch (err: any) {
        return createEphemeralEmbedResponse({
          title: "Import Failed",
          description: err?.message || "Could not fetch or parse deck from the provided URL.",
          color: DISCORD_COLORS.RED,
        });
      }
    }

    // Default: Decks overview with Select Menu
    const decks = await getCollectorDecks(collector.id, database);
    const embed = buildDecksOverviewEmbed(collector.name || "Collector", decks);
    if (decks.length === 0) {
      return createEphemeralEmbedResponse(embed);
    }

    const selectMenu = buildDecksSelectMenu(
      decks,
      "select_deck_details",
      "Select a deck to inspect composition...",
      true,
      "__overview__"
    );

    return createEphemeralEmbedResponse(embed, [selectMenu]);
  }

  // 4. /shortages
  if (commandName === "shortages") {
    const deckQuery = getOptionValue(rootOptions, "deck");
    if (!deckQuery) {
      // Show select menu of decks
      const decks = await getCollectorDecks(collector.id, database);
      if (decks.length === 0) {
        return createEphemeralEmbedResponse({
          title: `${collector.name || "Collector"}'s Shortages`,
          description: "You don't have any saved decks yet. Create a deck on the GA Binder web app!",
          color: DISCORD_COLORS.BLUE,
        });
      }

      const selectMenu = buildDecksSelectMenu(
        decks,
        "select_deck_shortages",
        "Select a deck to view shortages...",
        false
      );

      return createEphemeralEmbedResponse(
        {
          title: "Inspect Deck Shortages",
          description: "Select one of your active decks below to inspect Hard and Shared shortages:",
          color: DISCORD_COLORS.GOLD,
        },
        [selectMenu]
      );
    }

    try {
      const shortages = await getDeckShortages(collector.id, String(deckQuery), database);
      const embed = buildDeckShortagesEmbed(shortages);
      return createEphemeralEmbedResponse(embed);
    } catch {
      return createEphemeralEmbedResponse({
        title: "Deck Not Found",
        description: `Could not find a deck matching "${deckQuery}". Run \`/decks\` to see your active decks.`,
        color: DISCORD_COLORS.RED,
      });
    }
  }

  // 5. /collection
  if (commandName === "collection") {
    const query = getOptionValue(rootOptions, "query");

    // Empty /collection: Return Portfolio Dashboard
    if (!query) {
      const summary = await getCollectorPortfolioSummary(collector.id, database);
      const elementLines = summary.elements.map(
        (e) => `• ${e.element.toUpperCase()}: **${e.count}** cards`
      );

      const fields: DiscordEmbedField[] = [
        {
          name: "📦 Total Inventory",
          value: `**${summary.totalCards}** Total Cards\n**${summary.uniqueCards}** Unique Cards`,
          inline: true,
        },
        {
          name: "✨ Finishes",
          value: `★ Foil: **${summary.foilCards}**\nNormal: **${summary.normalCards}**`,
          inline: true,
        },
        {
          name: "🗂️ Dedication Status",
          value: `Sleeved (Decks): **${summary.dedicatedCards}**\nIdle (Trade): **${summary.idleCards}**`,
          inline: true,
        },
        {
          name: "🌐 Elemental Breakdown",
          value: elementLines.length > 0 ? elementLines.join("\n") : "No elements recorded.",
          inline: false,
        },
        {
          name: "🔗 Web Binder Profile",
          value: `[Open Complete Binder in Browser](${summary.profileUrl})`,
          inline: false,
        },
      ];

      return createEphemeralEmbedResponse({
        title: `📁 ${collector.name || "Collector"}'s Collection Portfolio`,
        description: "High-level overview of your personal Grand Archive collection.",
        color: DISCORD_COLORS.BLUE,
        fields,
      });
    }

    // Specific query search
    const res = await searchCollectorCollection(collector.id, String(query), database);
    if (res.cards.length === 0) {
      return createEphemeralEmbedResponse({
        title: `Collection Search: "${query}"`,
        description: "No owned copies found matching that name in your Binder.",
        color: DISCORD_COLORS.BLUE,
      });
    }

    const fields: DiscordEmbedField[] = res.cards.slice(0, 5).map((card) => {
      const printingLines = card.printings.map(
        (p) =>
          `• ${p.setPrefix}-${p.collectorNumber} ${p.foil ? "★ Foil" : "Normal"} x${
            p.quantity
          } (${p.isDedicated ? "Dedicated" : "Idle"})`
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
      title: `Collection Search: "${query}" (${res.cards.length} match${
        res.cards.length > 1 ? "es" : ""
      })`,
      color: DISCORD_COLORS.BLUE,
      fields,
    });
  }

  // 6. /wantlist
  if (commandName === "wantlist") {
    return handleWantlistCommand(collector, rootOptions, database, discordUser.id);
  }

  return createEphemeralEmbedResponse({
    title: "Unknown Command",
    description: `Command \`/${commandName}\` is not recognized.`,
    color: DISCORD_COLORS.RED,
  });
}
