import {
  resolveCollectorByPlatform,
  getCollectorDecks,
} from "../collector-assistant";
import { searchCardsForAutocomplete } from "../../db/repositories/catalog-repository";
import { listPersonalWants } from "../../db/repositories/personal-wants-repository";
import type {
  DiscordInteractionPayload,
  DiscordInteractionResponse,
  DiscordAutocompleteChoice,
  DiscordInteractionDataOption,
} from "./types";

/**
 * Traverses nested command options to locate the currently focused input.
 */
function findFocusedOption(
  options?: DiscordInteractionDataOption[]
): { name: string; value: string } | null {
  if (!options) return null;
  for (const opt of options) {
    if (opt.focused) {
      return { name: opt.name, value: opt.value ? String(opt.value) : "" };
    }
    if (opt.options && opt.options.length > 0) {
      const nested = findFocusedOption(opt.options);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * Handles Discord Autocomplete requests (type: 4) returning suggestions in under 50ms (type: 8).
 */
export async function handleDiscordAutocomplete(
  payload: DiscordInteractionPayload,
  database?: unknown
): Promise<DiscordInteractionResponse> {
  const discordUser = payload.user || payload.member?.user;
  if (!discordUser) {
    return {
      type: 8,
      data: { choices: [] },
    };
  }

  const focused = findFocusedOption(payload.data?.options);
  if (!focused) {
    return {
      type: 8,
      data: { choices: [] },
    };
  }

  const query = focused.value.toLowerCase().trim();

  // Autocomplete for catalog cards does not strictly require linked account,
  // but if it's for wants remove or user decks, user must be linked.
  if (focused.name === "card") {
    // Check if subcommand is "remove"
    const subOption = payload.data?.options?.find(
      (o) => o.name === "remove" && o.options
    );
    if (subOption) {
      const resolved = await resolveCollectorByPlatform("discord", discordUser.id, database);
      if (!resolved) {
        return {
          type: 8,
          data: {
            choices: [
              {
                name: "Link your GA Binder account with /link <code>",
                value: "",
              },
            ],
          },
        };
      }

      const personalWants = await listPersonalWants(resolved.collector.id, database as any);
      const matches = personalWants.filter((w) =>
        w.cardName.toLowerCase().includes(query) || w.cardSlug.toLowerCase().includes(query)
      );

      const choices: DiscordAutocompleteChoice[] = matches.slice(0, 25).map((w) => ({
        name: `${w.cardName} (Wanted: ${w.desiredQuantity})`.slice(0, 100),
        value: w.cardSlug,
      }));

      return {
        type: 8,
        data: { choices },
      };
    }

    // Otherwise autocompleting catalog cards (e.g. /wantlist add card: <...>)
    const catalogCards = await searchCardsForAutocomplete(query, 25, database as any);
    const choices: DiscordAutocompleteChoice[] = catalogCards.map((c) => {
      const label = `${c.name} (${c.element} ${c.type})`.slice(0, 100);
      return {
        name: label,
        value: c.slug,
      };
    });

    return {
      type: 8,
      data: { choices },
    };
  }

  if (focused.name === "deck") {
    const resolved = await resolveCollectorByPlatform("discord", discordUser.id, database);
    if (!resolved) {
      return {
        type: 8,
        data: {
          choices: [
            {
              name: "Link your GA Binder account with /link <code>",
              value: "",
            },
          ],
        },
      };
    }

    const decks = await getCollectorDecks(resolved.collector.id, database);
    const matches = query
      ? decks.filter(
          (d) =>
            d.name.toLowerCase().includes(query) ||
            (d.champion && d.champion.toLowerCase().includes(query))
        )
      : decks;

    const choices: DiscordAutocompleteChoice[] = matches.slice(0, 25).map((d) => ({
      name: `${d.name} (${d.champion || "No Champion"} - ${d.format})`.slice(0, 100),
      value: d.name,
    }));

    return {
      type: 8,
      data: { choices },
    };
  }

  return {
    type: 8,
    data: { choices: [] },
  };
}
