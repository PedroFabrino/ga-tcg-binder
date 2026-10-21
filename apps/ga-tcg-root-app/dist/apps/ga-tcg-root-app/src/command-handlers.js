"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssistantClient = getAssistantClient;
exports.processRootCommand = processRootCommand;
exports.registerRootCommandHandlers = registerRootCommandHandlers;
const contracts_1 = require("@ga/contracts");
const server_bot_1 = require("@rootsdk/server-bot");
function getAssistantClient() {
    const baseUrl = process.env.ASSISTANT_API_BASE_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3002";
    const assistantToken = process.env.ASSISTANT_API_SECRET || process.env.ASSISTANT_TOKEN;
    return new contracts_1.AssistantClient({ baseUrl, assistantToken });
}
/**
 * Parses and executes a Root slash command from incoming channel messages.
 * Returns the markdown reply string, or null if message is not a recognized command.
 */
async function processRootCommand(userId, messageContent, client = getAssistantClient()) {
    const trimmed = messageContent.trim();
    if (!trimmed.startsWith("/"))
        return null;
    const [command, ...args] = trimmed.slice(1).split(/\s+/);
    const argString = args.join(" ").trim();
    try {
        // 1. /link <code>
        if (command === "link") {
            if (!argString) {
                return "⚠️ **Usage:** `/link <code>`\nProvide the 6-character pairing code from **Settings > Linked Accounts** in GA Binder.";
            }
            const res = await client.link({
                token: argString.toUpperCase(),
                provider: "root",
                providerUserId: userId,
            });
            return `✅ **Account Linked Successfully!**\nYour Root account is now paired to **${res.collectorName || "Collector"}**.\n\nYou can now use \`/decks\`, \`/shortages\`, \`/collection\`, and \`/wantlist\`!`;
        }
        // 2. /decks
        if (command === "decks") {
            const res = await client.getDecks("root", userId);
            if (res.decks.length === 0) {
                return `🗃️ **${res.collectorName || "Collector"}'s Decks**\nYou don't have any saved decks yet. Create one in the GA Binder web app!`;
            }
            const lines = [`### 🗃️ **${res.collectorName || "Collector"}'s Decks (${res.decks.length})**`];
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
        // 3. /shortages <deck>
        if (command === "shortages") {
            if (!argString) {
                return "⚠️ **Usage:** `/shortages <deck_name>`\nPlease specify which deck to check.";
            }
            const shortages = await client.getShortages("root", userId, argString);
            const isComplete = shortages.hardShortages.length === 0 && shortages.sharedShortages.length === 0;
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
                    const contending = s.competingDecks.length > 0 ? ` *(used in ${s.competingDecks.join(", ")})*` : "";
                    lines.push(`- **${s.cardName}** x${s.sharedQuantity} shared${contending}`);
                }
            }
            return lines.join("\n");
        }
        // 4. /collection <query>
        if (command === "collection") {
            if (!argString) {
                return "⚠️ **Usage:** `/collection <card_name>`\nPlease specify a card name to search.";
            }
            const res = await client.searchCollection("root", userId, argString);
            if (res.cards.length === 0) {
                return `🔍 **Collection Search: "${argString}"**\nNo matching cards found in your personal Binder.`;
            }
            const lines = [`### 🔍 **Collection Search: "${argString}"** (${res.cards.length} match${res.cards.length > 1 ? "es" : ""})`];
            for (const card of res.cards.slice(0, 5)) {
                lines.push(`- **${card.cardName}** (${card.element} ${card.type}) — Total: **${card.totalOwned}**`);
                lines.push(`  - Dedicated: ${card.dedicatedTotal} | Idle: ${card.idleTotal}`);
                for (const p of card.printings) {
                    lines.push(`  - • ${p.setPrefix}-${p.collectorNumber} ${p.foil ? "★ Foil" : "Normal"} x${p.quantity} (${p.isDedicated ? "Dedicated" : "Idle"})`);
                }
            }
            return lines.join("\n");
        }
        // 5. /wantlist [deck]
        if (command === "wantlist") {
            const wantlist = await client.getWantlist("root", userId, argString || undefined);
            if (wantlist.decks.length === 0) {
                return "📋 **Wantlist**\nZero shortages detected across your active decks! Your collection fully covers them.";
            }
            const lines = [
                `### 📋 **Wantlist (${wantlist.totalDecks} Deck${wantlist.totalDecks > 1 ? "s" : ""})**`,
                `Grand Total: **${wantlist.grandTotalHard}** Hard (🔴) | **${wantlist.grandTotalShared}** Shared (🟡)\n`,
            ];
            for (const group of wantlist.decks) {
                lines.push(`**${group.deckName}** (${group.totalShortages} shortages):`);
                for (const h of group.hardShortages) {
                    lines.push(`- 🔴 **${h.cardName}** x${h.missingQuantity}`);
                }
                for (const s of group.sharedShortages) {
                    lines.push(`- 🟡 **${s.cardName}** x${s.sharedQuantity}`);
                }
                lines.push("");
            }
            return lines.join("\n");
        }
        return null;
    }
    catch (err) {
        if (err instanceof contracts_1.AssistantApiError) {
            if (err.code === "IDENTITY_NOT_LINKED") {
                return "⚠️ **Grand Archive Binder Account Not Linked**\nLink your account first:\n1. Open GA Binder > **Settings > Linked Accounts**\n2. Click **Generate Code**\n3. Run `/link <code>` here in Root.";
            }
            if (err.code === "DECK_NOT_FOUND") {
                return `⚠️ **Deck Not Found**\nCould not find a deck matching "${argString}". Run \`/decks\` to see all your active decks.`;
            }
            return `⚠️ **Assistant Error:** ${err.message}`;
        }
        return `⚠️ **Error executing command:** ${err?.message || "Unknown error"}`;
    }
}
/**
 * Subscribes to Root channel messages and executes assistant commands.
 */
function registerRootCommandHandlers() {
    server_bot_1.rootServer.community.channelMessages.on("channelMessage.created", async (evt) => {
        if (evt.messageType === server_bot_1.MessageType.System)
            return;
        if (!evt.messageContent || !evt.messageContent.startsWith("/"))
            return;
        const reply = await processRootCommand(evt.userId, evt.messageContent);
        if (!reply)
            return;
        try {
            await server_bot_1.rootServer.community.channelMessages.create({
                channelId: evt.channelId,
                content: reply,
            });
        }
        catch (err) {
            console.error("Failed to send Root message reply:", err);
        }
    });
}
