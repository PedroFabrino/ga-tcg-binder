/**
 * Discord Slash Command Definitions for GA TCG Collector Assistant.
 */

export interface DiscordCommandOption {
  name: string;
  description: string;
  type: number; // 3 = STRING, 4 = INTEGER, etc.
  required?: boolean;
}

export interface DiscordCommandDefinition {
  name: string;
  description: string;
  options?: DiscordCommandOption[];
}

export const ASSISTANT_COMMANDS: DiscordCommandDefinition[] = [
  {
    name: "link",
    description: "Link your Grand Archive Binder account using a 6-character code",
    options: [
      {
        name: "code",
        description: "The 6-character pairing code from Settings > Linked Accounts",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "decks",
    description: "List your Grand Archive decks with sleeve completion rates",
  },
  {
    name: "shortages",
    description: "View Hard Shortages (Compra Necessária) and Shared Shortages for a deck",
    options: [
      {
        name: "deck",
        description: "Name or ID of the deck",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "collection",
    description: "Search your personal Binder collection by card name",
    options: [
      {
        name: "query",
        description: "Card name to search",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "wantlist",
    description: "Generate an aggregated wantlist partitioned by deck",
    options: [
      {
        name: "deck",
        description: "Optional deck name to filter by",
        type: 3,
        required: false,
      },
    ],
  },
];
