import {
  resolveCollectorByPlatform,
  getCollectorDecks,
  getDeckShortages,
} from "../collector-assistant";
import {
  buildUnlinkedAccountEmbed,
  buildUnlinkedAccountActionRow,
  handleOnboardingComponent,
} from "./onboarding";
import type {
  AssistantDeckSummary,
  AssistantDeckShortagesResponse,
} from "@ga/contracts";
import {
  DISCORD_COLORS,
  type DiscordInteractionPayload,
  type DiscordInteractionResponse,
  type DiscordEmbed,
  type DiscordEmbedField,
  type DiscordActionRowComponent,
  type DiscordSelectMenuOption,
} from "./types";

/**
 * Builds the overview embed summarizing all decks for a collector.
 */
export function buildDecksOverviewEmbed(
  collectorName: string,
  decks: AssistantDeckSummary[]
): DiscordEmbed {
  if (decks.length === 0) {
    return {
      title: `${collectorName}'s Decks`,
      description: "You don't have any decks saved yet. Create a deck on the GA Binder web app!",
      color: DISCORD_COLORS.BLUE,
    };
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

  return {
    title: `${collectorName}'s Decks (${decks.length})`,
    color: DISCORD_COLORS.BLUE,
    fields,
    footer: { text: "Use the dropdown below to inspect a deck in-place." },
  };
}

/**
 * Builds the interactive dropdown select menu component for inspecting decks.
 */
export function buildDecksSelectMenu(
  decks: AssistantDeckSummary[],
  customId: "select_deck_details" | "select_deck_shortages",
  placeholder: string,
  includeOverviewOption: boolean = false,
  selectedValue?: string
): DiscordActionRowComponent {
  const options: DiscordSelectMenuOption[] = [];

  if (includeOverviewOption) {
    options.push({
      label: "« Back to All Decks",
      value: "__overview__",
      description: "View summary of all active decks",
      default: selectedValue === "__overview__",
    });
  }

  const sliceLimit = includeOverviewOption ? 24 : 25;
  for (const d of decks.slice(0, sliceLimit)) {
    const desc = d.champion
      ? `Champion: ${d.champion} | ${d.completionPercentage}%`
      : `${d.completionPercentage}% complete`;

    options.push({
      label: d.name.slice(0, 100),
      value: d.id,
      description: desc.slice(0, 100),
      default: selectedValue === d.id,
    });
  }

  return {
    type: 1, // ActionRow
    components: [
      {
        type: 3, // StringSelectMenu
        custom_id: customId,
        placeholder,
        options,
      },
    ],
  };
}

/**
 * Builds the shortages embed for a specific deck.
 */
export function buildDeckShortagesEmbed(
  shortages: AssistantDeckShortagesResponse
): DiscordEmbed {
  const isComplete =
    shortages.hardShortages.length === 0 && shortages.sharedShortages.length === 0;

  if (isComplete) {
    return {
      title: `${shortages.deckName} — 100% Complete!`,
      description:
        "All cards are fully owned and available with zero shortages. Ready to play! 🎉",
      color: DISCORD_COLORS.GREEN,
    };
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
      const competing =
        s.competingDecks.length > 0 ? ` [contended with ${s.competingDecks.join(", ")}]` : "";
      return `• **${s.cardName}** x${s.sharedQuantity} shared${competing}`;
    });
    fields.push({
      name: `🟡 Shared Shortages (${shortages.totalSharedShortages}) — Revezamento entre Decks`,
      value: sharedLines.join("\n").slice(0, 1024),
      inline: false,
    });
  }

  const embedColor =
    shortages.hardShortages.length > 0 ? DISCORD_COLORS.RED : DISCORD_COLORS.GOLD;

  return {
    title: `Shortages for ${shortages.deckName} (${shortages.completionPercentage}%)`,
    description: `Format: ${shortages.format} | Total Shortages: ${
      shortages.totalHardShortages + shortages.totalSharedShortages
    }`,
    color: embedColor,
    fields,
  };
}

