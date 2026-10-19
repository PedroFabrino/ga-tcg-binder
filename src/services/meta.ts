import { eq, desc, sql, inArray } from "drizzle-orm";
import {
  metaArchetypes,
  decks,
  deckCards,
  cards,
  cardEditions,
  collectionItems,
  mypCards,
  marketCards,
} from "../db/schema";
import { parseOmnidexText, fetchDeckFromUrl, decodeHtmlEntities } from "./omnidex";
import { calculateDeckShortage, DeckShortageReport } from "./shortage";

export interface MetaArchetypeSummary {
  id: string;
  name: string;
  tier: string;
  champion: string;
  element?: string | null;
  signatureCardImageUrl?: string | null;
  shareRate: string;
  winRate: string;
  deckCount?: number | null;
  decklist: string;
  detailUrl?: string | null;
  sampleEventDeckUrl?: string | null;
  sourceUrl?: string | null;

  // Collection-aware recommendation metrics (computed when userId provided)
  completionPct?: number;
  binderPct?: number;
  mypStorePct?: number;
  totalCoreRequired?: number;
  totalCoreOwned?: number;
  binderCardsOwned?: number;
  mypStoreCardsOwned?: number;
  missingCardsCount?: number;
  missingAvailableOnMarketCount?: number;
  estimatedCostToCompleteBrl?: number;
  isRecommended?: boolean;
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

export interface ParsedMetaArchetypeRow {
  name: string;
  tier: string;
  champion: string;
  element?: string;
  shareRate: string;
  winRate: string;
  deckCount: number;
  detailUrl?: string;
  signatureCardImageUrl?: string;
}

export function parseMetaTableHtml(html: string): ParsedMetaArchetypeRow[] {
  const results: ParsedMetaArchetypeRow[] = [];
  // Match rows in the meta archetype table
  // Archetypes are grouped by tier or in <tr> tags with data attributes / links to /meta/archetypes/...
  // Support both <tr> rows and cards/divs with class meta-archetype-row
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    if (!rowHtml.includes("/meta/archetypes/")) continue;

    const nameMatch =
      rowHtml.match(/<a[^>]*class=["'][^"']*arch-name[^"']*["'][^>]*href=["'](\/meta\/archetypes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ||
      rowHtml.match(/<a[^>]*href=["'](\/meta\/archetypes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!nameMatch) continue;

    const detailUrl = nameMatch[1];
    let name = nameMatch[2].replace(/<[^>]+>/g, "").trim();
    if (!name) {
      name = decodeURIComponent(detailUrl.replace(/^\/meta\/archetypes\//, "").replace(/\+/g, " "));
    }

    // Extract tier (Tier 1, Tier 2, Tier 3, or pill/badge)
    let tier = "Tier 2";
    const tierMatch =
      rowHtml.match(/class=["'][^"']*tier-pill[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
      rowHtml.match(/(?:tier|meta-tier)[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i) ||
      rowHtml.match(/\b(Tier\s*[1-3]|S|A|B|C)\b/i);
    if (tierMatch) {
      const rawTier = tierMatch[1].replace(/<[^>]+>/g, "").trim();
      tier = rawTier.replace(/\s+/g, " ");
    }

    // Extract champion name
    let champion = "";
    const champMatch = rowHtml.match(/class=["'][^"']*(?:champion|signature-card)[^"']*["'][^>]*>([\s\S]*?)<\//i);
    if (champMatch) {
      champion = champMatch[1].replace(/<[^>]+>/g, "").trim();
    } else {
      // Fallback: champion often precedes the element in archetype name (e.g. "Lorraine Wind" -> "Lorraine")
      const words = name.split(/\s+/);
      champion = words[0] || name;
    }

    // Extract element (Wind, Water, Fire, etc.)
    let element: string | undefined = undefined;
    const lower = name.toLowerCase() + " " + rowHtml.toLowerCase();
    if (lower.includes("wind")) element = "Wind";
    else if (lower.includes("water")) element = "Water";
    else if (lower.includes("fire")) element = "Fire";
    else if (lower.includes("norm")) element = "Norm";
    else if (lower.includes("earth")) element = "Earth";
    else if (lower.includes("lightning")) element = "Lightning";

    // Extract share rate
    let shareRate = "0%";
    const shareMatch =
      rowHtml.match(/class=["'][^"']*share-num[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      rowHtml.match(/(\d+(?:\.\d+)?)\s*%/);
    if (shareMatch) {
      shareRate = shareMatch[1].replace(/<[^>]+>/g, "").trim();
      if (!shareRate.endsWith("%")) shareRate += "%";
    }

    // Extract win rate: look for class="wr ..." span, or percentage
    let winRate = "50%";
    const wrMatch = rowHtml.match(/class=["'][^"']*wr\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    if (wrMatch) {
      winRate = wrMatch[1].replace(/<[^>]+>/g, "").trim();
    } else {
      const allPercentages = Array.from(rowHtml.matchAll(/(\d+(?:\.\d+)?)\s*%/g));
      if (allPercentages.length >= 2) {
        winRate = `${allPercentages[1][1]}%`;
      }
    }

    // Extract deck count from data-decks or text
    let deckCount = 0;
    const dataDecks = match[0].match(/data-decks=["'](\d+)["']/i);
    if (dataDecks) {
      deckCount = parseInt(dataDecks[1], 10) || 0;
    } else {
      const countMatch =
        rowHtml.match(/class=["'][^"']*deck-count[^"']*["'][^>]*>(\d+)<\//i) ||
        rowHtml.match(/(\d+)\s*decks?/i);
      if (countMatch) {
        deckCount = parseInt(countMatch[1], 10) || 0;
      }
    }

    // Extract signature card image URL
    let signatureCardImageUrl: string | undefined = undefined;
    const imgMatch = rowHtml.match(/<img[^>]*src=["']([^"']+)["']/i);
    if (imgMatch) {
      signatureCardImageUrl = imgMatch[1];
    }

    results.push({
      name,
      tier,
      champion,
      element,
      shareRate,
      winRate,
      deckCount,
      detailUrl,
      signatureCardImageUrl,
    });
  }

  return results;
}

export interface TournamentPlacement {
  eventTitle: string;
  placementText: string;
  prestigeScore: number;
  placementOrdinal: number;
  deckUrl: string;
}

export function rankPlacements(detailHtml: string): TournamentPlacement[] {
  const placements: TournamentPlacement[] = [];
  // Match tournament list items: <ol class="rp-list"> ... <li><a href="/events/.../decks/...">...
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(detailHtml)) !== null) {
    const liHtml = match[1];
    const deckUrlMatch = liHtml.match(/href=["'](\/events\/[^\/]+\/decks\/[^"']+)["']/i);
    if (!deckUrlMatch) continue;

    const deckUrl = deckUrlMatch[1];

    // Determine event title & prestige score
    // Worlds > Nationals > Ascent > Regionals > Store Championships > Online League
    let prestigeScore = 1;
    const lower = liHtml.toLowerCase();
    let eventTitle = "Competitive Tournament";

    if (lower.includes("world")) {
      prestigeScore = 100;
      eventTitle = "World Championship";
    } else if (lower.includes("national")) {
      prestigeScore = 80;
      eventTitle = "National Championship";
    } else if (lower.includes("ascent")) {
      prestigeScore = 60;
      eventTitle = "Ascent";
    } else if (lower.includes("regional")) {
      prestigeScore = 40;
      eventTitle = "Regional Championship";
    } else if (lower.includes("store championship") || lower.includes("store champ")) {
      prestigeScore = 20;
      eventTitle = "Store Championship";
    } else if (lower.includes("online") || lower.includes("league")) {
      prestigeScore = 10;
      eventTitle = "Online League";
    }

    // Determine placement ordinal: 1st (1) > 2nd (2) > Top 4 (4) > Top 8 (8) > ...
    let placementOrdinal = 999;
    let placementText = "Participant";
    const ordMatch = liHtml.match(/(\d+)(?:st|nd|rd|th)\b/i) || liHtml.match(/\bTop\s*(\d+)\b/i);
    if (ordMatch) {
      placementOrdinal = parseInt(ordMatch[1], 10) || 999;
      placementText = ordMatch[0];
    } else if (lower.includes("1st") || lower.includes("winner") || lower.includes("champion")) {
      placementOrdinal = 1;
      placementText = "1st Place";
    } else if (lower.includes("2nd") || lower.includes("finalist")) {
      placementOrdinal = 2;
      placementText = "2nd Place";
    }

    placements.push({
      eventTitle,
      placementText,
      prestigeScore,
      placementOrdinal,
      deckUrl,
    });
  }

  // Sort by prestige descending, then placement ordinal ascending (1st best)
  placements.sort((a, b) => {
    if (b.prestigeScore !== a.prestigeScore) {
      return b.prestigeScore - a.prestigeScore;
    }
    return a.placementOrdinal - b.placementOrdinal;
  });

  return placements;
}

export async function syncMetaArchetypes(
  database: any,
  customFetch: typeof fetch = fetch
): Promise<{
  syncedArchetypes: number;
  decklistsFetched: number;
  decklistsCacheHits: number;
}> {
  const metaUrl = "https://grandarchivestats.com/meta";
  const res = await customFetch(metaUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch meta archetypes from ${metaUrl}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const parsedRows = parseMetaTableHtml(html);

  if (parsedRows.length === 0) {
    return { syncedArchetypes: 0, decklistsFetched: 0, decklistsCacheHits: 0 };
  }

  // Existing archetypes in DB
  const existingRows = await database.select().from(metaArchetypes).all();
  const existingMap = new Map<string, any>();
  for (const ex of existingRows) {
    existingMap.set(ex.id, ex);
  }

  const seenIds = new Set<string>();
  let decklistsFetched = 0;
  let decklistsCacheHits = 0;

  for (const row of parsedRows) {
    const id = `meta-${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    seenIds.add(id);

    const existing = existingMap.get(id);
    let sampleEventDeckUrl = existing?.sampleEventDeckUrl || null;
    let decklist = existing?.decklist || "";

    // Eagerly resolve canonical decklist if active Tier 1, 2, or 3
    const isCompetitiveTier = ["tier 1", "tier 2", "tier 3", "s", "a", "b"].includes(row.tier.toLowerCase());

    if (isCompetitiveTier && row.detailUrl) {
      try {
        const fullDetailUrl = row.detailUrl.startsWith("http")
          ? row.detailUrl
          : `https://grandarchivestats.com${row.detailUrl}`;

        const detailRes = await customFetch(fullDetailUrl);
        if (detailRes.ok) {
          const detailHtml = await detailRes.text();
          const ranked = rankPlacements(detailHtml);

          if (ranked.length > 0) {
            const bestPlacement = ranked[0];
            const targetDeckUrl = bestPlacement.deckUrl.startsWith("http")
              ? bestPlacement.deckUrl
              : `https://grandarchivestats.com${bestPlacement.deckUrl}`;

            // Check URL cache
            if (existing && existing.sampleEventDeckUrl === targetDeckUrl && existing.decklist?.trim()) {
              decklistsCacheHits++;
              sampleEventDeckUrl = targetDeckUrl;
            } else {
              // Fetch decklist
              const deckRes = await customFetch(targetDeckUrl);
              if (deckRes.ok) {
                const deckHtml = await deckRes.text();
                const textareaMatch =
                  deckHtml.match(/<textarea[^>]*id=["']omnidex-src["'][^>]*>([\s\S]*?)<\/textarea>/i) ||
                  deckHtml.match(/<textarea[^>]*class=["'][^"']*omnidex-src[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i);
                if (textareaMatch) {
                  decklist = decodeHtmlEntities(textareaMatch[1].trim());
                  sampleEventDeckUrl = targetDeckUrl;
                  decklistsFetched++;
                }
              }
            }
          }
        }
      } catch {
        // Soft error: preserve existing decklist
      }
    }

    // Default fallback decklist if none exists yet
    if (!decklist) {
      decklist = `# Material Deck\n1 ${row.champion}\n\n# Main Deck\n4 Fracturize\n\n# Sideboard\n`;
    }

    await database
      .insert(metaArchetypes)
      .values({
        id,
        name: row.name,
        tier: row.tier,
        champion: row.champion,
        element: row.element || null,
        signatureCardImageUrl: row.signatureCardImageUrl || null,
        shareRate: row.shareRate,
        winRate: row.winRate,
        deckCount: row.deckCount,
        decklist,
        detailUrl: row.detailUrl || null,
        sampleEventDeckUrl,
        sourceUrl: row.detailUrl ? `https://grandarchivestats.com${row.detailUrl}` : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: metaArchetypes.id,
        set: {
          name: row.name,
          tier: row.tier,
          champion: row.champion,
          element: row.element || null,
          signatureCardImageUrl: row.signatureCardImageUrl || null,
          shareRate: row.shareRate,
          winRate: row.winRate,
          deckCount: row.deckCount,
          decklist,
          detailUrl: row.detailUrl || null,
          sampleEventDeckUrl,
          sourceUrl: row.detailUrl ? `https://grandarchivestats.com${row.detailUrl}` : null,
          updatedAt: new Date(),
        },
      });
  }

  // Soft-demote vanished existing archetypes to "Rogue"
  for (const ex of existingRows) {
    if (!seenIds.has(ex.id) && ex.tier !== "Rogue") {
      await database
        .update(metaArchetypes)
        .set({ tier: "Rogue", updatedAt: new Date() })
        .where(eq(metaArchetypes.id, ex.id));
    }
  }

  return {
    syncedArchetypes: parsedRows.length,
    decklistsFetched,
    decklistsCacheHits,
  };
}

export async function getMetaArchetypes(
  database: any,
  userId?: string
): Promise<MetaArchetypeSummary[]> {
  const rows = await database
    .select()
    .from(metaArchetypes)
    .orderBy(desc(metaArchetypes.shareRate));

  if (!userId) {
    return rows;
  }

  return await enrichArchetypesWithRecommendations(rows, userId, database);
}

export async function enrichArchetypesWithRecommendations(
  archetypesList: any[],
  userId: string,
  database: any
): Promise<MetaArchetypeSummary[]> {
  // 1. Fetch user binder inventory
  const binderRows = await database
    .select({
      cardSlug: cardEditions.cardSlug,
      quantity: collectionItems.quantity,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, userId));

  const binderOwnedBySlug = new Map<string, number>();
  for (const b of binderRows) {
    binderOwnedBySlug.set(
      b.cardSlug,
      (binderOwnedBySlug.get(b.cardSlug) || 0) + Number(b.quantity)
    );
  }

  // 2. Fetch user MyP store inventory
  const storeRows = await database
    .select({
      cardSlug: mypCards.cardSlug,
      quantity: mypCards.quantity,
    })
    .from(mypCards)
    .where(eq(mypCards.userId, userId));

  const storeOwnedBySlug = new Map<string, number>();
  for (const s of storeRows) {
    if (s.cardSlug) {
      storeOwnedBySlug.set(
        s.cardSlug,
        (storeOwnedBySlug.get(s.cardSlug) || 0) + Number(s.quantity)
      );
    }
  }

  // 3. Fetch global market inventory for buyable cost-to-complete
  const marketRows = await database
    .select({
      cardSlug: marketCards.cardSlug,
      priceNumeric: marketCards.priceNumeric,
      quantity: marketCards.quantity,
    })
    .from(marketCards)
    .where(eq(marketCards.storeId, "myp"));

  // Group market cards by slug sorted by lowest price
  const marketBySlug = new Map<string, { price: number; qty: number }[]>();
  for (const m of marketRows) {
    if (m.cardSlug && m.priceNumeric > 0) {
      const list = marketBySlug.get(m.cardSlug) || [];
      list.push({ price: m.priceNumeric, qty: m.quantity || 1 });
      marketBySlug.set(m.cardSlug, list);
    }
  }
  for (const list of Array.from(marketBySlug.values())) {
    list.sort((a: { price: number; qty: number }, b: { price: number; qty: number }) => a.price - b.price);
  }

  // Catalog slug lookup helper by card name
  const allCards = await database.select().from(cards).all();
  const slugByName = new Map<string, string>();
  for (const c of allCards) {
    slugByName.set(c.name.toLowerCase(), c.slug);
  }

  const enriched: MetaArchetypeSummary[] = [];

  for (const row of archetypesList) {
    const parsed = parseOmnidexText(row.decklist || "");
    // Core deck requirement = Material Deck + Main Deck
    const coreCards: { slug: string; name: string; quantity: number }[] = [];

    for (const card of [...parsed.material, ...parsed.main]) {
      const nameKey = card.name.toLowerCase();
      const slug =
        slugByName.get(nameKey) ||
        card.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      coreCards.push({
        slug,
        name: card.name,
        quantity: card.quantity,
      });
    }

    let totalCoreRequired = 0;
    let binderCardsOwned = 0;
    let mypStoreCardsOwned = 0;
    let missingCardsCount = 0;
    let missingAvailableOnMarketCount = 0;
    let estimatedCostToCompleteBrl = 0;

    for (const req of coreCards) {
      totalCoreRequired += req.quantity;
      const bOwned = binderOwnedBySlug.get(req.slug) || 0;
      const sOwned = storeOwnedBySlug.get(req.slug) || 0;

      const fromBinder = Math.min(req.quantity, bOwned);
      const remainingNeeded = req.quantity - fromBinder;
      const fromStore = Math.min(remainingNeeded, sOwned);
      const missing = remainingNeeded - fromStore;

      binderCardsOwned += fromBinder;
      mypStoreCardsOwned += fromStore;
      missingCardsCount += missing;

      // Calculate cost-to-complete from market
      if (missing > 0) {
        const availableMarket = marketBySlug.get(req.slug) || [];
        let neededFromMarket = missing;

        for (const listing of availableMarket) {
          if (neededFromMarket <= 0) break;
          const take = Math.min(neededFromMarket, listing.qty);
          missingAvailableOnMarketCount += take;
          estimatedCostToCompleteBrl += take * listing.price;
          neededFromMarket -= take;
        }
      }
    }

    const totalCoreOwned = binderCardsOwned + mypStoreCardsOwned;
    const completionPct =
      totalCoreRequired > 0
        ? Math.round((totalCoreOwned / totalCoreRequired) * 100)
        : 0;
    const binderPct =
      totalCoreRequired > 0
        ? Math.round((binderCardsOwned / totalCoreRequired) * 100)
        : 0;
    const mypStorePct =
      totalCoreRequired > 0
        ? Math.round((mypStoreCardsOwned / totalCoreRequired) * 100)
        : 0;

    // A deck is recommended if completion is >= 70% or has lowest missing count
    const isRecommended = completionPct >= 70;

    enriched.push({
      ...row,
      completionPct,
      binderPct,
      mypStorePct,
      totalCoreRequired,
      totalCoreOwned,
      binderCardsOwned,
      mypStoreCardsOwned,
      missingCardsCount,
      missingAvailableOnMarketCount,
      estimatedCostToCompleteBrl: Math.round(estimatedCostToCompleteBrl * 100) / 100,
      isRecommended,
    });
  }

  return enriched;
}

export async function compareMetaDeckAgainstCollection(
  metaDeckIdOrText: string,
  userId: string,
  database: any
): Promise<DeckShortageReport & { champion: string; decklistText: string }> {
  let decklistText = metaDeckIdOrText.trim();
  let deckTitle = "Meta Comparison Deck";
  let champion = "";

  if (decklistText.startsWith("http://") || decklistText.startsWith("https://")) {
    const fetched = await fetchDeckFromUrl(decklistText);
    decklistText = fetched.decklist;
    deckTitle = fetched.name;
    champion = fetched.champion || "";
  } else {
    // If it's a known meta archetype ID, grab its decklist
    const metaRow = await database
      .select()
      .from(metaArchetypes)
      .where(eq(metaArchetypes.id, metaDeckIdOrText))
      .get();

    if (metaRow) {
      decklistText = decodeHtmlEntities(metaRow.decklist);
      deckTitle = decodeHtmlEntities(`Meta: ${metaRow.name}`);
      champion = decodeHtmlEntities(metaRow.champion);
    }
  }

  // Parse Omnidex deck
  const parsed = parseOmnidexText(decklistText);
  if (!champion) {
    champion = decodeHtmlEntities(parsed.champion || "Unknown Champion");
  }

  // Create temporary in-memory or ephemeral deck entry for shortage analysis
  const tempDeckId = `meta-comp-${Date.now()}`;
  await database.insert(decks).values({
    id: tempDeckId,
    userId,
    name: deckTitle,
    champion,
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

  return {
    ...report,
    deckName: deckTitle,
    champion,
    decklistText,
  };
}
