import { getDeckPartitionedWantlist } from "../collector-assistant";
import {
  listPersonalWants,
  upsertPersonalWant,
  removePersonalWant,
  setWantlistNotificationPreference,
  getWantlistNotificationPreference,
} from "../../db/repositories/personal-wants-repository";
import { importOmnidexDeckToPersonalWants } from "../omnidex-wants";
import { fetchDeckFromUrl } from "../omnidex";
import { findCardBySlugOrName } from "../../db/repositories/catalog-repository";
import { sendDiscordDirectMessage } from "../discord-deal-notifier";
import { buildWantlistAddOmnidexModal } from "./modals";
import {
  DISCORD_COLORS,
  type DiscordInteractionResponse,
  type DiscordEmbedField,
  type DiscordInteractionDataOption,
} from "./types";

/**
 * Creates an ephemeral Discord response containing an embed.
 */
function createEphemeralEmbed(
  title: string,
  description: string,
  color: number,
  fields?: DiscordEmbedField[]
): DiscordInteractionResponse {
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      flags: 64, // EPHEMERAL
      embeds: [{ title, description, color, fields }],
    },
  };
}

/**
 * Helper to extract option values from flat or subcommand-nested options.
 */
export function getOptionValue(
  options: DiscordInteractionDataOption[] | undefined,
  name: string
): string | number | boolean | undefined {
  if (!options) return undefined;
  const opt = options.find((o) => o.name === name);
  return opt?.value;
}

/**
 * Dispatches all /wantlist subcommands (view, add, remove, add-omnidex, notify).
 */
