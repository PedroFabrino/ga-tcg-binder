import {
  resolveCollectorByPlatform,
} from "../collector-assistant";
import {
  importOmnidexDeckToPersonalWants,
  importOmnidexDeckToCollection,
} from "../omnidex-wants";
import {
  DISCORD_COLORS,
  type DiscordInteractionPayload,
  type DiscordInteractionResponse,
  type DiscordEmbed,
} from "./types";

/**
 * Extracts a text input value by its custom_id from modal submission components.
 */
function getModalInputValue(
  payload: DiscordInteractionPayload,
  customId: string
): string | undefined {
  const rows = payload.data?.components || [];
  for (const row of rows) {
    for (const comp of row.components) {
      if (comp.custom_id === customId) {
        return comp.value?.trim();
      }
    }
  }
  return undefined;
}

/**
 * Builds the Discord Modal response (type: 9) for adding a deck via raw text.
 */
export function buildDecksAddModal(): DiscordInteractionResponse {
  return {
    type: 9, // MODAL
    data: {
      custom_id: "modal_decks_add",
      title: "Import Deck from Omnidex",
      components: [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 4, // TextInput
              custom_id: "input_deck_name",
              style: 1, // Short
              label: "Deck Name",
              placeholder: "e.g. Tristan Water Control",
              required: true,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "input_deck_text",
              style: 2, // Paragraph
              label: "Omnidex Decklist Text",
              placeholder: "Paste raw decklist from Omnidex.gg / Silvie.gg...",
              required: true,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Builds the Discord Modal response (type: 9) for importing Omnidex unowned gap to Wants.
 */
export function buildWantlistAddOmnidexModal(): DiscordInteractionResponse {
  return {
    type: 9, // MODAL
    data: {
      custom_id: "modal_wantlist_add_omnidex",
      title: "Add Omnidex Missing Cards to Wants",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "input_wantlist_text",
              style: 2, // Paragraph
              label: "Omnidex Decklist Text",
              placeholder: "Paste raw Omnidex decklist to import only unowned missing cards...",
              required: true,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Handles Discord Modal Submit interactions (type: 5).
 */
export async function handleDiscordModalSubmit(
  payload: DiscordInteractionPayload,
  database?: unknown
): Promise<DiscordInteractionResponse> {
  const discordUser = payload.user || payload.member?.user;
  if (!discordUser) {
    return {
      type: 4,
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

  const resolved = await resolveCollectorByPlatform("discord", discordUser.id, database);
  if (!resolved) {
    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: "Grand Archive Binder Account Not Linked",
            description: "Please link your account with `/link <code>` first.",
            color: DISCORD_COLORS.GOLD,
          },
        ],
      },
    };
  }

  const { collector } = resolved;
  const customId = payload.data?.custom_id;

  // 1. Submit for /decks add
  if (customId === "modal_decks_add") {
    const deckName = getModalInputValue(payload, "input_deck_name");
    const deckText = getModalInputValue(payload, "input_deck_text");

    if (!deckName || !deckText) {
      return {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: "Missing Deck Data",
              description: "Both Deck Name and Decklist Text are required.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }

    try {
      const created = await importOmnidexDeckToCollection(
        collector.id,
        deckName,
        deckText,
        undefined,
        "standard",
        database
      );

      return {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: `🎉 Deck "${created.name}" Imported Successfully!`,
              description:
                "Your constructed deck has been saved to your Grand Archive Binder.\nUse `/decks` or `/shortages` to view completion and shortages.",
              color: DISCORD_COLORS.GREEN,
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: "Failed to Import Deck",
              description: err?.message || "Invalid Omnidex decklist format.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }
  }

  // 2. Submit for /wantlist add-omnidex
  if (customId === "modal_wantlist_add_omnidex") {
    const omnidexText = getModalInputValue(payload, "input_wantlist_text");
    if (!omnidexText) {
      return {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: "Missing Decklist Text",
              description: "Please paste your Omnidex decklist.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }

    try {
      const result = await importOmnidexDeckToPersonalWants(
        collector.id,
        omnidexText,
        database
      );

      return {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: "🎯 Omnidex Wantlist Gap Imported!",
              description: `Added **${result.addedCardsCount}** missing card${
                result.addedCardsCount === 1 ? "" : "s"
              } (**${result.addedCopiesCount}** total copies) to your Personal Wants.\n\n✨ **${
                result.skippedCopiesCount
              }** copies were already owned in your Binder and skipped.`,
              color: DISCORD_COLORS.GREEN,
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: "Failed to Process Omnidex Wantlist",
              description: err?.message || "Invalid Omnidex decklist format.",
              color: DISCORD_COLORS.RED,
            },
          ],
        },
      };
    }
  }

  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [
        {
          title: "Unknown Modal Submission",
          description: `Modal \`${customId}\` is not recognized.`,
          color: DISCORD_COLORS.RED,
        },
      ],
    },
  };
}
