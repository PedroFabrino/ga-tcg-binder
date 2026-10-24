import {
  registerCollectorFromPlatform,
  type CollectorProfile,
} from "../collector-assistant";
import {
  DISCORD_COLORS,
  type DiscordEmbed,
  type DiscordActionRowComponent,
  type DiscordInteractionResponse,
} from "./types";

/**
 * Builds the guidance embed shown when a Discord user has not linked an account.
 */
export function buildUnlinkedAccountEmbed(): DiscordEmbed {
  return {
    title: "Grand Archive Binder Account Not Linked",
    description:
      "You haven't linked your Grand Archive Binder account yet.\n\n" +
      "• **New here?** Click **Create Account with Discord** to get started right away!\n" +
      "• **Have a web account?** Click **Link Existing Account** or run `/link <code>` with your pairing code.",
    color: DISCORD_COLORS.GOLD,
  };
}

/**
 * Builds action row buttons allowing direct account creation or linking guidance.
 */
export function buildUnlinkedAccountActionRow(): DiscordActionRowComponent {
  return {
    type: 1, // ActionRow
    components: [
      {
        type: 2, // Button
        custom_id: "register_discord_account",
        style: 3, // Success
        label: "Create Account with Discord",
        emoji: { name: "✨" },
      },
      {
        type: 2, // Button
        custom_id: "help_link_account",
        style: 2, // Secondary
        label: "Link Existing Account",
        emoji: { name: "🔗" },
      },
    ],
  };
}

/**
 * Builds the embed celebrating successful account creation.
 */
export function buildAccountCreatedEmbed(collector: CollectorProfile): DiscordEmbed {
  return {
    title: "🎉 Account Created Successfully!",
    description:
      `Welcome to Grand Archive Binder, **${collector.name || "Collector"}**!\n\n` +
      `Your personal Friend Code is **\`${collector.friendCode}\`**.\n\n` +
      `You're all set to use:\n` +
      `• \`/decks\` — Browse, inspect, or import Omnidex decklists\n` +
      `• \`/shortages\` — Check missing cards and sleeve shortages\n` +
      `• \`/collection\` — Search your binder or view your portfolio\n` +
      `• \`/wantlist\` — Manage your wishlist and deal notifications\n\n` +
      `*Tip: When you visit the web app, simply click **Sign in with Discord** to access this account!*`,
    color: DISCORD_COLORS.GREEN,
  };
}

/**
 * Builds the embed informing that an account is already linked.
 */
export function buildAccountAlreadyLinkedEmbed(collector: CollectorProfile): DiscordEmbed {
  return {
    title: "Account Already Linked",
    description: `Your Discord account is already linked to **${
      collector.name || "Collector"
    }** (\`${collector.friendCode}\`).\n\nYou can use \`/decks\`, \`/shortages\`, \`/collection\`, and \`/wantlist\`!`,
    color: DISCORD_COLORS.BLUE,
  };
}

/**
 * Handles button interactions for account creation and linking guidance.
 */
export async function handleOnboardingComponent(
  customId: string,
  discordUser: { id: string; username: string },
  database?: unknown
): Promise<DiscordInteractionResponse | null> {
  if (customId === "register_discord_account") {
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

    return {
      type: 7, // UPDATE_MESSAGE
      data: {
        flags: 64,
        embeds: [embed],
        components: [],
      },
    };
  }

  if (customId === "help_link_account") {
    return {
      type: 7, // UPDATE_MESSAGE
      data: {
        flags: 64,
        embeds: [
          {
            title: "Linking Your Existing Web Account",
            description:
              "If you already created an account on the Grand Archive Binder web app:\n\n" +
              "1. Visit the web app and navigate to **Settings > Linked Accounts**.\n" +
              "2. Click **Generate Code** to receive a 6-character pairing code.\n" +
              "3. Run `/link <code>` here in Discord.\n\n" +
              "*Or click below to create a new account using your Discord profile.*",
            color: DISCORD_COLORS.GOLD,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                custom_id: "register_discord_account",
                style: 3,
                label: "Create Account with Discord",
                emoji: { name: "✨" },
              },
            ],
          },
        ],
      },
    };
  }

  return null;
}
