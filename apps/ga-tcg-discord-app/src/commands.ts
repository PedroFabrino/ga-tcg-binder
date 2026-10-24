/**
 * Discord Slash Command Definitions for GA TCG Collector Assistant.
 */

export interface DiscordCommandOption {
  name: string;
  description: string;
  type: number; // 1 = SUB_COMMAND, 3 = STRING, 4 = INTEGER, 5 = BOOLEAN
  required?: boolean;
  autocomplete?: boolean;
  options?: DiscordCommandOption[];
}

export interface DiscordCommandDefinition {
  name: string;
  description: string;
  options?: DiscordCommandOption[];
}

export const ASSISTANT_COMMANDS: DiscordCommandDefinition[] = [
  {
    name: "register",
    description: "Create a Grand Archive Binder account directly using your Discord profile",
  },
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
    description: "Inspect or import your Grand Archive constructed decks",
    options: [
      {
        name: "overview",
        description: "List your active decks with sleeve completion and interactive menu",
        type: 1, // SUB_COMMAND
      },
      {
        name: "add",
        description: "Import an Omnidex deck from a URL or multiline text",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "url",
            description: "Optional Omnidex.gg / Silvie.gg / GrandArchiveStats URL to import",
            type: 3,
            required: false,
          },
        ],
      },
    ],
  },
  {
    name: "shortages",
    description: "View Hard Shortages (Compra Necessária) and Shared Shortages for a deck",
    options: [
      {
        name: "deck",
        description: "Name or ID of the deck (leave empty to select from menu)",
        type: 3,
        required: false,
        autocomplete: true,
      },
    ],
  },
  {
    name: "collection",
    description: "View collection portfolio dashboard or search cards by name",
    options: [
      {
        name: "query",
        description: "Card name to search (leave empty to view portfolio dashboard)",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "wantlist",
    description: "Manage aggregate wantlist, personal wishlist, and deal alerts",
    options: [
      {
        name: "view",
        description: "View aggregate wantlist of deck shortages and direct personal wants",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "deck",
            description: "Optional deck to filter shortages for",
            type: 3,
            required: false,
            autocomplete: true,
          },
        ],
      },
      {
        name: "add",
        description: "Add a card to your personal wishlist",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "card",
            description: "Card name to add to your wishlist",
            type: 3,
            required: true,
            autocomplete: true,
          },
          {
            name: "quantity",
            description: "Desired quantity (defaults to 1)",
            type: 4,
            required: false,
          },
          {
            name: "foil",
            description: "Prefer foil printing finish",
            type: 5,
            required: false,
          },
        ],
      },
      {
        name: "remove",
        description: "Remove or decrement a card from your personal wishlist",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "card",
            description: "Card name currently in your wishlist to remove",
            type: 3,
            required: true,
            autocomplete: true,
          },
          {
            name: "quantity",
            description: "Quantity to decrement (omitting removes entire entry)",
            type: 4,
            required: false,
          },
        ],
      },
      {
        name: "add-omnidex",
        description: "Import only the unowned card shortage gap from an Omnidex deck into personal wants",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "url",
            description: "Optional Omnidex.gg / Silvie.gg URL (leave empty to paste raw text)",
            type: 3,
            required: false,
          },
        ],
      },
      {
        name: "notify",
        description: "Toggle marketplace deal alert Direct Messages for wanted cards",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "enable",
            description: "Enable (True) or Disable (False) private bot deal alert DMs",
            type: 5,
            required: false,
          },
        ],
      },
    ],
  },
];
