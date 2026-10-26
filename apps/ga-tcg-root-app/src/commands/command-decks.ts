import type { RootBotApi } from "../root-bot-api";

export async function handleDecksCommand(
  argString: string,
  userId: string,
  client: RootBotApi
): Promise<string> {
  const parts = argString.split(/\s+/).filter(Boolean);
  const subCommand = parts[0]?.toLowerCase();

  // /decks add <url>
  if (subCommand === "add") {
    const url = parts.slice(1).join(" ").trim();
    if (!url) {
      return (
        "⚠️ **Usage:** `/decks add <url>`\n" +
        "Provide an Omnidex.gg, Silvie.gg, or GrandArchiveStats deck URL to import into your collection."
      );
    }

    const res = await client.importDeck(userId, { url });
    return (
      `🎉 **Deck "${res.deck.name}" Imported Successfully!**\n` +
      `The deck was parsed and added to your collection.\n` +
      `• Use \`/decks\` to see all your active decks.\n` +
      `• Use \`/shortages ${res.deck.name}\` to inspect needed cards.`
    );
  }

  // /decks update <deck> <url>
  if (subCommand === "update") {
    const remaining = parts.slice(1).join(" ").trim();
    const lastSpace = remaining.lastIndexOf(" ");
    let targetQuery = "";
    let url = "";

    if (lastSpace !== -1) {
      targetQuery = remaining.slice(0, lastSpace).trim();
      url = remaining.slice(lastSpace + 1).trim();
    }

    if (!targetQuery || !url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return (
        "⚠️ **Usage:** `/decks update <deck_name> <url>`\n" +
        "Provide your deck name and the updated Omnidex.gg or Silvie.gg deck URL."
      );
    }

    const decksList = await client.getDecks(userId);
    const cleanTarget = targetQuery.toLowerCase();
    const match =
      decksList.decks.find((d) => d.id === targetQuery) ||
      decksList.decks.find((d) => d.name.toLowerCase() === cleanTarget) ||
      decksList.decks.find((d) => d.name.toLowerCase().includes(cleanTarget));

    if (!match) {
      return `❌ **Deck "${targetQuery}" not found.** Use \`/decks\` to see all your active decks.`;
    }

    const res = await client.updateDeck(userId, { deckId: match.id, url });
    return (
      `🎉 **Deck "${res.deck.name}" Updated Successfully!**\n` +
      `The updated decklist has replaced the existing cards.\n` +
      `• Use \`/shortages ${res.deck.name}\` to inspect updated shortages.`
    );
  }

  // /decks or /decks overview
  const res = await client.getDecks(userId);
  if (res.decks.length === 0) {
    return (
      `🗃️ **${res.collectorName || "Collector"}'s Decks**\n` +
      `You don't have any saved decks yet.\n` +
      `• Import one with \`/decks add <omnidex_url>\`\n` +
      `• Or create one in the GA Binder web app!`
    );
  }

  const lines = [
    `### 🗃️ **${res.collectorName || "Collector"}'s Decks (${res.decks.length})**`,
  ];
  for (const deck of res.decks) {
    const icon = deck.completionPercentage === 100 ? "✅" : "⚠️";
    lines.push(`- **${deck.name}** (${deck.format})`);
    lines.push(
      `  - Champion: **${deck.champion || "None"}** | Cards: ${deck.totalCards} (${deck.uniqueCards} unique)`
    );
    lines.push(`  - Completion: **${deck.completionPercentage}%** ${icon}`);
    if (deck.hardShortageCount > 0) {
      lines.push(`  - 🔴 Hard Shortages: **${deck.hardShortageCount}**`);
    }
    if (deck.sharedShortageCount > 0) {
      lines.push(`  - 🟡 Shared Shortages: **${deck.sharedShortageCount}**`);
    }
  }
  lines.push("\n*Use `/shortages <deck>` to see itemized shortages.*");
  return lines.join("\n");
}
