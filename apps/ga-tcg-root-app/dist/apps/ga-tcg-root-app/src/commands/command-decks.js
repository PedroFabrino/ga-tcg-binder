"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDecksCommand = handleDecksCommand;
async function handleDecksCommand(argString, userId, client) {
    const parts = argString.split(/\s+/).filter(Boolean);
    const subCommand = parts[0]?.toLowerCase();
    // /decks add <url>
    if (subCommand === "add") {
        const url = parts.slice(1).join(" ").trim();
        if (!url) {
            return ("⚠️ **Usage:** `/decks add <url>`\n" +
                "Provide an Omnidex.gg, Silvie.gg, or GrandArchiveStats deck URL to import into your collection.");
        }
        const res = await client.importDeck(userId, { url });
        return (`🎉 **Deck "${res.deck.name}" Imported Successfully!**\n` +
            `The deck was parsed and added to your collection.\n` +
            `• Use \`/decks\` to see all your active decks.\n` +
            `• Use \`/shortages ${res.deck.name}\` to inspect needed cards.`);
    }
    // /decks or /decks overview
    const res = await client.getDecks(userId);
    if (res.decks.length === 0) {
        return (`🗃️ **${res.collectorName || "Collector"}'s Decks**\n` +
            `You don't have any saved decks yet.\n` +
            `• Import one with \`/decks add <omnidex_url>\`\n` +
            `• Or create one in the GA Binder web app!`);
    }
    const lines = [
        `### 🗃️ **${res.collectorName || "Collector"}'s Decks (${res.decks.length})**`,
    ];
    for (const deck of res.decks) {
        const icon = deck.completionPercentage === 100 ? "✅" : "⚠️";
        lines.push(`- **${deck.name}** (${deck.format})`);
        lines.push(`  - Champion: **${deck.champion || "None"}** | Cards: ${deck.totalCards} (${deck.uniqueCards} unique)`);
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