export { buildUnlinkedAccountEmbed, buildUnlinkedAccountActionRow };

/**
 * Handles Discord Message Component interactions (type: 3), updating messages in-place (type: 7).
 */
export async function handleDiscordMessageComponent(
  payload: DiscordInteractionPayload,
  database?: unknown
): Promise<DiscordInteractionResponse> {
  const discordUser = payload.user || payload.member?.user;
  if (!discordUser) {
    return {
      type: 7, // UPDATE_MESSAGE
      data: {
        flags: 64,
        embeds: [
          {
            title: "Authentication Error",
            description: "Unable to identify Discord user.",
            color: DISCORD_COLORS.RED,
          },
        ],
      },
    };
  }

  const customId = payload.data?.custom_id;
  if (customId) {
    const onboardingRes = await handleOnboardingComponent(customId, discordUser, database);
    if (onboardingRes) return onboardingRes;
  }

  const resolved = await resolveCollectorByPlatform("discord", discordUser.id, database);
  if (!resolved) {
    return {
      type: 7,
      data: {
        flags: 64,
        embeds: [buildUnlinkedAccountEmbed()],
        components: [buildUnlinkedAccountActionRow()],
      },
    };
  }

  const { collector } = resolved;
  const selectedValue = payload.data?.values?.[0];

  // 1. Handling deck browsing selection in /decks
  if (customId === "select_deck_details") {
    const decks = await getCollectorDecks(collector.id, database);

    if (!selectedValue || selectedValue === "__overview__") {
      const overviewEmbed = buildDecksOverviewEmbed(collector.name || "Collector", decks);
      const selectMenu = buildDecksSelectMenu(
        decks,
        "select_deck_details",
        "Select a deck to inspect composition...",
        true,
        "__overview__"
      );

      return {
        type: 7, // UPDATE_MESSAGE
        data: {
          flags: 64,
          embeds: [overviewEmbed],
          components: [selectMenu],
        },
      };
    }

    // Inspect specific deck
    try {
      const shortages = await getDeckShortages(collector.id, selectedValue, database);
      const detailEmbed = buildDeckShortagesEmbed(shortages);
      detailEmbed.title = `${shortages.deckName} Details (${shortages.completionPercentage}%)`;

      const selectMenu = buildDecksSelectMenu(
        decks,
        "select_deck_details",
        "Select another deck to inspect...",
        true,
        selectedValue
      );

      return {
        type: 7, // UPDATE_MESSAGE
        data: {
          flags: 64,
          embeds: [detailEmbed],
          components: [selectMenu],
        },
      };
    } catch {
      return {
        type: 7,
        data: {
          flags: 64,
          embeds: [
            {
              title: "Deck Not Found",
              description: "Could not find the selected deck.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }
  }

  // 2. Handling deck shortages selection in /shortages
  if (customId === "select_deck_shortages") {
    const decks = await getCollectorDecks(collector.id, database);
    if (!selectedValue) {
      return {
        type: 7,
        data: {
          flags: 64,
          embeds: [
            {
              title: "No Deck Selected",
              description: "Please select a deck from the list.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }

    try {
      const shortages = await getDeckShortages(collector.id, selectedValue, database);
      const embed = buildDeckShortagesEmbed(shortages);
      const selectMenu = buildDecksSelectMenu(
        decks,
        "select_deck_shortages",
        "Select another deck to view shortages...",
        false,
        selectedValue
      );

      return {
        type: 7, // UPDATE_MESSAGE
        data: {
          flags: 64,
          embeds: [embed],
          components: [selectMenu],
        },
      };
    } catch {
      return {
        type: 7,
        data: {
          flags: 64,
          embeds: [
            {
              title: "Deck Not Found",
              description: "Could not find the selected deck.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }
  }

  return {
    type: 7,
    data: {
      flags: 64,
      embeds: [
        {
          title: "Unknown Component",
          description: `Component interaction \`${customId}\` not recognized.`,
          color: DISCORD_COLORS.RED,
        },
      ],
    },
  };
}
