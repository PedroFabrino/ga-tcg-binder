"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCollectionCommand = handleCollectionCommand;
async function handleCollectionCommand(argString, userId, client) {
    const query = argString.trim();
    // 1. Portfolio summary when no search query is specified
    if (!query) {
        const res = await client.getPortfolio(userId);
        const p = res.portfolio;
        const elementRows = p.elements.length > 0
            ? p.elements
                .slice(0, 6)
                .map((e) => `• **${e.element.toUpperCase()}**: ${e.count} cards`)
                .join("\n")
            : "• No cards recorded yet";
        return (`### 💼 **${p.collectorName || "Collector"}'s Binder Portfolio**\n` +
            `Friend Code: **${p.friendCode || "Unset"}** | [Open Web Profile](${p.profileUrl})\n\n` +
            `• **Total Cards:** **${p.totalCards}** (${p.uniqueCards} unique)\n` +
            `• **Finishes:** ${p.foilCards} ★ Foil | ${p.normalCards} Normal\n` +
            `• **Allocation:** ${p.dedicatedCards} Dedicated to decks | ${p.idleCards} Idle in binder\n\n` +
            `**Top Elements:**\n${elementRows}\n\n` +
            `*Use \`/collection <card_name>\` to search specific card printings in your binder.*`);
    }
    // 2. Collection card search
    const res = await client.searchCollection(userId, query);
    if (res.cards.length === 0) {
        return `🔍 **Collection Search: "${query}"**\nNo matching cards found in your personal Binder.`;
    }
    const lines = [
        `### 🔍 **Collection Search: "${query}"** (${res.cards.length} match${res.cards.length > 1 ? "es" : ""})`,
    ];
    for (const card of res.cards.slice(0, 5)) {
        lines.push(`- **${card.cardName}** (${card.element} ${card.type}) — Total: **${card.totalOwned}**`);
        lines.push(`  - Dedicated: ${card.dedicatedTotal} | Idle: ${card.idleTotal}`);
        for (const p of card.printings) {
            lines.push(`  - • ${p.setPrefix}-${p.collectorNumber} ${p.foil ? "★ Foil" : "Normal"} x${p.quantity} (${p.isDedicated ? "Dedicated" : "Idle"})`);
        }
    }
    return lines.join("\n");
}