export async function handleWantlistCommand(
  collector: { id: string; name: string | null },
  rootOptions: DiscordInteractionDataOption[],
  database?: unknown,
  discordUserId?: string
): Promise<DiscordInteractionResponse> {
  const subAdd = rootOptions.find((o) => o.name === "add");
  const subRemove = rootOptions.find((o) => o.name === "remove");
  const subAddOmnidex = rootOptions.find((o) => o.name === "add-omnidex");
  const subNotify = rootOptions.find((o) => o.name === "notify");
  const subView = rootOptions.find((o) => o.name === "view");

  // Subcommand: /wantlist add
  if (subAdd) {
    const cardInput = getOptionValue(subAdd.options, "card");
    if (!cardInput) {
      return createEphemeralEmbed(
        "Missing Card",
        "Please specify a card: `/wantlist add card: <name>`.",
        DISCORD_COLORS.RED
      );
    }

    const quantityVal = getOptionValue(subAdd.options, "quantity");
    const desiredQty = quantityVal ? Number(quantityVal) : 1;
    const foilVal = getOptionValue(subAdd.options, "foil");
    const foil = foilVal !== undefined ? Boolean(foilVal) : null;

    const card = await findCardBySlugOrName(String(cardInput).trim(), database as any);
    if (!card) {
      return createEphemeralEmbed(
        "Card Not Found",
        `Couldn't find a card matching "${cardInput}". Please pick a suggestion from the autocomplete list.`,
        DISCORD_COLORS.RED
      );
    }

    const want = await upsertPersonalWant(
      {
        collectorId: collector.id,
        cardSlug: card.slug,
        desiredQuantity: desiredQty,
        foil,
        source: "manual",
      },
      database as any
    );

    if (!want.success) {
      return createEphemeralEmbed(
        "Card Not Found",
        `Couldn't add "${cardInput}" to your Personal Wants.`,
        DISCORD_COLORS.RED
      );
    }

    return createEphemeralEmbed(
      "🎯 Added to Personal Wants!",
      `Added **${want.item.desiredQuantity}x ${want.item.cardName}** (${
        want.item.foil === true ? "★ Foil" : want.item.foil === false ? "Normal" : "Any Finish"
      }) to your Personal Wants.\nView your complete list with \`/wantlist view\`.`,
      DISCORD_COLORS.GREEN
    );
  }

  // Subcommand: /wantlist remove
  if (subRemove) {
    const cardInput = getOptionValue(subRemove.options, "card");
    if (!cardInput) {
      return createEphemeralEmbed(
        "Missing Card",
        "Please specify a card to remove: `/wantlist remove card: <name>`.",
        DISCORD_COLORS.RED
      );
    }

    const qtyVal = getOptionValue(subRemove.options, "quantity");
    const removeQty = qtyVal ? Number(qtyVal) : undefined;

    // Resolve display name or slug to the canonical slug stored on the want.
    const card = await findCardBySlugOrName(String(cardInput).trim(), database as any);
    const cardSlug = card ? card.slug : String(cardInput).trim();
    const displayName = card ? card.name : String(cardInput);

    const res = await removePersonalWant(
      collector.id,
      cardSlug,
      removeQty,
      database as any
    );

    if (!res.success) {
      return createEphemeralEmbed(
        "Card Not in Wants",
        `"${displayName}" was not found in your Personal Wants.`,
        DISCORD_COLORS.RED
      );
    }

    return createEphemeralEmbed(
      "Removed from Personal Wants",
      res.removed
        ? `Removed **${displayName}** completely from your Personal Wants.`
        : `Decremented quantity. **${res.remainingQuantity}** remaining in your Personal Wants.`,
      DISCORD_COLORS.GREEN
    );
  }

  // Subcommand: /wantlist add-omnidex
  if (subAddOmnidex) {
    const url = getOptionValue(subAddOmnidex.options, "url");
    if (!url) {
      return buildWantlistAddOmnidexModal();
    }

    try {
      const fetched = await fetchDeckFromUrl(String(url).trim());
      const res = await importOmnidexDeckToPersonalWants(
        collector.id,
        fetched.decklist,
        database
      );

      return createEphemeralEmbed(
        "🎯 Omnidex Wantlist Gap Imported!",
        `Added **${res.addedCardsCount}** missing card${
          res.addedCardsCount === 1 ? "" : "s"
        } (**${res.addedCopiesCount}** total copies) to your Personal Wants.\n\n✨ **${
          res.skippedCopiesCount
        }** copies were already owned in your Binder and skipped.`,
        DISCORD_COLORS.GREEN
      );
    } catch (err: any) {
      return createEphemeralEmbed(
        "Import Failed",
        err?.message || "Could not fetch or parse deck from the provided URL.",
        DISCORD_COLORS.RED
      );
    }
  }

  // Subcommand: /wantlist notify
  if (subNotify) {
    const enableVal = getOptionValue(subNotify.options, "enable");
    if (enableVal === undefined) {
      const current = await getWantlistNotificationPreference(
        collector.id,
        "discord",
        database as any
      );
      return createEphemeralEmbed(
        "Marketplace Deal Notifications",
        `Status: **${current ? "Enabled 🔔" : "Disabled 🔕"}**\n\nRun \`/wantlist notify enable: true\` to receive private bot DMs when marketplace sellers list cards you need.`,
        current ? DISCORD_COLORS.GREEN : DISCORD_COLORS.GOLD
      );
    }

    const enabled = Boolean(enableVal);
    await setWantlistNotificationPreference(
      collector.id,
      "discord",
      enabled,
      database as any
    );

    let dmSent = false;
    if (enabled && discordUserId) {
      dmSent = await sendDiscordDirectMessage(discordUserId, {
        title: "🔔 Deal Alerts Activated!",
        description: `Hey **${collector.name || "Collector"}**! I'll notify you here whenever any of your wantlist cards or deck shortages are for sale on the marketplace!`,
        color: DISCORD_COLORS.GREEN,
        fields: [
          {
            name: "How it works",
            value: "Whenever stores list cards matching your active Decks or Personal Wants, you'll receive a direct message with card details, prices, and store links.",
            inline: false,
          },
        ],
        footer: { text: "Manage notifications anytime with /wantlist notify" },
      });
    }

    const description = enabled
      ? (dmSent
          ? "🔔 Deal notifications **Enabled**! Check your DMs—I've sent you a confirmation message! 📬"
          : "🔔 Deal notifications **Enabled**! You will receive private DMs when stores list cards matching your wants.")
      : "🔕 Deal notifications **Disabled**.";

    return createEphemeralEmbed(
      "Notification Preference Updated",
      description,
      enabled ? DISCORD_COLORS.GREEN : DISCORD_COLORS.GOLD
    );
  }

  // Subcommand: /wantlist view [deck]
  const optionalDeck =
    getOptionValue(subView?.options, "deck") || getOptionValue(rootOptions, "deck");

  try {
    const wantlist = await getDeckPartitionedWantlist(
      collector.id,
      optionalDeck ? String(optionalDeck) : undefined,
      database
    );
    const personalWants = await listPersonalWants(collector.id, database as any);

    const hasDeckShortages = wantlist.decks.length > 0;
    const hasPersonalWants = !optionalDeck && personalWants.length > 0;

    if (!hasDeckShortages && !hasPersonalWants) {
      return createEphemeralEmbed(
        "Wantlist",
        optionalDeck
          ? `Zero shortages for **${optionalDeck}**! Your collection fully covers this decklist.`
          : "Zero shortages across your decks and zero active personal wants! 🎉\nAdd wishlist cards anytime with `/wantlist add card: <name>`.",
        DISCORD_COLORS.GREEN
      );
    }

    const fields: DiscordEmbedField[] = [];

    // Deck Shortages
    for (const group of wantlist.decks) {
      const items: string[] = [];
      for (const h of group.hardShortages) {
        items.push(`🔴 ${h.cardName} x${h.missingQuantity}`);
      }
      for (const s of group.sharedShortages) {
        items.push(`🟡 ${s.cardName} x${s.sharedQuantity}`);
      }

      fields.push({
        name: `**${group.deckName}** (${group.totalShortages} shortages)`,
        value: items.join("\n").slice(0, 1024) || "No shortages",
        inline: false,
      });
    }

    // Direct Wants section (when viewing aggregate wantlist)
    let grandTotalPersonal = 0;
    if (!optionalDeck && personalWants.length > 0) {
      const wantLines = personalWants.map((w) => {
        grandTotalPersonal += w.desiredQuantity;
        const finish = w.foil === true ? "★ Foil" : w.foil === false ? "Normal" : "";
        const price = w.targetMaxPrice ? ` (Max: R$ ${w.targetMaxPrice.toFixed(2)})` : "";
        return `• **${w.cardName}** x${w.desiredQuantity} ${finish}${price}`.trim();
      });

      fields.push({
        name: `🎯 Direct Wants (${personalWants.length})`,
        value: wantLines.join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: optionalDeck
              ? `Wantlist: ${optionalDeck}`
              : `Aggregate Wantlist (${wantlist.totalDecks} Decks, ${personalWants.length} Direct Wants)`,
            description: `Total: **${wantlist.grandTotalHard}** Hard (🔴) | **${
              wantlist.grandTotalShared
            }** Shared (🟡)${!optionalDeck ? ` | **${grandTotalPersonal}** Direct (🎯)` : ""}`,
            color: DISCORD_COLORS.GOLD,
            fields,
          },
        ],
      },
    };
  } catch {
    return createEphemeralEmbed(
      "Deck Not Found",
      `Could not find a deck matching "${optionalDeck}". Run \`/decks\` to see your active decks.`,
      DISCORD_COLORS.RED
    );
  }
}
