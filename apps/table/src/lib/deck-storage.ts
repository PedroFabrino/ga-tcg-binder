/**
 * Browser-local deck storage and the import orchestration.
 *
 * Decklists never cross the Table boundary (ADR-0002). They live under a
 * Table + Seat key in this browser, are resolved against the public catalog,
 * and are sent to the server only as individual Pin requests.
 */

import type { SeatId } from "@ga/contracts";
import {
  getCardDetail,
  type CardDetailCache,
  type CardName,
  type FetchLike,
} from "./card-catalog";
import {
  buildDeckLookup,
  normalizeCardName,
  parseOmnidexText,
  resolveDecklist,
  type DeckCatalogCard,
  type DeckImportWarning,
  type ParsedDeckCard,
} from "./deck-import";

export interface StoredDeckEntry extends ParsedDeckCard {
  card: DeckCatalogCard | null;
}

export interface StoredDeck {
  version: 1;
  rawText: string;
  importedAt: number;
  main: StoredDeckEntry[];
  material: StoredDeckEntry[];
  side: StoredDeckEntry[];
  champion: StoredDeckEntry | null;
  warnings: DeckImportWarning[];
}

export interface DeckStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DECK_STORAGE_PREFIX = "gt.deck.";

export function deckStorageKey(code: string, seat: SeatId): string {
  return `${DECK_STORAGE_PREFIX}${code.toUpperCase()}.${seat}`;
}

function isEntry(value: unknown): value is StoredDeckEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.name !== "string" || typeof entry.quantity !== "number") return false;
  if (entry.card === null) return true;
  if (typeof entry.card !== "object" || entry.card === null) return false;
  const card = entry.card as Record<string, unknown>;
  return typeof card.name === "string" && typeof card.slug === "string";
}

function isStoredDeck(value: unknown): value is StoredDeck {
  if (typeof value !== "object" || value === null) return false;
  const deck = value as Record<string, unknown>;
  return (
    deck.version === 1 &&
    typeof deck.rawText === "string" &&
    typeof deck.importedAt === "number" &&
    Array.isArray(deck.main) &&
    deck.main.every(isEntry) &&
    Array.isArray(deck.material) &&
    deck.material.every(isEntry) &&
    Array.isArray(deck.side) &&
    deck.side.every(isEntry) &&
    (deck.champion === null || isEntry(deck.champion)) &&
    Array.isArray(deck.warnings)
  );
}

export function readDeck(
  code: string,
  seat: SeatId,
  storage: Pick<DeckStorage, "getItem"> | null
): StoredDeck | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(deckStorageKey(code, seat));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredDeck(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDeck(
  code: string,
  seat: SeatId,
  deck: StoredDeck,
  storage: Pick<DeckStorage, "setItem"> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(deckStorageKey(code, seat), JSON.stringify(deck));
  } catch {
    // Private mode or a full quota: the deck still works for this visit.
  }
}

export function clearDeck(
  code: string,
  seat: SeatId,
  storage: Pick<DeckStorage, "removeItem"> | null
): void {
  if (!storage) return;
  try {
    storage.removeItem(deckStorageKey(code, seat));
  } catch {
    // Nothing to recover; a stale deck is not worth blocking the Table.
  }
}

export interface ImportDeckOptions {
  cards: readonly CardName[];
  fetcher?: FetchLike;
  /** Required: the caller owns the browser cache, so deck storage stays storage-agnostic. */
  detailCache: CardDetailCache;
  now?: number;
}

function uniqueResolvedCards(
  entries: readonly { card: DeckCatalogCard | null }[]
): DeckCatalogCard[] {
  const seen = new Set<string>();
  const cards: DeckCatalogCard[] = [];
  for (const entry of entries) {
    if (!entry.card || seen.has(entry.card.slug)) continue;
    seen.add(entry.card.slug);
    cards.push(entry.card);
  }
  return cards;
}

function toStoredDeck(
  rawText: string,
  resolved: ReturnType<typeof resolveDecklist>,
  importedAt: number
): StoredDeck {
  return {
    version: 1,
    rawText,
    importedAt,
    main: resolved.main,
    material: resolved.material,
    side: resolved.side,
    champion: resolved.champion,
    warnings: resolved.warnings,
  };
}

/**
 * Parse, resolve names, then fetch full details for Material cards so printed
 * `level` can identify the Champion. Main/Side cards keep the lightweight
 * name+slug entry; their art is fetched only when selected for a Pin.
 */
export async function importDeck(
  rawText: string,
  options: ImportDeckOptions
): Promise<StoredDeck> {
  const now = options.now ?? Date.now();
  const parsed = parseOmnidexText(rawText);
  const nameLookup = buildDeckLookup(
    options.cards.map((card) => ({ name: card.name, slug: card.slug }))
  );
  const nameResolved = resolveDecklist(parsed, nameLookup);

  const detailCache = options.detailCache;
  const fetcher = options.fetcher ?? fetch;
  const materialCards = uniqueResolvedCards(nameResolved.material);

  const details = await Promise.all(
    materialCards.map((card) =>
      getCardDetail(card.slug, fetcher, detailCache, now).then((detail) => ({
        slug: card.slug,
        detail,
      }))
    )
  );
  const detailBySlug = new Map<string, DeckCatalogCard>();
  for (const entry of details) {
    if (entry.detail) detailBySlug.set(entry.slug, entry.detail);
  }

  const enrichedLookup = (name: string): DeckCatalogCard | undefined => {
    const summary = nameLookup(name);
    if (!summary) return undefined;
    return detailBySlug.get(summary.slug) ?? summary;
  };
  const resolved = resolveDecklist(parsed, enrichedLookup);

  return toStoredDeck(rawText, resolved, now);
}

/** Cards the Pin search should consider, deduplicated by slug. */
export function deckCardSlugs(deck: StoredDeck | null): Set<string> {
  const slugs = new Set<string>();
  if (!deck) return slugs;
  for (const entry of [...deck.main, ...deck.material, ...deck.side]) {
    if (entry.card) slugs.add(entry.card.slug);
  }
  return slugs;
}

/** Search within the imported deck first, preserving zone and quantity. */
export function searchDeck(
  deck: StoredDeck | null,
  query: string,
  limit = 20
): StoredDeckEntry[] {
  if (!deck) return [];
  const normalized = normalizeCardName(query);
  const seen = new Set<string>();
  const entries = [...deck.material, ...deck.main, ...deck.side].filter((entry) => {
    const key = entry.card?.slug ?? normalizeCardName(entry.name);
    if (seen.has(key)) return false;
    if (normalized && !normalizeCardName(entry.name).includes(normalized)) return false;
    seen.add(key);
    return true;
  });
  return entries.slice(0, limit);
}
