import { eq, desc, sql } from "drizzle-orm";
import { metaArchetypes, decks, deckCards, cards, cardEditions } from "../db/schema";
import { parseOmnidexText } from "./omnidex";
import { calculateDeckShortage, DeckShortageReport } from "./shortage";

export interface MetaArchetypeSummary {
  id: string;
  name: string;
  tier: string;
  champion: string;
  shareRate: string;
  winRate: string;
  decklist: string;
  sourceUrl?: string | null;
}

export const SEED_META_ARCHETYPES = [
  {
    id: "meta-lorraine-wind",
    name: "Lorraine Wind Warrior",
    tier: "S",
    champion: "Lorraine, Wandering Warrior",
    shareRate: "22.4%",
    winRate: "58.2%",
    sourceUrl: "https://grandarchivestats.com/decks/lorraine-wind",
    decklist: `# Material Deck
1 Lorraine, Wandering Warrior
1 Lorraine, Crux Knight
1 Lorraine, Blade Master
1 Starter Water

# Main Deck
4 Fracturize
4 Arcane Disposition
4 Resplendent Bolt
4 Swift Strike
4 Creative Shock
4 Wind Blade
4 Dispel
4 Defensive Stance
4 Tactical Reposition
4 Strategic Retreat
4 Grand Crusader
4 Rallying Cry
4 Honorable Duel
4 Flurry of Blows
4 Spirit Dance
4 Blade Flurry

# Sideboard
4 Prismatic Barrier
4 Nullifying Pulse`,
  },
  {
    id: "meta-rai-water",
    name: "Rai Water Mage",
    tier: "S",
    champion: "Rai, Mana Weaver",
    shareRate: "18.6%",
    winRate: "56.4%",
    sourceUrl: "https://grandarchivestats.com/decks/rai-water",
    decklist: `# Material Deck
1 Rai, Mana Weaver
1 Rai, Storm Seer
1 Rai, Archmage
1 Starter Water

# Main Deck
4 Arcane Disposition
4 Dispel
4 Fracturize
4 Frost Nova
4 Tidal Surge
4 Glacial Prison
4 Mystic Reflection
4 Mana Surge
4 Crystal Shard
4 Torrential Blast
4 Ice Barrier
4 Chilling Grasp
4 Mind Freeze
4 Frozen Tomb
4 Blizzard
4 Deep Freeze

# Sideboard
4 Spell Pierce
4 Elemental Ward`,
  },
  {
    id: "meta-diana-fire",
    name: "Diana Fire Ranger",
    tier: "A",
    champion: "Diana, Forest Archer",
    shareRate: "14.1%",
    winRate: "53.8%",
    sourceUrl: "https://grandarchivestats.com/decks/diana-fire",
    decklist: `# Material Deck
1 Diana, Forest Archer
1 Diana, Swift Shot
1 Diana, Sharpshooter
1 Starter Fire

# Main Deck
4 Flame Burst
4 Incinerate
4 Piercing Arrow
4 Quick Shot
4 Explosive Shot
4 Blazing Volley
4 Fire Trap
4 Searing Heat
4 Scorching Ray
4 Volcanic Ash
4 Ash Cloud
4 Combustion
4 Ignite
4 Burning Embers
4 Pyromancy
4 Wildfire

# Sideboard
4 Smoke Screen
4 Flame Guard`,
  },
];

export async function seedMetaArchetypes(database: any) {
  for (const meta of SEED_META_ARCHETYPES) {
    await database
      .insert(metaArchetypes)
      .values(meta)
      .onConflictDoUpdate({
        target: metaArchetypes.id,
        set: {
          name: meta.name,
          tier: meta.tier,
          champion: meta.champion,
          shareRate: meta.shareRate,
          winRate: meta.winRate,
          decklist: meta.decklist,
          sourceUrl: meta.sourceUrl,
          updatedAt: sql`(strftime('%s', 'now'))`,
        },
      });
  }
}

export async function getMetaArchetypes(database: any): Promise<MetaArchetypeSummary[]> {
  const rows = await database
    .select()
    .from(metaArchetypes)
    .orderBy(desc(metaArchetypes.shareRate));
  return rows;
}

export async function compareMetaDeckAgainstCollection(
  metaDeckIdOrText: string,
  userId: string,
  database: any
): Promise<DeckShortageReport> {
  // If it's a known meta archetype ID, grab its decklist
  let decklistText = metaDeckIdOrText;
  let deckTitle = "Meta Comparison Deck";

  const metaRow = await database
    .select()
    .from(metaArchetypes)
    .where(eq(metaArchetypes.id, metaDeckIdOrText))
    .get();

  if (metaRow) {
    decklistText = metaRow.decklist;
    deckTitle = `Meta: ${metaRow.name}`;
  }

  // Parse Omnidex deck
  const parsed = parseOmnidexText(decklistText);

  // Create temporary in-memory or ephemeral deck entry for shortage analysis
  const tempDeckId = `meta-comp-${Date.now()}`;
  await database.insert(decks).values({
    id: tempDeckId,
    userId,
    name: deckTitle,
    champion: parsed.champion || "Unknown Champion",
    format: "standard",
  });

  const cardsToInsert: {
    id: string;
    deckId: string;
    cardSlug: string;
    zone: string;
    quantity: number;
  }[] = [];

  const zones: ("material" | "main" | "side")[] = ["material", "main", "side"];
  let idx = 1;

  for (const zone of zones) {
    for (const card of parsed[zone]) {
      // Find card slug from name
      let slug = card.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const matchedCard = await database
        .select()
        .from(cards)
        .where(sql`lower(${cards.name}) = lower(${card.name})`)
        .get();

      if (matchedCard) {
        slug = matchedCard.slug;
      } else {
        // Ensure stub card exists in database so foreign key constraint is satisfied
        await database
          .insert(cards)
          .values({
            slug,
            name: card.name,
            element: "NORM",
            class: "ALL",
            type: "UNKNOWN",
            subtypes: "[]",
          })
          .onConflictDoNothing();
      }

      cardsToInsert.push({
        id: `m-dc-${tempDeckId}-${idx++}`,
        deckId: tempDeckId,
        cardSlug: slug,
        zone,
        quantity: card.quantity,
      });
    }
  }

  if (cardsToInsert.length > 0) {
    await database.insert(deckCards).values(cardsToInsert);
  }

  // Run shortage calculation
  const report = await calculateDeckShortage(tempDeckId, userId, database);

  // Clean up ephemeral deck
  await database.delete(deckCards).where(eq(deckCards.deckId, tempDeckId));
  await database.delete(decks).where(eq(decks.id, tempDeckId));

  return report;
}
