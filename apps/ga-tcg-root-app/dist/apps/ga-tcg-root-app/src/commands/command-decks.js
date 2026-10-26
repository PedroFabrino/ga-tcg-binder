"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDecksCommand = handleDecksCommand;
async function handleDecksCommand(argString, userId, client) {
    const parts = argString.split(/\s+/).filter(Boolean);
    const subCommand = parts[0]?.toLowerCase();
    // /decks add <url | text>
    if (subCommand === "add") {
        const rawInput = argString.slice(argString.indexOf("add") + 3).trim();
        if (!rawInput) {
            return ("⚠️ **Usage:** `/decks add <url | text>`\n" +
                "Provide an Omnidex.gg/Silvie.gg URL or paste raw decklist text (Material Deck / Main Deck / Sideboard).");
        }
        const isUrl = rawInput.startsWith("http://") || rawInput.startsWith("https://");
        const res = await client.importDeck(userId, isUrl ? { url: rawInput } : { text: rawInput });
        return (`🎉 **Deck "${res.deck.name}" Imported Successfully!**\n` +
            `The deck was parsed and added to your collection.\n` +
            `• Use \`/decks\` to see all your active decks.\n` +
            `• Use \`/shortages ${res.deck.name}\` to inspect needed cards.`);
    }
    // /decks update <deck> <url | text>
    if (subCommand === "update") {
        const remaining = argString.slice(argString.indexOf("update") + 6).trim();
        const firstNewline = remaining.indexOf("\n");
        let targetQuery = "";
        let url = "";
        let text = "";
        if (firstNewline !== -1) {
            targetQuery = remaining.slice(0, firstNewline).trim();
            const rest = remaining.slice(firstNewline + 1).trim();
            if (rest.startsWith("http://") || rest.startsWith("https://")) {
                url = rest;
            }
            else {
                text = rest;
            }
        }
        else {
            const lastSpace = remaining.lastIndexOf(" ");
            if (lastSpace !== -1) {
                targetQuery = remaining.slice(0, lastSpace).trim();
                const candidate = remaining.slice(lastSpace + 1).trim();
                if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
                    url = candidate;
                }
                else {
                    text = candidate;
                }
            }
        }
        if (!targetQuery || (!url && !text)) {
            return ("⚠️ **Usage:** `/decks update <deck_name> <url | text>`\n" +
                "Provide your deck name and the updated Omnidex/Silvie URL or pasted decklist text.");
        }
        const decksList = await client.getDecks(userId);
        const cleanTarget = targetQuery.toLowerCase();
        const match = decksList.decks.find((d) => d.id === targetQuery) ||
            decksList.decks.find((d) => d.name.toLowerCase() === cleanTarget) ||
            decksList.decks.find((d) => d.name.toLowerCase().includes(cleanTarget));
        if (!match) {
            return `❌ **Deck "${targetQuery}" not found.** Use \`/decks\` to see all your active decks.`;
        }
        const res = await client.updateDeck(userId, {
            deckId: match.id,
            url: url || undefined,
            text: text || undefined,
        });
        return (`🎉 **Deck "${res.deck.name}" Updated Successfully!**\n` +
            `The updated decklist has replaced the existing cards.\n` +
            `• Use \`/shortages ${res.deck.name}\` to inspect updated shortages.`);
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
