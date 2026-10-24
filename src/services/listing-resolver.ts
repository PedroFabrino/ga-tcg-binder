/**
 * Listing Resolver: maps a raw external listing identity to the canonical Card
 * and Printing in the Card Catalog.
 *
 * Platform parsers keep only their own title/collector-number normalization.
 * The canonical lookup — name, alphanumeric fallback, edition/collector-number
 * match — lives here once for MyP, LigaStore, and Lootcards.
 */

export interface ResolutionCard {
  slug: string;
  name: string;
  id?: string;
}

export interface ResolutionEdition {
  id: string;
  cardSlug: string;
  setPrefix: string;
  collectorNumber: string;
  cardId?: string;
}

export interface ResolutionCatalog {
  allCatalogCards: ResolutionCard[];
  allCatalogEditions: ResolutionEdition[];
  cardByLowerName: Map<string, ResolutionCard>;
  cardByAlphaNum: Map<string, ResolutionCard>;
}

export interface ListingIdentity {
  cardSlug: string | null;
  editionId: string | null;
  setPrefix: string;
}

export function normalizeAlphaNumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeCollectorNumber(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = normalized.match(/^(\d+)([a-z]*)$/);
  if (!match) {
    return normalized;
  }

  return `${String(Number(match[1]))}${match[2]}`;
}

/**
 * Resolves a platform-neutral listing identity. Lootcards opts into keeping the
 * matched Card when no Printing matches; LigaStore treats that as unresolved.
 */
export function resolveListing(
  input: {
    name: string;
    collectorNumber?: string;
    editionUuid?: string | null;
    setPrefix?: string;
  },
  catalog: ResolutionCatalog,
  options: { keepCardWhenEditionMissing?: boolean } = {}
): ListingIdentity {
  if (input.editionUuid) {
    const direct = catalog.allCatalogEditions.find(
      (edition) => edition.id === input.editionUuid
    );
    if (direct) {
      return {
        cardSlug: direct.cardSlug,
        editionId: direct.id,
        setPrefix: direct.setPrefix ?? input.setPrefix ?? "UNKNOWN",
      };
    }
  }

  const lowerName = input.name.trim().toLowerCase();
  const matchedCard =
    catalog.cardByLowerName.get(lowerName) ??
    catalog.cardByAlphaNum.get(normalizeAlphaNumeric(input.name));

  if (!matchedCard) {
    return { cardSlug: null, editionId: null, setPrefix: "UNKNOWN" };
  }

  const collectorNumber = normalizeCollectorNumber(input.collectorNumber);
  const matchedEdition = catalog.allCatalogEditions.find((edition) => {
    if (edition.cardSlug !== matchedCard.slug) return false;
    const editionNumber = normalizeCollectorNumber(edition.collectorNumber);
    return editionNumber === collectorNumber || !collectorNumber;
  });

  if (!matchedEdition) {
    return {
      cardSlug:
        options.keepCardWhenEditionMissing === false ? null : matchedCard.slug,
      editionId: null,
      setPrefix: "UNKNOWN",
    };
  }

  return {
    cardSlug: matchedCard.slug,
    editionId: matchedEdition.id,
    setPrefix: matchedEdition.setPrefix,
  };
}

/**
 * MyP listings carry a `grandarchive_<set>_<number>` item id that can resolve a
 * Card even when the display name is decorated. Kept here so all three platform
 * adapters share one resolver module.
 */
export function resolveMypItem(
  item: {
    cleanName: string;
    setPrefix: string;
    mypItemId?: string | null;
    itemId?: string | null;
  },
  catalog: ResolutionCatalog
): {
  matchedCard: { slug: string; name: string } | null;
  editionId: string | null;
} {
  const lowerClean = item.cleanName.toLowerCase().trim();

  let matchedCard = catalog.cardByLowerName.get(lowerClean) || null;

  // Fallback 1: double-faced Card split on `//`
  if (!matchedCard && lowerClean.includes("//")) {
    matchedCard =
      catalog.cardByLowerName.get(lowerClean.split("//")[0].trim()) || null;
  }

  const itemId = item.mypItemId ?? item.itemId ?? null;
  let parsedSet = item.setPrefix.toUpperCase().split(" ")[0];
  let parsedNum: string | null = null;
  if (itemId) {
    const match = itemId.match(/^grandarchive_([a-z0-9]+)_([0-9]+)/i);
    if (match) {
      parsedSet = match[1].toUpperCase();
      parsedNum = match[2];
    }
  }

  // Fallback 2: set prefix + collector number from the item id
  if (!matchedCard && parsedSet && parsedNum) {
    const edition = catalog.allCatalogEditions.find(
      (entry) =>
        entry.setPrefix.toUpperCase() === parsedSet &&
        entry.collectorNumber.padStart(3, "0") === parsedNum!.padStart(3, "0")
    );
    if (edition) {
      matchedCard =
        catalog.allCatalogCards.find((card) => card.slug === edition.cardSlug) ||
        null;
    }
  }

  // Fallback 3: alphanumeric normalized name
  if (!matchedCard) {
    matchedCard =
      catalog.cardByAlphaNum.get(
        normalizeAlphaNumeric(lowerClean.split("//")[0])
      ) || null;
  }

  let editionId: string | null = null;
  if (matchedCard) {
    const editions = catalog.allCatalogEditions.filter(
      (entry) => entry.cardSlug === matchedCard!.slug
    );
    const exact =
      editions.find(
        (entry) =>
          entry.setPrefix.toUpperCase() === item.setPrefix.toUpperCase()
      ) ||
      editions.find((entry) => entry.setPrefix.toUpperCase() === parsedSet) ||
      editions[0];
    editionId = exact?.id || null;
  }

  return { matchedCard, editionId };
}
