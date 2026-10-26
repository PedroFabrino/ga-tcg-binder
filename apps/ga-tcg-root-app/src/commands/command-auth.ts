import type { RootBotApi } from "../root-bot-api";

export async function handleLinkCommand(
  argString: string,
  userId: string,
  client: RootBotApi
): Promise<string> {
  if (!argString) {
    return "⚠️ **Usage:** `/link <code>`\nProvide the 6-character pairing code from **Settings > Linked Accounts** in GA Binder.";
  }

  const res = await client.link({
    token: argString.toUpperCase(),
    provider: "root",
    providerUserId: userId,
  });

  return `✅ **Account Linked Successfully!**\nYour Root account is now paired to **${
    res.collectorName || "Collector"
  }**.\n\nYou can now use \`/decks\`, \`/shortages\`, \`/collection\`, and \`/wantlist\`!`;
}

export async function handleRegisterCommand(
  userId: string,
  client: RootBotApi
): Promise<string> {
  const res = await client.register(userId);
  const collector = res.collector;

  if (res.created) {
    return (
      `🎉 **Account Created Successfully!**\n` +
      `Your Root profile is now registered and linked to **${collector.name || "Collector"}**.\n` +
      `Friend Code: **${collector.friendCode}**\n\n` +
      `You can now use:\n` +
      `• \`/decks\` — View your decks and shortages\n` +
      `• \`/wantlist\` — Wishlist and deal alerts\n` +
      `• \`/collection\` — Portfolio summary & card search`
    );
  }

  return (
    `ℹ️ **Account Already Registered**\n` +
    `Your Root profile is already linked to **${collector.name || "Collector"}** (Friend Code: **${collector.friendCode}**).\n` +
    `Use \`/decks\`, \`/shortages\`, \`/collection\`, or \`/wantlist\` to get started!`
  );
}
