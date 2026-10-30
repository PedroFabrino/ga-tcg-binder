#!/usr/bin/env tsx
import { db, client } from "../src/db";
import { decks } from "../src/db/schema";
import {
  getDeckAdvisorDeckData,
  getDeckAdvisorUserData,
  getDeckAdvisorMetaBenchmarks,
  searchDeckAdvisorCatalogCards,
} from "../src/db/repositories/deck-advisor-repository";
import { assembleDeckAdvisorContext } from "../src/services/deck-advisor-context";
import { buildDeckAdvisorSystemPrompt } from "../src/services/deck-advisor";
import { queryGrandArchiveRules } from "../src/services/deck-advisor-mcp";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  try {
    switch (command) {
      case "list-decks":
      case "decks": {
        const allDecks = await db
          .select({
            id: decks.id,
            name: decks.name,
            champion: decks.champion,
            format: decks.format,
            userId: decks.userId,
          })
          .from(decks);

        console.log(`\nFound ${allDecks.length} deck(s) in database:\n`);
        for (const d of allDecks) {
          console.log(`- [${d.id}] "${d.name}" (Champion: ${d.champion || "None"}, User: ${d.userId})`);
        }
        break;
      }

      case "context": {
        const query = args[1];
        if (!query) {
          console.error("Usage: npx tsx scripts/deck-advisor-cli.ts context <deckIdOrPartialName>");
          process.exit(1);
        }

        const allDecks = await db.select().from(decks);
        const matched = allDecks.find(
          (d) => d.id === query || d.name.toLowerCase().includes(query.toLowerCase())
        );

        if (!matched) {
          console.error(`Deck not found for query "${query}". Available decks:`);
          for (const d of allDecks) console.log(`- ${d.id}: ${d.name}`);
          process.exit(1);
        }

        console.log(`\n=== Loading Context for Deck: "${matched.name}" (${matched.id}) ===`);
        const [deckData, userData, metaBenchmarks] = await Promise.all([
          getDeckAdvisorDeckData(matched.id, db),
          getDeckAdvisorUserData(matched.userId, db),
          getDeckAdvisorMetaBenchmarks(db),
        ]);

        if (!deckData) {
          console.error("Failed to load deck data.");
          process.exit(1);
        }

        const context = assembleDeckAdvisorContext({
          deckData,
          userData,
          metaBenchmarks,
        });

        console.log(`\n--- DECK OVERVIEW ---`);
        console.log(`Champion: ${context.champion}`);
        console.log(`Unlocked Elements: ${context.unlockedElements.join(", ")}`);
        console.log(
          `Bypassed Subtypes: ${
            context.bypassedSubtypes.length > 0
              ? context.bypassedSubtypes.map((b) => `${b.subtype} (via ${b.unlockedByCard})`).join(", ")
              : "None"
          }`
        );
        console.log(`Active Classes: ${context.activeChampionClasses.join(", ") || "None"}`);
        console.log(`Total Deck Cards: ${context.deckCards.length}`);
        console.log(`Total Candidates in Pool: ${context.candidatePool.length}`);

        console.log(`\n--- CANDIDATE POOL SUMMARY (TOP 25) ---`);
        for (const c of context.candidatePool.slice(0, 25)) {
          console.log(
            `* ${c.cardName} [${c.element}/${c.class}] - ${c.tier} (owned: ${c.ownedQuantity}, idle: ${c.idleQuantity}, store: ${c.storeQuantity})${
              c.unlockedViaReason ? ` [Bypassed via ${c.unlockedViaReason}]` : ""
            }`
          );
        }

        if (args.includes("--prompt")) {
          console.log(`\n--- ASSEMBLED SYSTEM PROMPT ---\n`);
          console.log(buildDeckAdvisorSystemPrompt(context, "en"));
        } else {
          console.log(`\nTip: Add --prompt to view the full assembled system prompt text.`);
        }
        break;
      }

      case "rules": {
        const query = args.slice(1).join(" ");
        if (!query) {
          console.error("Usage: npx tsx scripts/deck-advisor-cli.ts rules <query>");
          process.exit(1);
        }

        console.log(`\nQuerying Grand Archive Rules for "${query}"...`);
        const result = await queryGrandArchiveRules(query);
        console.log("\n" + result);
        break;
      }

      case "search": {
        const query = args.slice(1).join(" ");
        if (!query) {
          console.error("Usage: npx tsx scripts/deck-advisor-cli.ts search <cardName>");
          process.exit(1);
        }

        console.log(`\nSearching catalog cards matching "${query}"...`);
        const found = await searchDeckAdvisorCatalogCards(query, db);
        for (const c of found) {
          console.log(`* ${c.name} (${c.element} ${c.class} ${c.type}) - Cost: R:${c.costReserve} M:${c.costMemory}`);
        }
        break;
      }

      default: {
        console.log(`
Grand Archive Deck Advisor CLI Utility

Usage:
  npx tsx scripts/deck-advisor-cli.ts decks                     List all user decks in DB
  npx tsx scripts/deck-advisor-cli.ts context <id> [--prompt]   Inspect assembled context and prompt
  npx tsx scripts/deck-advisor-cli.ts search <cardName>         Search catalog cards
  npx tsx scripts/deck-advisor-cli.ts rules <keyword>           Query official rules
        `);
      }
    }
  } finally {
    if (client && typeof client.close === "function") {
      client.close();
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
