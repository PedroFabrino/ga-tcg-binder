import { parseOmnidexText, decodeHtmlEntities, fetchDeckFromUrl } from "./omnidex";
import { createDeckService } from "./deck";
import { findCardByNameCaseInsensitive } from "../db/repositories/collection-repository";
import { upsertPersonalWant } from "../db/repositories/personal-wants-repository";
import { getUserCollectionItems } from "../db/repositories/collection-repository";
import { upsertCatalogCard } from "../db/repositories/catalog-repository";

export interface OmnidexWantsImportResult {
  addedCardsCount: number;
  addedCopiesCount: number;
  skippedCopiesCount: number;
}

/**
 * Ingests an Omnidex decklist, compares against current collector binder inventory,
 * and inserts only the unowned shortage gap into Personal Wants (source: 'omnidex').
 */
export async function importOmnidexDeckToPersonalWants(
  collectorId: string,
  omnidexText: string,
  database?: unknown
): Promise<OmnidexWantsImportResult> {
  const decoded = decodeHtmlEntities(omnidexText);
  const parsed = parseOmnidexText(decoded);

  // Aggregate required quantities across material, main, and side zones
  const requirements = new Map<string, { name: string; quantity: number }>();
  const allItems = [...parsed.material, ...parsed.main, ...parsed.side];

  for (const item of allItems) {
    const cleanName = item.name.trim();
    if (!cleanName) continue;
    const existing = requirements.get(cleanName);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      requirements.set(cleanName, { name: cleanName, quantity: item.quantity });
    }
  }

  // Load user inventory to determine idle copies
  const inventory = await getUserCollectionItems(collectorId, database as any);

  let addedCardsCount = 0;
  let addedCopiesCount = 0;
  let skippedCopiesCount = 0;

  for (const [cardName, req] of requirements.entries()) {
    let slug = cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const matchCard = await findCardByNameCaseInsensitive(cardName, database as any);

    if (matchCard) {
      slug = matchCard.slug;
    } else {
      await upsertCatalogCard(
        {
          slug,
          name: cardName,
          element: "NORM",
          class: "ALL",
          type: "UNKNOWN",
          subtypes: "[]",
        },
        database as any
      );
    }

    // Find owned idle copies in user's binder
    const ownedIdle = inventory
      .filter((i) => i.cardSlug === slug && !i.isDedicated)
      .reduce((sum, i) => sum + i.quantity, 0);

    const deficit = Math.max(0, req.quantity - ownedIdle);
    const satisfied = Math.min(req.quantity, ownedIdle);
    skippedCopiesCount += satisfied;

    if (deficit > 0) {
      addedCardsCount += 1;
      addedCopiesCount += deficit;
      await upsertPersonalWant(
        {
          collectorId,
          cardSlug: slug,
          desiredQuantity: deficit,
          source: "omnidex",
        },
        database as any
      );
    }
  }

  return {
    addedCardsCount,
    addedCopiesCount,
    skippedCopiesCount,
  };
}

/**
 * Imports an Omnidex deck as a newly saved constructed Deck for the user.
 */
export async function importOmnidexDeckToCollection(
  collectorId: string,
  name: string,
  omnidexText: string,
  champion?: string,
  format?: string,
  database?: unknown
): Promise<{ id: string; name: string }> {
  const deck = await createDeckService(
    collectorId,
    {
      name,
      champion,
      format,
      omnidexText,
    },
    database as any
  );

  return { id: deck.id, name };
}
