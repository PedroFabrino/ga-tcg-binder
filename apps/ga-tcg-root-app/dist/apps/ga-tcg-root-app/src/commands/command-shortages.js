"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleShortagesCommand = handleShortagesCommand;
async function handleShortagesCommand(argString, userId, client) {
    const deckQuery = argString.trim();
    // If no deck specified, list decks with shortage badges
    if (!deckQuery) {
        const res = await client.getDecks(userId);
        if (res.decks.length === 0) {
            return ("⚠️ **No Decks Found**\n" +
                "You don't have any saved decks yet. Import one with `/decks add <url>`!");
        }
        const lines = [
            `### 📊 **${res.collectorName || "Collector"}'s Decks — Shortages Overview**`,
            "Run `/shortages <deck_name>` to inspect itemized cards:\n",
        ];
        for (const d of res.decks) {
            const totalShortages = d.hardShortageCount + d.sharedShortageCount;
            const status = totalShortages === 0
                ? "✅ Ready to sleeve"
                : `🔴 ${d.hardShortageCount} Hard | 🟡 ${d.sharedShortageCount} Shared`;
            lines.push(`- **${d.name}** (${d.completionPercentage}%) — ${status}`);
            lines.push(`  └ \`/shortages ${d.name}\``);
        }
        return lines.join("\n");
    }
    try {
        const shortages = await client.getShortages(userId, deckQuery);
        const isComplete = shortages.hardShortages.length === 0 &&
            shortages.sharedShortages.length === 0;
        if (isComplete) {
            return `🎉 **${shortages.deckName} — 100% Complete!**\nAll required cards are owned with zero shortages. Ready to sleeve!`;
        }
        const lines = [
            `### 📊 **Shortages for ${shortages.deckName}** (${shortages.completionPercentage}%)`,
            `Format: **${shortages.format}** | Total Shortages: **${shortages.totalHardShortages + shortages.totalSharedShortages}**\n`,
        ];
        if (shortages.hardShortages.length > 0) {
            lines.push(`**🔴 Hard Shortages (Compra Necessária — ${shortages.totalHardShortages}):**`);
            for (const h of shortages.hardShortages) {
                lines.push(`- **${h.cardName}** x${h.missingQuantity} missing (needs ${h.requiredQuantity})`);
            }
            lines.push("");
        }
        if (shortages.sharedShortages.length > 0) {
            lines.push(`**🟡 Shared Shortages (Revezamento entre Decks — ${shortages.totalSharedShortages}):**`);
            for (const s of shortages.sharedShortages) {
                const contending = s.competingDecks.length > 0
                    ? ` *(used in ${s.competingDecks.join(", ")})*`
                    : "";
                lines.push(`- **${s.cardName}** x${s.sharedQuantity} shared${contending}`);
            }
        }
        return lines.join("\n");
    }
    catch (err) {
        // Attempt deck autocomplete to suggest alternatives
        try {
            const auto = await client.autocomplete(userId, "deck", deckQuery);
            if (auto.results.length > 0) {
                return (`⚠️ **Deck "${deckQuery}" Not Found**\nDid you mean one of these active decks?\n` +
                    auto.results.map((r) => `• \`/shortages ${r.name}\``).join("\n"));
            }
        }
        catch {
            // Fall through to rethrow
        }
        throw err;
    }
}
